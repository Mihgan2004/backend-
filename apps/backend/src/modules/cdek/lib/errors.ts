import { CdekApiError, CdekApiErrorItem, CdekErrorResponse } from "../types"

export function normalizeCdekError(
  statusCode: number,
  body: unknown
): CdekApiError {
  const parsed = (body ?? {}) as CdekErrorResponse
  const items: CdekApiErrorItem[] = parsed.errors ?? []

  const message =
    items[0]?.message ??
    parsed.message ??
    parsed.error ??
    `CDEK API error (${statusCode})`

  const code = items[0]?.code

  return new CdekApiError(message, statusCode, code, items)
}

export function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog)
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase()

      if (
        lower.includes("token") ||
        lower.includes("secret") ||
        lower.includes("password") ||
        lower.includes("authorization")
      ) {
        result[key] = "[REDACTED]"
        continue
      }

      result[key] = sanitizeForLog(val)
    }

    return result
  }

  return value
}
