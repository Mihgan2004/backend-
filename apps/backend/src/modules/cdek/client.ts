import { Logger } from "@medusajs/framework/types"
import { getCdekOptionsFromEnv } from "./lib/config"
import { normalizeCdekError, sanitizeForLog } from "./lib/errors"
import {
  CdekApiCity,
  CdekApiCreateOrderRequest,
  CdekApiCreateOrderResponse,
  CdekApiDeliveryPoint,
  CdekApiOrderEntity,
  CdekApiTariffRequest,
  CdekApiTariffResponse,
  CdekProviderOptions,
  CdekApiError,
} from "./types"

const TOKEN_EXPIRY_BUFFER_MS = 60_000

type TokenCache = {
  accessToken: string
  expiresAt: number
}

type RequestOptions = {
  method: "GET" | "POST"
  path: string
  body?: unknown
  query?: Record<string, string | number | undefined>
  auth?: boolean
}

export { CdekApiError } from "./types"

export class CdekClient {
  private tokenCache: TokenCache | null = null

  constructor(
    private readonly options: CdekProviderOptions,
    private readonly logger?: Logger
  ) {}

  async searchCities(query: string, countryCodes = "RU"): Promise<CdekApiCity[]> {
    const result = await this.request<CdekApiCity[]>({
      method: "GET",
      path: "/location/cities",
      query: {
        city: query,
        country_codes: countryCodes,
        size: 20,
      },
    })

    return Array.isArray(result) ? result : []
  }

  async listDeliveryPoints(cityCode: number): Promise<CdekApiDeliveryPoint[]> {
    const result = await this.request<CdekApiDeliveryPoint[]>({
      method: "GET",
      path: "/deliverypoints",
      query: {
        city_code: cityCode,
        type: "PVZ",
        size: 1000,
      },
    })

    return Array.isArray(result) ? result : []
  }

  async calculateTariff(
    payload: CdekApiTariffRequest
  ): Promise<CdekApiTariffResponse> {
    return this.request<CdekApiTariffResponse>({
      method: "POST",
      path: "/calculator/tariff",
      body: payload,
    })
  }

  async createOrder(
    payload: CdekApiCreateOrderRequest
  ): Promise<CdekApiCreateOrderResponse> {
    return this.request<CdekApiCreateOrderResponse>({
      method: "POST",
      path: "/orders",
      body: payload,
    })
  }

  async getOrderByUuid(uuid: string): Promise<CdekApiOrderEntity> {
    return this.request<CdekApiOrderEntity>({
      method: "GET",
      path: `/orders/${uuid}`,
    })
  }

  async getOrderByCdekNumber(cdekNumber: string): Promise<CdekApiOrderEntity> {
    return this.request<CdekApiOrderEntity>({
      method: "GET",
      path: "/orders",
      query: {
        cdek_number: cdekNumber,
      },
    })
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.tokenCache &&
      Date.now() < this.tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS
    ) {
      return this.tokenCache.accessToken
    }

    const baseUrl = this.options.baseUrl.replace(/\/$/, "")
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
    })

    const response = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })

    const responseText = await response.text()
    let parsed: {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }

    try {
      parsed = responseText ? JSON.parse(responseText) : {}
    } catch {
      throw normalizeCdekError(response.status, { message: "Invalid token response" })
    }

    if (!response.ok || !parsed.access_token) {
      throw normalizeCdekError(response.status, parsed)
    }

    const expiresIn = (parsed.expires_in ?? 3600) * 1000

    this.tokenCache = {
      accessToken: parsed.access_token,
      expiresAt: Date.now() + expiresIn,
    }

    this.logger?.info("CDEK OAuth token acquired")

    return parsed.access_token
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const baseUrl = this.options.baseUrl.replace(/\/$/, "")
    const url = new URL(`${baseUrl}${options.path}`)

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    if (options.auth !== false) {
      const token = await this.getAccessToken()
      headers.Authorization = `Bearer ${token}`
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    const responseText = await response.text()
    let parsed: unknown

    try {
      parsed = responseText ? JSON.parse(responseText) : {}
    } catch {
      parsed = { message: responseText }
    }

    if (response.status >= 200 && response.status < 300) {
      this.logger?.info(`CDEK ${options.method} ${options.path} -> ${response.status}`)
      return parsed as T
    }

    this.logger?.error(
      `CDEK ${options.method} ${options.path} failed: status=${response.status} body=${JSON.stringify(sanitizeForLog(parsed))}`
    )

    throw normalizeCdekError(response.status, parsed)
  }
}

export function createCdekClient(
  options?: CdekProviderOptions,
  logger?: Logger
): CdekClient {
  return new CdekClient(options ?? getCdekOptionsFromEnv(), logger)
}
