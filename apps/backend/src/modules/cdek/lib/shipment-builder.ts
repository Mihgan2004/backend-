import { aggregateFromCartItems } from "./dimensions"
import {
  CdekApiCreateOrderRequest,
  CdekDeliveryType,
  CdekProviderOptions,
  CdekShippingMethodData,
} from "../types"

type OrderAddress = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  phone?: string | null
  postal_code?: string | null
}

type OrderItem = {
  id?: string
  title?: string
  quantity: number | string
  unit_price?: number | string
  variant?: {
    weight?: number | null
    length?: number | null
    width?: number | null
    height?: number | null
    sku?: string | null
  } | null
  product?: {
    weight?: number | null
    length?: number | null
    width?: number | null
    height?: number | null
  } | null
}

export type BuildCdekOrderInput = {
  orderId: string
  displayId?: number | string
  shippingData: CdekShippingMethodData
  shippingAddress?: OrderAddress | null
  email?: string | null
  items: OrderItem[]
  options: CdekProviderOptions
}

export function buildCdekOrderPayload(
  input: BuildCdekOrderInput
): CdekApiCreateOrderRequest {
  const { shippingData, options } = input
  const packages = aggregateFromCartItems(input.items, options)
  const recipientName = formatRecipientName(input.shippingAddress)
  const recipientPhone =
    input.shippingAddress?.phone?.trim() || options.senderPhone

  const payload: CdekApiCreateOrderRequest = {
    type: 1,
    number: String(input.displayId ?? input.orderId),
    tariff_code: shippingData.tariff_code,
    from_location: {
      code: options.fromCityCode,
      postal_code: options.fromPostalCode || undefined,
      address: options.fromAddress || undefined,
    },
    to_location: {
      code: shippingData.cdek_city_code,
    },
    sender: {
      company: options.senderCompany || undefined,
      name: options.senderName,
      phones: [{ number: options.senderPhone }],
    },
    recipient: {
      name: recipientName,
      phones: [{ number: recipientPhone }],
    },
    packages: packages.map((pkg, index) => ({
      number: `${input.orderId}-${index + 1}`,
      weight: pkg.weight,
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
    })),
  }

  if (shippingData.delivery_type === "pickup") {
    payload.delivery_point = shippingData.delivery_point_code
    payload.to_location.delivery_point = shippingData.delivery_point_code
    if (shippingData.delivery_point_address) {
      payload.to_location.address = shippingData.delivery_point_address
    }
  } else {
    const address =
      shippingData.address ?? formatAddress(input.shippingAddress)
    payload.to_location.address = address
  }

  return payload
}

export function getTariffCodeForDeliveryType(
  deliveryType: CdekDeliveryType,
  options: CdekProviderOptions
): number {
  return deliveryType === "pickup"
    ? options.tariffPickup
    : options.tariffCourier
}

function formatRecipientName(address?: OrderAddress | null): string {
  const parts = [address?.first_name, address?.last_name].filter(Boolean)
  return parts.join(" ").trim() || "Получатель"
}

function formatAddress(address?: OrderAddress | null): string {
  if (!address) {
    return ""
  }

  const parts = [
    address.address_1,
    address.address_2,
    address.city,
    address.postal_code,
  ].filter(Boolean)

  return parts.join(", ")
}
