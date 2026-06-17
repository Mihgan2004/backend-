import { BigNumberInput } from "@medusajs/framework/types"
import { BigNumber, MathBN } from "@medusajs/framework/utils"

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "OMR",
  "TND",
])

function getDecimalPlaces(currency: string): number {
  const code = currency.toUpperCase()

  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0
  }

  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3
  }

  return 2
}

export function formatAmountForYooKassa(
  amount: BigNumberInput,
  currency: string
): string {
  const decimals = getDecimalPlaces(currency)
  const numeric = new BigNumber(amount).numeric

  return numeric.toFixed(decimals)
}

export function parseYooKassaAmount(value: string): number {
  return new BigNumber(value).numeric
}

export function amountsMatch(
  medusaAmount: BigNumberInput,
  yookassaValue: string,
  currency: string
): boolean {
  const formatted = formatAmountForYooKassa(medusaAmount, currency)
  return formatted === yookassaValue
}
