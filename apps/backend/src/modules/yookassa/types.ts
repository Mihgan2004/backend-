export type YooKassaProviderOptions = {
  shopId: string
  secretKey: string
  apiUrl?: string
  currency?: string
  returnUrl?: string
  frontendUrl?: string
  receiptsEnabled?: boolean
  vatCode?: number
  trustProxy?: boolean
  ipAllowlistEnabled?: boolean
}

export type YooKassaAmount = {
  value: string
  currency: string
}

export type YooKassaConfirmation = {
  type: string
  confirmation_url?: string
  return_url?: string
}

export type YooKassaPayment = {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  paid: boolean
  amount: YooKassaAmount
  confirmation?: YooKassaConfirmation
  description?: string
  metadata?: Record<string, string>
  created_at?: string
  captured_at?: string
  canceled_at?: string
}

export type YooKassaWebhookNotification = {
  type: "notification"
  event: string
  object: YooKassaPayment
}

export type YooKassaCreatePaymentParams = {
  amount: YooKassaAmount
  capture: boolean
  confirmation: {
    type: "redirect"
    return_url: string
  }
  description: string
  metadata: Record<string, string>
  receipt?: YooKassaReceipt
}

export type YooKassaReceiptItem = {
  description: string
  quantity: string
  amount: YooKassaAmount
  vat_code: number
  payment_subject: string
  payment_mode: string
}

export type YooKassaReceipt = {
  customer: {
    email: string
  }
  items: YooKassaReceiptItem[]
}

export type YooKassaSessionData = {
  id?: string
  yookassa_payment_id?: string
  idempotence_key?: string
  confirmation_url?: string
  status?: string
  paid?: boolean
  amount_value?: string
  amount_currency?: string
  session_id?: string
  cart_id?: string
  payment_collection_id?: string
  country_code?: string
  raw_response?: Record<string, unknown>
}

export class YooKassaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown,
    public readonly isIndeterminate = false
  ) {
    super(message)
    this.name = "YooKassaApiError"
  }
}
