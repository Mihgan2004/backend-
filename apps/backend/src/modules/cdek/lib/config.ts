import { CdekProviderOptions } from "../types"

const DEFAULT_BASE_URL = "https://api.edu.cdek.ru/v2"

export function getCdekOptionsFromEnv(): CdekProviderOptions {
  return {
    baseUrl: process.env.CDEK_BASE_URL ?? DEFAULT_BASE_URL,
    clientId: process.env.CDEK_CLIENT_ID ?? "",
    clientSecret: process.env.CDEK_CLIENT_SECRET ?? "",
    fromCityCode: Number(process.env.CDEK_FROM_CITY_CODE ?? "0"),
    fromPostalCode: process.env.CDEK_FROM_POSTAL_CODE ?? "",
    fromAddress: process.env.CDEK_FROM_ADDRESS ?? "",
    senderCompany: process.env.CDEK_SENDER_COMPANY ?? "",
    senderName: process.env.CDEK_SENDER_NAME ?? "",
    senderPhone: process.env.CDEK_SENDER_PHONE ?? "",
    tariffPickup: Number(process.env.CDEK_TARIFF_PICKUP ?? "0"),
    tariffCourier: Number(process.env.CDEK_TARIFF_COURIER ?? "0"),
    defaultWeightGrams: Number(process.env.CDEK_DEFAULT_WEIGHT_GRAMS ?? "500"),
    defaultLengthCm: Number(process.env.CDEK_DEFAULT_LENGTH_CM ?? "20"),
    defaultWidthCm: Number(process.env.CDEK_DEFAULT_WIDTH_CM ?? "15"),
    defaultHeightCm: Number(process.env.CDEK_DEFAULT_HEIGHT_CM ?? "10"),
    webhookSecret: process.env.CDEK_WEBHOOK_SECRET ?? "",
  }
}

export function cdekOptionsToProviderOptions(
  options: CdekProviderOptions
): CdekProviderOptions {
  return options
}
