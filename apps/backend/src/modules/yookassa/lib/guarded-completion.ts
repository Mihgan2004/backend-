import { MedusaContainer } from "@medusajs/framework/types"
import { completeCartWorkflow, processPaymentWorkflow } from "@medusajs/core-flows"
import { PaymentActions } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"

type GuardedCompletionInput = {
  cartId: string
  sessionId: string
  amount: number | string
  logger?: Logger
}

export async function getOrderIdByCartId(
  container: MedusaContainer,
  cartId: string
): Promise<string | undefined> {
  const query = container.resolve("query")

  const { data } = await query.graph({
    entity: "order_cart",
    fields: ["order_id"],
    filters: { cart_id: cartId },
  })

  const link = data?.[0] as { order_id?: string } | undefined

  return link?.order_id
}

export async function guardedCompleteCartAfterPayment(
  container: MedusaContainer,
  input: GuardedCompletionInput
): Promise<{ orderId?: string; alreadyCompleted: boolean }> {
  const existingOrderId = await getOrderIdByCartId(container, input.cartId)

  if (existingOrderId) {
    input.logger?.info(
      `Cart ${input.cartId} already completed as order ${existingOrderId}, skipping completion`
    )
    return { orderId: existingOrderId, alreadyCompleted: true }
  }

  await processPaymentWorkflow(container).run({
    input: {
      action: PaymentActions.SUCCESSFUL,
      data: {
        session_id: input.sessionId,
        amount: input.amount,
      },
    },
  })

  const orderId = await getOrderIdByCartId(container, input.cartId)

  if (orderId) {
    input.logger?.info(
      `Cart ${input.cartId} completed as order ${orderId} after payment`
    )
    return { orderId, alreadyCompleted: false }
  }

  return { alreadyCompleted: false }
}

export async function completeCartIfNotExists(
  container: MedusaContainer,
  cartId: string,
  logger?: Logger
): Promise<{ orderId?: string; alreadyCompleted: boolean }> {
  const existingOrderId = await getOrderIdByCartId(container, cartId)

  if (existingOrderId) {
    logger?.info(
      `Cart ${cartId} already has order ${existingOrderId}, skipping completeCartWorkflow`
    )
    return { orderId: existingOrderId, alreadyCompleted: true }
  }

  const { result } = await completeCartWorkflow(container).run({
    input: { id: cartId },
  })

  logger?.info(`Cart ${cartId} completed as order ${result.id}`)

  return { orderId: result.id, alreadyCompleted: false }
}
