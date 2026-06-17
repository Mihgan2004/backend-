import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import {
  createYooKassaClient,
  getYooKassaOptionsFromEnv,
} from "../../../../modules/yookassa/client"
import { guardedCompleteCartAfterPayment, getOrderIdByCartId } from "../../../../modules/yookassa/lib/guarded-completion"
import {
  isPaidStatus,
  sanitizeSessionDataForStorefront,
} from "../../../../modules/yookassa/lib/payment-data"
import { YooKassaSessionData } from "../../../../modules/yookassa/types"

const YOOKASSA_PROVIDER_ID = "pp_yookassa_yookassa"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const cartId = req.query.cart_id as string | undefined
  const orderIdQuery = req.query.order_id as string | undefined

  if (!cartId && !orderIdQuery) {
    return res.status(400).json({
      message: "cart_id or order_id query parameter is required",
    })
  }

  const query = req.scope.resolve("query")
  const paymentModule = req.scope.resolve(Modules.PAYMENT)
  const options = getYooKassaOptionsFromEnv()
  const client = createYooKassaClient(options, logger)

  let resolvedCartId = cartId
  let resolvedOrderId = orderIdQuery

  if (orderIdQuery && !cartId) {
    const { data: orderLinks } = await query.graph({
      entity: "order_cart",
      fields: ["cart_id"],
      filters: { order_id: orderIdQuery },
    })

    resolvedCartId = (orderLinks?.[0] as { cart_id?: string } | undefined)
      ?.cart_id
  }

  if (resolvedCartId && !resolvedOrderId) {
    resolvedOrderId = await getOrderIdByCartId(req.scope, resolvedCartId)
  }

  let sessionData: YooKassaSessionData | undefined
  let sessionId: string | undefined

  if (resolvedCartId) {
    const { data: cartLinks } = await query.graph({
      entity: "cart_payment_collection",
      fields: ["payment_collection_id"],
      filters: { cart_id: resolvedCartId },
    })

    const paymentCollectionId = (
      cartLinks?.[0] as { payment_collection_id?: string } | undefined
    )?.payment_collection_id

    if (paymentCollectionId) {
      const { data: collections } = await query.graph({
        entity: "payment_collection",
        fields: [
          "payment_sessions.id",
          "payment_sessions.provider_id",
          "payment_sessions.data",
          "payment_sessions.status",
          "payment_sessions.created_at",
        ],
        filters: { id: paymentCollectionId },
      })

      const sessions =
        (
          collections?.[0] as {
            payment_sessions?: Array<{
              id: string
              provider_id: string
              data?: YooKassaSessionData
              status?: string
              created_at?: string
            }>
          }
        )?.payment_sessions ?? []

      const yookassaSessions = sessions
        .filter((s) => s.provider_id === YOOKASSA_PROVIDER_ID)
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
        )

      const latest = yookassaSessions[0]

      if (latest) {
        sessionId = latest.id
        sessionData = latest.data
      }
    }
  }

  if (!sessionData?.yookassa_payment_id && !sessionData?.id) {
    return res.status(404).json({
      message: "No YooKassa payment attempt found",
    })
  }

  const paymentId = sessionData.yookassa_payment_id ?? sessionData.id!

  let status = sessionData.status ?? "pending"
  let paid = sessionData.paid ?? false
  let confirmationUrl = sessionData.confirmation_url

  try {
    const payment = await client.getPayment(paymentId)
    status = payment.status
    paid = payment.paid
    confirmationUrl = payment.confirmation?.confirmation_url ?? confirmationUrl

    if (sessionId) {
      await paymentModule.updatePaymentSession({
        id: sessionId,
        currency_code: payment.amount.currency,
        amount: payment.amount.value,
        data: {
          ...sessionData,
          yookassa_payment_id: payment.id,
          status: payment.status,
          paid: payment.paid,
          confirmation_url: confirmationUrl,
        },
      })
    }

    if (
      isPaidStatus(payment.status) &&
      resolvedCartId &&
      sessionId &&
      !resolvedOrderId
    ) {
      const completion = await guardedCompleteCartAfterPayment(req.scope, {
        cartId: resolvedCartId,
        sessionId,
        amount: payment.amount.value,
        logger,
      })

      resolvedOrderId = completion.orderId
      paid = true
    }
  } catch (error) {
    logger.warn(
      `Could not refresh YooKassa payment ${paymentId}: ${error instanceof Error ? error.message : "unknown"}`
    )
  }

  const safe = sanitizeSessionDataForStorefront({
    ...sessionData,
    status,
    paid,
    confirmation_url: confirmationUrl,
    yookassa_payment_id: paymentId,
  })

  return res.status(200).json({
    orderId: resolvedOrderId,
    paymentId: safe.paymentId,
    status,
    paid,
    confirmationUrl: safe.confirmationUrl,
  })
}
