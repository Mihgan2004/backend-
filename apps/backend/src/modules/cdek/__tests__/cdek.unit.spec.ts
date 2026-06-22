import { normalizeCdekError } from "../lib/errors"
import { rublesToMinorUnits } from "../lib/dimensions"
import { normalizeCity } from "../lib/normalize"
import { CdekApiError } from "../types"

describe("CDEK helpers", () => {
  it("normalizes city response", () => {
    expect(
      normalizeCity({
        code: 44,
        city: "Москва",
        region: "Москва",
        country: "Россия",
      })
    ).toEqual({
      code: 44,
      city: "Москва",
      region: "Москва",
      country: "Россия",
    })
  })

  it("converts rubles to minor units", () => {
    expect(rublesToMinorUnits(420)).toBe(42000)
    expect(rublesToMinorUnits(420.5)).toBe(42050)
  })

  it("normalizes CDEK API errors", () => {
    const error = normalizeCdekError(400, {
      errors: [{ code: "v2_invalid_value", message: "Invalid city code" }],
    })

    expect(error).toBeInstanceOf(CdekApiError)
    expect(error.message).toBe("Invalid city code")
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe("v2_invalid_value")
  })
})
