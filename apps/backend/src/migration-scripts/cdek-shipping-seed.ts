import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

const CDEK_PROVIDER_ID = "fp_cdek_cdek"

export default async function cdekShippingSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id"],
    filters: { provider_id: CDEK_PROVIDER_ID },
  })

  if (existingOptions?.length) {
    logger.info("CDEK shipping options already exist, skipping seed")
    return
  }

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  const shippingProfile = shippingProfiles?.[0]

  if (!shippingProfile) {
    logger.warn("CDEK seed: no shipping profile found, skipping")
    return
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  const stockLocation = stockLocations?.[0]

  if (!stockLocation) {
    logger.warn("CDEK seed: no stock location found, skipping")
    return
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "CDEK Russia",
    type: "shipping",
    service_zones: [
      {
        name: "Russia",
        geo_zones: [
          {
            country_code: "ru",
            type: "country",
          },
        ],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  })

  const serviceZoneId = fulfillmentSet.service_zones[0].id

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "СДЭК ПВЗ",
        price_type: "calculated",
        provider_id: CDEK_PROVIDER_ID,
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        data: {
          id: "cdek_pickup",
        },
        type: {
          label: "СДЭК ПВЗ",
          description: "Доставка до пункта выдачи СДЭК",
          code: "cdek_pickup",
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "СДЭК курьером",
        price_type: "calculated",
        provider_id: CDEK_PROVIDER_ID,
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        data: {
          id: "cdek_courier",
        },
        type: {
          label: "СДЭК курьером",
          description: "Курьерская доставка СДЭК",
          code: "cdek_courier",
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  logger.info("CDEK shipping options seeded successfully")
}
