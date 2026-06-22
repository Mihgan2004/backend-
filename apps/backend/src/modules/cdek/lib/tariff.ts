import { aggregatePackages } from "./dimensions"
import { getTariffCodeForDeliveryType } from "./shipment-builder"
import { CdekClient } from "../client"
import {
  CdekApiTariffRequest,
  CdekProviderOptions,
  CdekTariffCalculateRequest,
  CdekTariffCalculateResponse,
} from "../types"

export async function calculateCdekTariff(
  client: CdekClient,
  options: CdekProviderOptions,
  input: CdekTariffCalculateRequest
): Promise<CdekTariffCalculateResponse> {
  const tariffCode = getTariffCodeForDeliveryType(input.delivery_type, options)
  const packages = aggregatePackages(input.items, options)

  const payload: CdekApiTariffRequest = {
    type: 1,
    tariff_code: tariffCode,
    from_location: {
      code: options.fromCityCode,
      postal_code: options.fromPostalCode || undefined,
      address: options.fromAddress || undefined,
    },
    to_location: {
      code: input.city_code,
    },
    packages,
  }

  if (input.delivery_type === "pickup") {
    if (!input.delivery_point_code) {
      throw new Error("delivery_point_code is required for pickup delivery")
    }
    payload.to_location.delivery_point = input.delivery_point_code
  } else {
    if (!input.address) {
      throw new Error("address is required for courier delivery")
    }
    payload.to_location.address = input.address
  }

  const result = await client.calculateTariff(payload)

  return {
    price: result.delivery_sum,
    period_min: result.period_min,
    period_max: result.period_max,
    tariff_code: result.tariff_code ?? tariffCode,
  }
}
