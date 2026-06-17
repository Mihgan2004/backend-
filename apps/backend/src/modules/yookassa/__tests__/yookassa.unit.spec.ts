import {
  formatAmountForYooKassa,
  amountsMatch,
  parseYooKassaAmount,
} from "../lib/amount"
import { generateIdempotenceKey } from "../client"
import {
  hasActivePendingPayment,
  sanitizeSessionDataForStorefront,
  isPaidStatus,
  mapYooKassaStatusToMedusa,
} from "../lib/payment-data"
import { buildReceipt } from "../lib/receipt"

describe("formatAmountForYooKassa", () => {
  it('formats RUB amount as "1000.00"', () => {
    expect(formatAmountForYooKassa(1000, "RUB")).toBe("1000.00")
    expect(formatAmountForYooKassa("1290", "rub")).toBe("1290.00")
    expect(formatAmountForYooKassa(1290.5, "RUB")).toBe("1290.50")
  })

  it("matches medusa and yookassa amounts", () => {
    expect(amountsMatch(1000, "1000.00", "RUB")).toBe(true)
    expect(amountsMatch(1000, "1000.01", "RUB")).toBe(false)
  })

  it("parses yookassa amount strings", () => {
    expect(parseYooKassaAmount("1000.00")).toBe(1000)
  })
})

describe("idempotence key", () => {
  it("generates unique keys", () => {
    const a = generateIdempotenceKey()
    const b = generateIdempotenceKey()
    expect(a).not.toBe(b)
    expect(a.length).toBeLessThanOrEqual(64)
  })
})

describe("hasActivePendingPayment", () => {
  it("returns true for pending session with confirmation_url", () => {
    expect(
      hasActivePendingPayment({
        yookassa_payment_id: "pay-1",
        confirmation_url: "https://yoomoney.ru/pay",
        status: "pending",
      })
    ).toBe(true)
  })

  it("returns false when payment is canceled", () => {
    expect(
      hasActivePendingPayment({
        yookassa_payment_id: "pay-1",
        confirmation_url: "https://yoomoney.ru/pay",
        status: "canceled",
      })
    ).toBe(false)
  })
})

describe("buildReceipt", () => {
  it("returns undefined when receipts disabled", () => {
    expect(
      buildReceipt(
        { email: "a@b.com", currency_code: "RUB", items: [{ title: "X", quantity: 1, total: 100 }] },
        { receiptsEnabled: false, vatCode: 1 }
      )
    ).toBeUndefined()
  })

  it("returns undefined without email", () => {
    expect(
      buildReceipt(
        { currency_code: "RUB", items: [{ title: "X", quantity: 1, total: 100 }] },
        { receiptsEnabled: true, vatCode: 1 }
      )
    ).toBeUndefined()
  })

  it("builds receipt when enabled and email present", () => {
    const receipt = buildReceipt(
      {
        email: "customer@example.com",
        currency_code: "RUB",
        items: [{ title: "Товар", quantity: 1, total: 1000 }],
      },
      { receiptsEnabled: true, vatCode: 1 }
    )

    expect(receipt?.customer.email).toBe("customer@example.com")
    expect(receipt?.items[0].amount.value).toBe("1000.00")
    expect(receipt?.items[0].vat_code).toBe(1)
    expect(receipt?.items[0].payment_subject).toBe("commodity")
  })
})

describe("payment status mapping", () => {
  it("maps yookassa statuses to medusa", () => {
    expect(mapYooKassaStatusToMedusa("succeeded")).toBe("captured")
    expect(mapYooKassaStatusToMedusa("canceled")).toBe("canceled")
    expect(mapYooKassaStatusToMedusa("pending")).toBe("pending")
  })

  it("canceled does not mark as paid", () => {
    expect(isPaidStatus("canceled")).toBe(false)
    expect(isPaidStatus("succeeded")).toBe(true)
  })
})

describe("sanitizeSessionDataForStorefront", () => {
  it("returns only safe fields", () => {
    const safe = sanitizeSessionDataForStorefront({
      yookassa_payment_id: "pay-123",
      status: "pending",
      paid: false,
      confirmation_url: "https://yoomoney.ru/pay",
      idempotence_key: "secret-key",
      raw_response: { secret: true },
    })

    expect(safe).toEqual({
      paymentId: "pay-123",
      status: "pending",
      paid: false,
      confirmationUrl: "https://yoomoney.ru/pay",
    })
    expect(safe).not.toHaveProperty("idempotence_key")
    expect(safe).not.toHaveProperty("raw_response")
  })
})

describe("POST /payments payload shape", () => {
  it("builds expected payment body", () => {
    const payload = {
      amount: { value: formatAmountForYooKassa(1290, "RUB"), currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect" as const,
        return_url: "http://localhost:8000/ru/payment/result?cart_id=cart_1",
      },
      description: "Заказ (корзина) cart_1",
      metadata: {
        session_id: "payses_1",
        cart_id: "cart_1",
        payment_collection_id: "paycol_1",
      },
    }

    expect(payload.amount.value).toBe("1290.00")
    expect(payload.capture).toBe(true)
    expect(payload.confirmation.type).toBe("redirect")
    expect(payload.metadata.cart_id).toBe("cart_1")
  })
})
