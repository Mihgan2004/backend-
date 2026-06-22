import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import { createCdekClient } from "../../../../modules/cdek/client"
import { normalizeCity } from "../../../../modules/cdek/lib/normalize"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const query = req.query.query as string | undefined

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      message: "query parameter is required (min 2 characters)",
    })
  }

  try {
    const client = createCdekClient(undefined, logger)
    const cities = await client.searchCities(query.trim())
    return res.status(200).json({
      cities: cities.map(normalizeCity),
    })
  } catch (error) {
    logger.error(
      `CDEK cities search failed: ${error instanceof Error ? error.message : "unknown"}`
    )
    return res.status(502).json({
      message: "Failed to search CDEK cities",
    })
  }
}
