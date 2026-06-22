import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { createCdekClient } from "../modules/cdek/client"
import { getCdekOptionsFromEnv } from "../modules/cdek/lib/config"
import { buildCdekOrderPayload } from "../modules/cdek/lib/shipment-builder"
import { CDEK_MODULE } from "../modules/cdek"
import CdekModuleService from "../modules/cdek/service"
import { CdekShippingMethodData } from "../modules/cdek/types"

const CDEK_PROVIDER_ID = "fp_cdek_cdek"

export default async function cdekOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cdekModuleService = container.resolve<CdekModuleService>(CDEK_MODULE)

  const orderId = data.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "shipping_address.*",
      "items.*",
      "items.variant.*",
      "items.product.*",
      "shipping_methods.*",
      "shipping_methods.shipping_option.*",
      "shipping_methods.shipping_option.provider_id",
      "shipping_methods.data",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0] as unknown as
    | {
        id: string
        display_id?: number | string
        email?: string | null
        shipping_address?: Record<string, unknown> | null
        items?: Array<Record<string, unknown>>
        shipping_methods?: Array<{
          data?: CdekShippingMethodData
          shipping_option?: { provider_id?: string }
        }>
      }
    | undefined

  if (!order) {
    logger.warn(`CDEK subscriber: order ${orderId} not found`)
    return
  }

  const shippingMethod = order.shipping_methods?.find((method) => {
    if (method.shipping_option?.provider_id === CDEK_PROVIDER_ID) {
      return true
    }

    const data = method.data as CdekShippingMethodData | undefined
    return Boolean(data?.delivery_type && data?.cdek_city_code)
  })

  if (!shippingMethod?.data) {
    return
  }

  const existing = await cdekModuleService.listCdekShipments({
    order_id: orderId,
  })

  if (existing.length > 0 && existing[0].cdek_uuid) {
    logger.info(
      `CDEK shipment already exists for order ${orderId}, skipping creation`
    )
    return
  }

  const options = getCdekOptionsFromEnv()
  const client = createCdekClient(options, logger)
  const shippingData = shippingMethod.data as CdekShippingMethodData

  const requestPayload = buildCdekOrderPayload({
    orderId,
    displayId: order.display_id,
    shippingData,
    shippingAddress: order.shipping_address as Parameters<
      typeof buildCdekOrderPayload
    >[0]["shippingAddress"],
    email: order.email,
    items: (order.items ?? []) as Parameters<
      typeof buildCdekOrderPayload
    >[0]["items"],
    options,
  })

  let shipmentRecord = existing[0]

  if (!shipmentRecord) {
    shipmentRecord = await cdekModuleService.createCdekShipments({
      order_id: orderId,
      delivery_type: shippingData.delivery_type,
      tariff_code: shippingData.tariff_code,
      delivery_point_code: shippingData.delivery_point_code ?? null,
      status: "pending",
      request_payload: requestPayload,
      attempts: 0,
    })
  }

  try {
    const response = await client.createOrder(requestPayload)
    const entity = response.entity

    await cdekModuleService.updateCdekShipments({
      id: shipmentRecord.id,
      cdek_uuid: entity?.uuid ?? null,
      cdek_number: entity?.cdek_number ?? null,
      status: entity?.statuses?.[0]?.code ?? "created",
      response_payload: response,
      last_error: null,
      attempts: (shipmentRecord.attempts ?? 0) + 1,
    })

    logger.info(
      `CDEK order created for ${orderId}: uuid=${entity?.uuid ?? "unknown"}`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"

    await cdekModuleService.updateCdekShipments({
      id: shipmentRecord.id,
      last_error: message,
      attempts: (shipmentRecord.attempts ?? 0) + 1,
    })

    logger.error(`CDEK order creation failed for ${orderId}: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
