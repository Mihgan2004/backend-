import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import { createCdekClient } from "../../../../modules/cdek/client"
import { normalizeDeliveryPoint } from "../../../../modules/cdek/lib/normalize"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const cityCode = Number(req.query.city_code)

  if (!cityCode) {
    return res.status(400).json({
      message: "city_code query parameter is required",
    })
  }

  try {
    const client = createCdekClient(undefined, logger)
    const points = await client.listDeliveryPoints(cityCode)
    return res.status(200).json({
      delivery_points: points.map(normalizeDeliveryPoint),
    })
  } catch (error) {
    logger.error(
      `CDEK delivery points fetch failed: ${error instanceof Error ? error.message : "unknown"}`
    )
    return res.status(502).json({
      message: "Failed to load CDEK delivery points",
    })
  }
}
