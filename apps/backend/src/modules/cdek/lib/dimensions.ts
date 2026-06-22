import { CdekPackageItem, CdekProviderOptions } from "../types"

export type CartItemDimensions = {
  quantity: number
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type AggregatedPackage = {
  weight: number
  length: number
  width: number
  height: number
}

type VariantDimensions = {
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
}

export function aggregatePackages(
  items: CdekPackageItem[] | undefined,
  options: CdekProviderOptions
): AggregatedPackage[] {
  if (!items?.length) {
    return [
      {
        weight: options.defaultWeightGrams,
        length: options.defaultLengthCm,
        width: options.defaultWidthCm,
        height: options.defaultHeightCm,
      },
    ]
  }

  return items.map((item) => ({
    weight: item.weight ?? options.defaultWeightGrams,
    length: item.length ?? options.defaultLengthCm,
    width: item.width ?? options.defaultWidthCm,
    height: item.height ?? options.defaultHeightCm,
  }))
}

export function aggregateFromCartItems(
  items: Array<{
    quantity: number | string
    variant?: VariantDimensions | null
    product?: VariantDimensions | null
  }>,
  options: CdekProviderOptions
): AggregatedPackage[] {
  if (!items.length) {
    return aggregatePackages(undefined, options)
  }

  const packages: AggregatedPackage[] = []

  for (const item of items) {
    const quantity = Number(item.quantity) || 1
    const source = item.variant ?? item.product

    const weightGrams = source?.weight
      ? Math.round(Number(source.weight))
      : options.defaultWeightGrams

    const lengthCm = source?.length
      ? Math.round(Number(source.length))
      : options.defaultLengthCm

    const widthCm = source?.width
      ? Math.round(Number(source.width))
      : options.defaultWidthCm

    const heightCm = source?.height
      ? Math.round(Number(source.height))
      : options.defaultHeightCm

    for (let i = 0; i < quantity; i++) {
      packages.push({
        weight: weightGrams,
        length: lengthCm,
        width: widthCm,
        height: heightCm,
      })
    }
  }

  return packages.length
    ? packages
    : aggregatePackages(undefined, options)
}

export function rublesToMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}
