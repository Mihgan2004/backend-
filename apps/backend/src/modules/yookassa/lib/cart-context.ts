import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export type CartPaymentContext = {
  cart_id?: string
  email?: string
  country_code?: string
  payment_collection_id?: string
  items?: Array<{
    title?: string
    quantity?: number
    unit_price?: number
    total?: number
  }>
}

export async function resolveCartContext(
  container: MedusaContainer,
  sessionId?: string
): Promise<CartPaymentContext> {
  if (!sessionId) {
    return {}
  }

  const query = container.resolve("query")
  const paymentModule = container.resolve(Modules.PAYMENT)

  let paymentCollectionId: string | undefined

  try {
    const session = await paymentModule.retrievePaymentSession(sessionId)
    paymentCollectionId = session.payment_collection_id
  } catch {
    return {}
  }

  const { data: cartLinks } = await query.graph({
    entity: "cart_payment_collection",
    fields: ["cart_id"],
    filters: { payment_collection_id: paymentCollectionId },
  })

  const cartId = (cartLinks?.[0] as { cart_id?: string } | undefined)?.cart_id

  if (!cartId) {
    return { payment_collection_id: paymentCollectionId }
  }

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "currency_code",
      "region.countries.iso_2",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "shipping_address.country_code",
    ],
    filters: { id: cartId },
  })

  const cart = carts?.[0] as
    | {
        id?: string
        email?: string
        currency_code?: string
        region?: { countries?: Array<{ iso_2?: string }> }
        items?: Array<{
          title?: string
          quantity?: number
          unit_price?: number
          total?: number
        }>
        shipping_address?: { country_code?: string }
      }
    | undefined

  if (!cart) {
    return { cart_id: cartId, payment_collection_id: paymentCollectionId }
  }

  const countryCode =
    cart.shipping_address?.country_code ??
    cart.region?.countries?.[0]?.iso_2

  return {
    cart_id: cartId,
    email: cart.email,
    country_code: countryCode?.toLowerCase(),
    payment_collection_id: paymentCollectionId,
    items: cart.items?.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
  }
}

export async function findPendingYooKassaSessionForCollection(
  container: MedusaContainer,
  paymentCollectionId: string,
  providerId: string
): Promise<{ data?: Record<string, unknown>; id?: string } | null> {
  const query = container.resolve("query")

  const { data: collection } = await query.graph({
    entity: "payment_collection",
    fields: ["payment_sessions.id", "payment_sessions.provider_id", "payment_sessions.status", "payment_sessions.data"],
    filters: { id: paymentCollectionId },
  })

  const sessions =
    (collection?.[0] as { payment_sessions?: Array<Record<string, unknown>> })
      ?.payment_sessions ?? []

  for (const session of sessions) {
    if (
      session.provider_id === providerId &&
      session.status === "pending" &&
      session.data &&
      typeof session.data === "object" &&
      (session.data as { yookassa_payment_id?: string }).yookassa_payment_id &&
      (session.data as { confirmation_url?: string }).confirmation_url
    ) {
      return session as { data?: Record<string, unknown>; id?: string }
    }
  }

  return null
}
