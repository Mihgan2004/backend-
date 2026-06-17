import {
  AbstractPaymentProvider,
  PaymentActions,
  PaymentSessionStatus,
  isDefined,
} from "@medusajs/framework/utils"
import {
  MedusaContainer,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
} from "@medusajs/framework/types"
import { YooKassaApiError, YooKassaClient, generateIdempotenceKey } from "./client"
import { formatAmountForYooKassa } from "./lib/amount"
import {
  findPendingYooKassaSessionForCollection,
  resolveCartContext,
} from "./lib/cart-context"
import { buildReceipt } from "./lib/receipt"
import {
  buildSessionDataFromPayment,
  hasActivePendingPayment,
  mapYooKassaStatusToMedusa,
} from "./lib/payment-data"
import { YooKassaProviderOptions, YooKassaSessionData } from "./types"

type InjectedDependencies = {
  logger: Logger
}

class YooKassaProviderService extends AbstractPaymentProvider<YooKassaProviderOptions> {
  static identifier = "yookassa"

  protected readonly logger_: Logger
  protected readonly client_: YooKassaClient
  protected readonly options_: YooKassaProviderOptions

  static validateOptions(options: YooKassaProviderOptions): void {
    if (!isDefined(options.shopId)) {
      throw new Error("YOOKASSA_SHOP_ID is required")
    }

    if (!isDefined(options.secretKey)) {
      throw new Error("YOOKASSA_SECRET_KEY is required")
    }
  }

  constructor(
    container: InjectedDependencies,
    options: YooKassaProviderOptions
  ) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = options
    this.client_ = new YooKassaClient(options, this.logger_)
  }

  async initiatePayment({
    amount,
    currency_code,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionData = (data ?? {}) as YooKassaSessionData
    const sessionId = sessionData.session_id as string | undefined

    const cartContext = await resolveCartContext(
      this.container as unknown as MedusaContainer,
      sessionId
    )

    const cartId = cartContext.cart_id ?? (sessionData.cart_id as string | undefined)
    const countryCode =
      cartContext.country_code ?? (sessionData.country_code as string | undefined)
    const paymentCollectionId =
      cartContext.payment_collection_id ??
      (sessionData.payment_collection_id as string | undefined)

    if (hasActivePendingPayment(sessionData)) {
      this.logger_.info(
        `Reusing pending YooKassa payment ${sessionData.yookassa_payment_id} for session ${sessionId}`
      )

      return {
        id: sessionData.yookassa_payment_id!,
        data: {
          ...sessionData,
          cart_id: cartId,
          country_code: countryCode,
          payment_collection_id: paymentCollectionId,
        } as unknown as Record<string, unknown>,
        status: PaymentSessionStatus.PENDING,
      }
    }

    if (paymentCollectionId) {
      const reusable = await findPendingYooKassaSessionForCollection(
        this.container as unknown as MedusaContainer,
        paymentCollectionId,
        this.getIdentifier()
      )

      if (reusable?.data && hasActivePendingPayment(reusable.data)) {
        this.logger_.info(
          `Reusing pending YooKassa payment from collection ${paymentCollectionId}`
        )

        const reused = reusable.data as YooKassaSessionData

        return {
          id: reused.yookassa_payment_id!,
          data: {
            ...reused,
            session_id: sessionId,
            cart_id: cartId,
            country_code: countryCode,
            payment_collection_id: paymentCollectionId,
          } as unknown as Record<string, unknown>,
          status: PaymentSessionStatus.PENDING,
        }
      }
    }

    const currency = (this.options_.currency ?? currency_code).toUpperCase()
    const amountValue = formatAmountForYooKassa(amount, currency)
    const idempotenceKey =
      sessionData.idempotence_key ??
      (context?.idempotency_key as string | undefined) ??
      generateIdempotenceKey()

    const returnUrl = this.buildReturnUrl(cartId, countryCode)
    const description = cartId
      ? `Заказ (корзина) ${cartId}`
      : `Оплата ${sessionId ?? ""}`

    const email =
      cartContext.email ??
      context?.customer?.email ??
      (sessionData as { email?: string }).email

    const receipt = buildReceipt(
      {
        email,
        currency_code: currency,
        items: cartContext.items,
      },
      this.options_
    )

    const paymentParams = {
      amount: {
        value: amountValue,
        currency,
      },
      capture: true,
      confirmation: {
        type: "redirect" as const,
        return_url: returnUrl,
      },
      description,
      metadata: {
        session_id: sessionId ?? "",
        cart_id: cartId ?? "",
        payment_collection_id: paymentCollectionId ?? "",
      },
      ...(receipt ? { receipt } : {}),
    }

    this.logger_.info(
      `Creating YooKassa payment session=${sessionId} cart=${cartId} amount=${amountValue} ${currency}`
    )

    let payment

    try {
      payment = await this.client_.createPayment(paymentParams, idempotenceKey)
    } catch (error) {
      const previousPaymentId = sessionData.yookassa_payment_id

      if (
        previousPaymentId &&
        error instanceof YooKassaApiError &&
        error.isIndeterminate
      ) {
        this.logger_.warn(
          `YooKassa create indeterminate, fetching payment ${previousPaymentId}`
        )
        payment = await this.client_.getPayment(previousPaymentId)
      } else {
        throw this.buildError("Failed to create YooKassa payment", error)
      }
    }

    const updatedSessionData = buildSessionDataFromPayment(
      payment,
      {
        ...sessionData,
        idempotence_key: idempotenceKey,
        session_id: sessionId,
        cart_id: cartId,
        country_code: countryCode,
        payment_collection_id: paymentCollectionId,
      },
      payment as unknown as Record<string, unknown>
    )

    this.logger_.info(
      `YooKassa payment created id=${payment.id} status=${payment.status}`
    )

    return {
      id: payment.id,
      data: updatedSessionData as unknown as Record<string, unknown>,
      status: mapYooKassaStatusToMedusa(payment.status) as PaymentSessionStatus,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return this.getPaymentStatus(input)
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const sessionData = (input.data ?? {}) as YooKassaSessionData
    const paymentId = sessionData.yookassa_payment_id ?? sessionData.id

    if (!paymentId) {
      return {
        status: PaymentSessionStatus.PENDING,
        data: input.data,
      }
    }

    try {
      const payment = await this.client_.getPayment(paymentId)
      const updatedData = buildSessionDataFromPayment(payment, sessionData)

      return {
        status: mapYooKassaStatusToMedusa(
          payment.status
        ) as PaymentSessionStatus,
        data: updatedData as unknown as Record<string, unknown>,
      }
    } catch (error) {
      this.logger_.error(
        `Failed to get YooKassa payment status for ${paymentId}: ${error instanceof Error ? error.message : "unknown"}`
      )

      return {
        status: PaymentSessionStatus.PENDING,
        data: input.data,
      }
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const status = await this.getPaymentStatus(input)
    return { data: status.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const sessionData = (input.data ?? {}) as YooKassaSessionData
    const paymentId = sessionData.yookassa_payment_id ?? sessionData.id

    if (!paymentId) {
      return { data: input.data ?? {} }
    }

    try {
      const payment = await this.client_.cancelPayment(
        paymentId,
        sessionData.idempotence_key
      )

      return {
        data: buildSessionDataFromPayment(
          payment,
          sessionData
        ) as unknown as Record<string, unknown>,
      }
    } catch (error) {
      throw this.buildError("Failed to cancel YooKassa payment", error)
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.logger_.warn(
      "YooKassa refund via provider not implemented — extend with POST /refunds"
    )
    return { data: input.data ?? {} }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const status = await this.getPaymentStatus(input)
    return { data: status.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return this.initiatePayment({
      amount: input.amount,
      currency_code: input.currency_code,
      data: input.data,
      context: input.context,
    })
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }

  private buildReturnUrl(
    cartId?: string,
    countryCode?: string
  ): string {
    if (this.options_.returnUrl) {
      const url = new URL(this.options_.returnUrl)
      if (cartId) {
        url.searchParams.set("cart_id", cartId)
      }
      return url.toString()
    }

    const base = (this.options_.frontendUrl ?? "http://localhost:8000").replace(
      /\/$/,
      ""
    )
    const region = countryCode ?? "ru"
    const params = cartId ? `?cart_id=${encodeURIComponent(cartId)}` : ""

    return `${base}/${region}/payment/result${params}`
  }

  private buildError(message: string, error: unknown): Error {
    const detail = error instanceof Error ? error.message : String(error)
    return new Error(`${message}: ${detail}`)
  }
}

export default YooKassaProviderService
