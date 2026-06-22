import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { createCdekClient } from "../client"
import { rublesToMinorUnits } from "../lib/dimensions"
import { calculateCdekTariff } from "../lib/tariff"
import {
  CdekDeliveryType,
  CdekProviderOptions,
  CdekShippingMethodData,
} from "../types"

type InjectedDependencies = {
  logger: Logger
}

const CDEK_PICKUP_OPTION = "cdek_pickup"
const CDEK_COURIER_OPTION = "cdek_courier"

class CdekFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "cdek"

  protected logger_: Logger
  protected options_: CdekProviderOptions
  protected client_

  constructor({ logger }: InjectedDependencies, options: CdekProviderOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = createCdekClient(options, logger)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: CDEK_PICKUP_OPTION,
        name: "СДЭК ПВЗ",
      },
      {
        id: CDEK_COURIER_OPTION,
        name: "СДЭК курьером",
      },
    ]
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<CdekShippingMethodData> {
    const optionId = String(optionData.id ?? data.option_id ?? "")
    const deliveryType = resolveDeliveryType(optionId, data)

    const cdekCityCode = Number(data.cdek_city_code)
    if (!cdekCityCode) {
      throw new Error("cdek_city_code is required")
    }

    const tariffCode = Number(data.tariff_code)
    if (!tariffCode) {
      throw new Error("tariff_code is required")
    }

    if (deliveryType === "pickup" && !data.delivery_point_code) {
      throw new Error("delivery_point_code is required for pickup delivery")
    }

    if (deliveryType === "courier" && !data.address) {
      throw new Error("address is required for courier delivery")
    }

    return {
      delivery_type: deliveryType,
      tariff_code: tariffCode,
      cdek_city_code: cdekCityCode,
      delivery_point_code: data.delivery_point_code as string | undefined,
      delivery_point_address: data.delivery_point_address as string | undefined,
      delivery_point_name: data.delivery_point_name as string | undefined,
      address: data.address as string | undefined,
      period_min: data.period_min !== undefined ? Number(data.period_min) : undefined,
      period_max: data.period_max !== undefined ? Number(data.period_max) : undefined,
    }
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const optionId = String(optionData?.id ?? "")
    const deliveryType = resolveDeliveryType(optionId, data ?? {})
    const shippingData = data as CdekShippingMethodData | undefined

    const cityCode = Number(shippingData?.cdek_city_code)
    if (!cityCode) {
      throw new Error("cdek_city_code is required to calculate CDEK price")
    }

    const items = context.items?.map((item) => ({
      quantity: Number(item.quantity),
      weight: item.variant?.weight
        ? Math.round(Number(item.variant.weight))
        : undefined,
      length: item.variant?.length
        ? Math.round(Number(item.variant.length))
        : undefined,
      width: item.variant?.width
        ? Math.round(Number(item.variant.width))
        : undefined,
      height: item.variant?.height
        ? Math.round(Number(item.variant.height))
        : undefined,
    }))

    const result = await calculateCdekTariff(this.client_, this.options_, {
      delivery_type: deliveryType,
      city_code: cityCode,
      delivery_point_code: shippingData?.delivery_point_code,
      address:
        shippingData?.address ??
        formatContextAddress(context.shipping_address),
      items,
    })

    return {
      calculated_amount: rublesToMinorUnits(result.price),
      is_calculated_price_tax_inclusive: true,
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    _order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: {
        ...data,
      },
      labels: [],
    }
  }

  async cancelFulfillment(_data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {}
  }
}

function resolveDeliveryType(
  optionId: string,
  data: Record<string, unknown>
): CdekDeliveryType {
  if (data.delivery_type === "pickup" || data.delivery_type === "courier") {
    return data.delivery_type
  }

  if (optionId.includes("courier")) {
    return "courier"
  }

  return "pickup"
}

function formatContextAddress(
  address?: CalculateShippingOptionPriceDTO["context"]["shipping_address"]
): string {
  if (!address) {
    return ""
  }

  return [address.address_1, address.address_2, address.city, address.postal_code]
    .filter(Boolean)
    .join(", ")
}

export default CdekFulfillmentProviderService
