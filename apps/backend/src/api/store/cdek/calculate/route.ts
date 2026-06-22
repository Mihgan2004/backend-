import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import { z } from "zod"
import { createCdekClient } from "../../../../modules/cdek/client"
import { getCdekOptionsFromEnv } from "../../../../modules/cdek/lib/config"
import { calculateCdekTariff } from "../../../../modules/cdek/lib/tariff"

const calculateSchema = z.object({
  delivery_type: z.enum(["pickup", "courier"]),
  city_code: z.number().int().positive(),
  delivery_point_code: z.string().optional(),
  address: z.string().optional(),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive(),
        weight: z.number().positive().optional(),
        length: z.number().positive().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      })
    )
    .optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const parsed = calculateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parsed.error.flatten(),
    })
  }

  const input = parsed.data

  if (input.delivery_type === "pickup" && !input.delivery_point_code) {
    return res.status(400).json({
      message: "delivery_point_code is required for pickup delivery",
    })
  }

  if (input.delivery_type === "courier" && !input.address) {
    return res.status(400).json({
      message: "address is required for courier delivery",
    })
  }

  try {
    const options = getCdekOptionsFromEnv()
    const client = createCdekClient(options, logger)
    const result = await calculateCdekTariff(client, options, input)
    return res.status(200).json(result)
  } catch (error) {
    logger.error(
      `CDEK tariff calculation failed: ${error instanceof Error ? error.message : "unknown"}`
    )
    return res.status(502).json({
      message: "Failed to calculate CDEK delivery price",
    })
  }
}
