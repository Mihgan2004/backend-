import { YooKassaSessionData } from "../types"

export function hasActivePendingPayment(
  data?: Record<string, unknown> | null
): boolean {
  if (!data) {
    return false
  }

  const session = data as YooKassaSessionData

  return (
    !!session.yookassa_payment_id &&
    !!session.confirmation_url &&
    (session.status === "pending" ||
      session.status === "waiting_for_capture" ||
      !session.status)
  )
}

export function buildSessionDataFromPayment(
  payment: {
    id: string
    status: string
    paid: boolean
    amount: { value: string; currency: string }
    confirmation?: { confirmation_url?: string }
  },
  existing: YooKassaSessionData,
  rawResponse?: Record<string, unknown>
): YooKassaSessionData {
  return {
    ...existing,
    id: payment.id,
    yookassa_payment_id: payment.id,
    confirmation_url: payment.confirmation?.confirmation_url,
    status: payment.status,
    paid: payment.paid,
    amount_value: payment.amount.value,
    amount_currency: payment.amount.currency,
    raw_response: rawResponse ?? (payment as unknown as Record<string, unknown>),
  }
}

export function sanitizeSessionDataForStorefront(
  data?: YooKassaSessionData | null
): {
  paymentId?: string
  status?: string
  paid?: boolean
  confirmationUrl?: string
} {
  if (!data) {
    return {}
  }

  return {
    paymentId: data.yookassa_payment_id ?? data.id,
    status: data.status,
    paid: data.paid,
    confirmationUrl: data.confirmation_url,
  }
}

export function mapYooKassaStatusToMedusa(
  status: string
): "pending" | "authorized" | "captured" | "canceled" | "requires_more" {
  switch (status) {
    case "succeeded":
      return "captured"
    case "waiting_for_capture":
      return "authorized"
    case "canceled":
      return "canceled"
    case "pending":
    default:
      return "pending"
  }
}

export function isPaidStatus(status: string): boolean {
  return status === "succeeded"
}
