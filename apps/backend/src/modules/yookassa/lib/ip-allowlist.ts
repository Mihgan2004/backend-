import { isIP } from "net"

const YOOKASSA_IPV4_CIDRS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
]

const YOOKASSA_IPV6_PREFIX = "2a02:5180:"

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")

  if (parts.length !== 4) {
    return null
  }

  let value = 0

  for (const part of parts) {
    const octet = Number(part)

    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null
    }

    value = (value << 8) + octet
  }

  return value >>> 0
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr
  }

  const [network, prefixLengthRaw] = cidr.split("/")
  const prefixLength = Number(prefixLengthRaw)
  const ipInt = ipv4ToInt(ip)
  const networkInt = ipv4ToInt(network)

  if (ipInt === null || networkInt === null || Number.isNaN(prefixLength)) {
    return false
  }

  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0

  return (ipInt & mask) === (networkInt & mask)
}

function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7)
  }

  return ip
}

export function isYooKassaIp(ip: string): boolean {
  const normalized = normalizeIp(ip)

  if (isIP(normalized) === 4) {
    return YOOKASSA_IPV4_CIDRS.some((cidr) => isIpv4InCidr(normalized, cidr))
  }

  if (isIP(normalized) === 6) {
    return normalized.toLowerCase().startsWith(YOOKASSA_IPV6_PREFIX)
  }

  return false
}

export function resolveClientIp(
  headers: Record<string, unknown>,
  socketIp?: string,
  trustProxy = false
): string | undefined {
  if (trustProxy) {
    const forwarded = headers["x-forwarded-for"]

    if (typeof forwarded === "string" && forwarded.length) {
      return forwarded.split(",")[0]?.trim()
    }
  }

  return socketIp
}
