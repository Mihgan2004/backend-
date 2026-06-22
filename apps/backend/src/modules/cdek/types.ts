export type CdekProviderOptions = {
  baseUrl: string
  clientId: string
  clientSecret: string
  fromCityCode: number
  fromPostalCode: string
  fromAddress: string
  senderCompany: string
  senderName: string
  senderPhone: string
  tariffPickup: number
  tariffCourier: number
  defaultWeightGrams: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
  webhookSecret: string
}

export type CdekDeliveryType = "pickup" | "courier"

export type CdekCity = {
  code: number
  city: string
  region?: string
  country?: string
  country_code?: string
}

export type CdekDeliveryPoint = {
  code: string
  name: string
  address: string
  city: string
  workTime?: string
  phones?: string[]
  location?: {
    latitude: number
    longitude: number
  }
}

export type CdekPackageItem = {
  quantity: number
  weight?: number
  length?: number
  width?: number
  height?: number
}

export type CdekTariffCalculateRequest = {
  delivery_type: CdekDeliveryType
  city_code: number
  delivery_point_code?: string
  address?: string
  items?: CdekPackageItem[]
}

export type CdekTariffCalculateResponse = {
  price: number
  period_min?: number
  period_max?: number
  tariff_code: number
}

export type CdekShippingMethodData = {
  delivery_type: CdekDeliveryType
  tariff_code: number
  cdek_city_code: number
  delivery_point_code?: string
  delivery_point_address?: string
  delivery_point_name?: string
  address?: string
  period_min?: number
  period_max?: number
}

export type CdekApiCity = {
  code: number
  city: string
  region?: string
  country?: string
  country_code?: string
}

export type CdekApiDeliveryPoint = {
  code: string
  name: string
  location?: {
    address?: string
    city?: string
    latitude?: number
    longitude?: number
  }
  work_time?: string
  phones?: Array<{ number?: string }>
}

export type CdekApiTariffRequest = {
  type: number
  tariff_code: number
  from_location: {
    code: number
    postal_code?: string
    address?: string
  }
  to_location: {
    code: number
    address?: string
    delivery_point?: string
  }
  packages: Array<{
    weight: number
    length: number
    width: number
    height: number
  }>
}

export type CdekApiTariffResponse = {
  delivery_sum: number
  period_min?: number
  period_max?: number
  tariff_code?: number
}

export type CdekApiCreateOrderRequest = {
  type: number
  number: string
  tariff_code: number
  shipment_point?: string
  delivery_point?: string
  from_location: {
    code: number
    postal_code?: string
    address?: string
  }
  to_location: {
    code: number
    address?: string
    delivery_point?: string
  }
  sender: {
    company?: string
    name: string
    phones: Array<{ number: string }>
  }
  recipient: {
    name: string
    phones: Array<{ number: string }>
  }
  packages: Array<{
    number: string
    weight: number
    length: number
    width: number
    height: number
    items?: Array<{
      name: string
      ware_key: string
      payment: { value: number }
      cost: number
      weight: number
      amount: number
    }>
  }>
}

export type CdekApiOrderEntity = {
  uuid: string
  cdek_number?: string
  statuses?: Array<{
    code?: string
    name?: string
    date_time?: string
  }>
}

export type CdekApiCreateOrderResponse = {
  entity?: CdekApiOrderEntity
  requests?: Array<{
    request_uuid?: string
    type?: string
    state?: string
    errors?: CdekApiErrorItem[]
  }>
}

export type CdekApiErrorItem = {
  code?: string
  message?: string
}

export type CdekErrorResponse = {
  errors?: CdekApiErrorItem[]
  error?: string
  message?: string
}

export type CdekWebhookPayload = {
  uuid?: string
  cdek_number?: string
  type?: string
  attributes?: {
    code?: string
    status_code?: string
    status_date_time?: string
    cdek_number?: string
    is_return?: boolean
    is_reverse?: boolean
  }
}

export class CdekApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: CdekApiErrorItem[]
  ) {
    super(message)
    this.name = "CdekApiError"
  }
}
