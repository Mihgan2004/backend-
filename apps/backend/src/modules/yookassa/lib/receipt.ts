import {
  YooKassaCreatePaymentParams,
  YooKassaProviderOptions,
  YooKassaReceipt,
} from "../types"
import { formatAmountForYooKassa } from "./amount"

type ReceiptLineItem = {
  title?: string
  quantity?: number | string
  unit_price?: number | string
  total?: number | string
}

type ReceiptCartContext = {
  email?: string | null
  currency_code: string
  items?: ReceiptLineItem[]
}

/**
 * Legal receipt settings — configure for your store's tax scheme before enabling
 * YOOKASSA_RECEIPTS_ENABLED in production.
 *
 * TODO (legal): set vat_code per product/category (currently from YOOKASSA_VAT_CODE env)
 * TODO (legal): set payment_subject per item type (commodity / service / etc.)
 * TODO (legal): set payment_mode (full_payment / partial_payment / etc.)
 */
const DEFAULT_PAYMENT_SUBJECT = "commodity"
const DEFAULT_PAYMENT_MODE = "full_payment"

export function buildReceipt(
  cart: ReceiptCartContext,
  options: Pick<YooKassaProviderOptions, "receiptsEnabled" | "vatCode">
): YooKassaReceipt | undefined {
  if (!options.receiptsEnabled) {
    return undefined
  }

  const email = cart.email?.trim()

  if (!email) {
    return undefined
  }

  const vatCode = options.vatCode ?? 1
  const currency = cart.currency_code.toUpperCase()
  const items = cart.items ?? []

  if (!items.length) {
    return undefined
  }

  return {
    customer: { email },
    items: items.map((item) => {
      const quantity = Number(item.quantity ?? 1)
      const unitPrice = Number(item.unit_price ?? item.total ?? 0)
      const lineTotal = Number(item.total ?? unitPrice * quantity)

      return {
        description: (item.title ?? "Товар").slice(0, 128),
        quantity: quantity.toFixed(2),
        amount: {
          value: formatAmountForYooKassa(lineTotal, currency),
          currency,
        },
        vat_code: vatCode,
        payment_subject: DEFAULT_PAYMENT_SUBJECT,
        payment_mode: DEFAULT_PAYMENT_MODE,
      }
    }),
  }
}

export function attachReceiptToPaymentParams(
  params: YooKassaCreatePaymentParams,
  receipt?: YooKassaReceipt
): YooKassaCreatePaymentParams {
  if (!receipt) {
    return params
  }

  return { ...params, receipt }
}
