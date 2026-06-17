import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, PaymentActions } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/core-flows"
import { Logger } from "@medusajs/framework/types"
import { YooKassaClient } from "../client"
import {
  YooKassaPayment,
  YooKassaProviderOptions,
  YooKassaWebhookNotification,
} from "../types"
import { guardedCompleteCartAfterPayment } from "./guarded-completion"
import { buildSessionDataFromPayment } from "./payment-data"

const HANDLED_EVENTS = new Set([
  "payment.succeeded",
  "payment.canceled",
  "payment.waiting_for_capture",
  "refund.succeeded",
])

export async function handleYooKassaWebhook(
  container: MedusaContainer,
  notification: YooKassaWebhookNotification,
  client: YooKassaClient,
  logger?: Logger
): Promise<void> {
  const { event, object } = notification
  const paymentId = object?.id

  if (!paymentId) {
    logger?.warn("YooKassa webhook missing object.id")
    return
  }

  if (!HANDLED_EVENTS.has(event)) {
    logger?.info(`YooKassa webhook event ignored: ${event}`)
    return
  }

  logger?.info(`YooKassa webhook received: event=${event} paymentId=${paymentId}`)

  let payment: YooKassaPayment

  try {
    payment = await client.getPayment(paymentId)
  } catch (error) {
    logger?.error(
      `YooKassa webhook: failed to verify payment ${paymentId} via GET — ${error instanceof Error ? error.message : "unknown error"}`
    )
    return
  }

  const sessionId = payment.metadata?.session_id
  const cartId = payment.metadata?.cart_id

  if (!sessionId) {
    logger?.warn(
      `YooKassa webhook: payment ${paymentId} has no session_id in metadata`
    )
    return
  }

  const paymentModule = container.resolve(Modules.PAYMENT)
  let session

  try {
    session = await paymentModule.retrievePaymentSession(sessionId)
  } catch {
    logger?.warn(`YooKassa webhook: payment session ${sessionId} not found`)
    return
  }

  if (cartId && session.data?.cart_id && session.data.cart_id !== cartId) {
    logger?.error(
      `YooKassa webhook: cart_id mismatch for session ${sessionId}`
    )
    return
  }

  const updatedData = buildSessionDataFromPayment(
    payment,
    {
      ...(session.data as Record<string, unknown>),
      session_id: sessionId,
      cart_id: cartId ?? (session.data?.cart_id as string | undefined),
    },
    payment as unknown as Record<string, unknown>
  )

  await paymentModule.updatePaymentSession({
    id: sessionId,
    currency_code: session.currency_code,
    amount: session.amount,
    data: updatedData,
    status: mapWebhookStatusToSessionStatus(payment.status),
  })

  logger?.info(
    `YooKassa webhook: session ${sessionId} updated to status=${payment.status}`
  )

  if (payment.status === "succeeded" && cartId) {
    await guardedCompleteCartAfterPayment(container, {
      cartId,
      sessionId,
      amount: payment.amount.value,
      logger,
    })
    return
  }

  if (payment.status === "canceled") {
    await processPaymentWorkflow(container).run({
      input: {
        action: PaymentActions.CANCELED,
        data: {
          session_id: sessionId,
          amount: payment.amount.value,
        },
      },
    })
  }
}

function mapWebhookStatusToSessionStatus(
  status: YooKassaPayment["status"]
): "pending" | "authorized" | "captured" | "canceled" {
  switch (status) {
    case "succeeded":
      return "captured"
    case "waiting_for_capture":
      return "authorized"
    case "canceled":
      return "canceled"
    default:
      return "pending"
  }
}

export function parseYooKassaWebhookBody(
  body: unknown
): YooKassaWebhookNotification | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("event" in body) ||
    !("object" in body)
  ) {
    return null
  }

  return body as YooKassaWebhookNotification
}

export function createWebhookClient(
  options: YooKassaProviderOptions,
  logger?: Logger
): YooKassaClient {
  return new YooKassaClient(options, logger)
}
