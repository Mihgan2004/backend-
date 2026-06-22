import {
  CdekApiCity,
  CdekApiDeliveryPoint,
  CdekCity,
  CdekDeliveryPoint,
} from "../types"

export function normalizeCity(city: CdekApiCity): CdekCity {
  return {
    code: city.code,
    city: city.city,
    region: city.region,
    country: city.country,
  }
}

export function normalizeDeliveryPoint(
  point: CdekApiDeliveryPoint
): CdekDeliveryPoint {
  const phones =
    point.phones
      ?.map((phone) => phone.number)
      .filter((phone): phone is string => Boolean(phone)) ?? []

  return {
    code: point.code,
    name: point.name,
    address: point.location?.address ?? "",
    city: point.location?.city ?? "",
    workTime: point.work_time,
    phones: phones.length ? phones : undefined,
    location:
      point.location?.latitude !== undefined &&
      point.location?.longitude !== undefined
        ? {
            latitude: point.location.latitude,
            longitude: point.location.longitude,
          }
        : undefined,
  }
}
