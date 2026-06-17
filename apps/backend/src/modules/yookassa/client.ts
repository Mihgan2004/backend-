import { randomUUID } from "crypto"
import { Logger } from "@medusajs/framework/types"
import {
  YooKassaApiError,
  YooKassaCreatePaymentParams,
  YooKassaPayment,
  YooKassaProviderOptions,
} from "./types"

const DEFAULT_API_URL = "https://api.yookassa.ru/v3"
const MAX_RETRIES = 3
const BASE_DELAY_MS = 500

type RequestOptions = {
  method: "GET" | "POST"
  path: string
  body?: unknown
  idempotenceKey?: string
  logger?: Logger
}

export { YooKassaApiError } from "./types"

export class YooKassaClient {
  private readonly apiUrl: string
  private readonly authHeader: string

  constructor(
    private readonly options: YooKassaProviderOptions,
    private readonly logger?: Logger
  ) {
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "")
    const credentials = Buffer.from(
      `${options.shopId}:${options.secretKey}`
    ).toString("base64")
    this.authHeader = `Basic ${credentials}`
  }

  async createPayment(
    params: YooKassaCreatePaymentParams,
    idempotenceKey: string
  ): Promise<YooKassaPayment> {
    return this.requestWithRetry<YooKassaPayment>({
      method: "POST",
      path: "/payments",
      body: params,
      idempotenceKey,
    })
  }

  async getPayment(paymentId: string): Promise<YooKassaPayment> {
    return this.requestWithRetry<YooKassaPayment>({
      method: "GET",
      path: `/payments/${paymentId}`,
    })
  }

  async cancelPayment(
    paymentId: string,
    idempotenceKey?: string
  ): Promise<YooKassaPayment> {
    return this.requestWithRetry<YooKassaPayment>({
      method: "POST",
      path: `/payments/${paymentId}/cancel`,
      body: {},
      idempotenceKey: idempotenceKey ?? randomUUID(),
    })
  }

  private async requestWithRetry<T>(
    options: RequestOptions,
    attempt = 1
  ): Promise<T> {
    try {
      return await this.request<T>(options)
    } catch (error) {
      if (
        error instanceof YooKassaApiError &&
        error.isIndeterminate &&
        attempt < MAX_RETRIES
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        this.logger?.warn(
          `YooKassa indeterminate response (${error.statusCode}), retry ${attempt}/${MAX_RETRIES} in ${delay}ms`
        )
        await sleep(delay)
        return this.requestWithRetry(options, attempt + 1)
      }

      throw error
    }
  }

  private async request<T>({
    method,
    path,
    body,
    idempotenceKey,
  }: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    if (idempotenceKey) {
      headers["Idempotence-Key"] = idempotenceKey
    }

    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const responseText = await response.text()
    let parsed: unknown

    try {
      parsed = responseText ? JSON.parse(responseText) : {}
    } catch {
      parsed = { raw: responseText }
    }

    if (response.status >= 200 && response.status < 300) {
      this.logger?.info(
        `YooKassa ${method} ${path} -> ${response.status}`
      )
      return parsed as T
    }

    const isIndeterminate = response.status >= 500
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "description" in parsed &&
      typeof (parsed as { description?: string }).description === "string"
        ? (parsed as { description: string }).description
        : `YooKassa API error (${response.status})`

    this.logger?.error(
      `YooKassa ${method} ${path} failed: status=${response.status} message=${message}`
    )

    throw new YooKassaApiError(
      message,
      response.status,
      parsed,
      isIndeterminate
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function generateIdempotenceKey(): string {
  return randomUUID()
}

export function createYooKassaClient(
  options: YooKassaProviderOptions,
  logger?: Logger
): YooKassaClient {
  return new YooKassaClient(options, logger)
}

export function getYooKassaOptionsFromEnv(): YooKassaProviderOptions {
  return {
    shopId: process.env.YOOKASSA_SHOP_ID ?? "",
    secretKey: process.env.YOOKASSA_SECRET_KEY ?? "",
    apiUrl: process.env.YOOKASSA_API_URL ?? DEFAULT_API_URL,
    currency: process.env.YOOKASSA_CURRENCY ?? "RUB",
    returnUrl: process.env.YOOKASSA_RETURN_URL,
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:8000",
    receiptsEnabled: process.env.YOOKASSA_RECEIPTS_ENABLED === "true",
    vatCode: Number(process.env.YOOKASSA_VAT_CODE ?? "1"),
    trustProxy: process.env.TRUST_PROXY === "true",
    ipAllowlistEnabled: process.env.YOOKASSA_IP_ALLOWLIST_ENABLED === "true",
  }
}
