import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import {
  createYooKassaClient,
  getYooKassaOptionsFromEnv,
} from "../../../modules/yookassa/client"
import {
  handleYooKassaWebhook,
  parseYooKassaWebhookBody,
} from "../../../modules/yookassa/lib/webhook-handler"
import {
  isYooKassaIp,
  resolveClientIp,
} from "../../../modules/yookassa/lib/ip-allowlist"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const options = getYooKassaOptionsFromEnv()

  if (options.ipAllowlistEnabled) {
    const clientIp = resolveClientIp(
      req.headers as Record<string, unknown>,
      req.socket?.remoteAddress,
      options.trustProxy
    )

    if (!clientIp || !isYooKassaIp(clientIp)) {
      logger.warn(`YooKassa webhook rejected: IP not allowed (${clientIp ?? "unknown"})`)
      return res.sendStatus(403)
    }
  }

  const notification = parseYooKassaWebhookBody(req.body)

  if (!notification) {
    logger.warn("YooKassa webhook: invalid body")
    return res.sendStatus(200)
  }

  try {
    const client = createYooKassaClient(options, logger)
    await handleYooKassaWebhook(req.scope, notification, client, logger)
  } catch (error) {
    logger.error(
      `YooKassa webhook processing error: ${error instanceof Error ? error.message : "unknown"}`
    )
  }

  return res.sendStatus(200)
}
