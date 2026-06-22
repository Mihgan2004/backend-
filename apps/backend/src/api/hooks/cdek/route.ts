import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import { getCdekOptionsFromEnv } from "../../../modules/cdek/lib/config"
import { CDEK_MODULE } from "../../../modules/cdek"
import CdekModuleService from "../../../modules/cdek/service"
import { CdekWebhookPayload } from "../../../modules/cdek/types"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>("logger")
  const options = getCdekOptionsFromEnv()
  const secret =
    (req.headers["x-webhook-secret"] as string | undefined) ??
    (req.query.secret as string | undefined)

  if (!options.webhookSecret || secret !== options.webhookSecret) {
    logger.warn("CDEK webhook rejected: invalid secret")
    return res.sendStatus(403)
  }

  const payload = (req.body ?? {}) as CdekWebhookPayload
  const cdekUuid = payload.uuid
  const cdekNumber =
    payload.cdek_number ?? payload.attributes?.cdek_number ?? undefined
  const statusCode =
    payload.attributes?.status_code ?? payload.attributes?.code ?? payload.type

  if (!cdekUuid && !cdekNumber) {
    logger.warn("CDEK webhook: missing uuid/cdek_number")
    return res.sendStatus(200)
  }

  try {
    const cdekModuleService = req.scope.resolve<CdekModuleService>(CDEK_MODULE)

    const filters = cdekUuid
      ? { cdek_uuid: cdekUuid }
      : { cdek_number: cdekNumber }

    const shipments = await cdekModuleService.listCdekShipments(filters)
    const shipment = shipments[0]

    if (!shipment) {
      logger.warn(
        `CDEK webhook: shipment not found for uuid=${cdekUuid ?? "n/a"} number=${cdekNumber ?? "n/a"}`
      )
      return res.sendStatus(200)
    }

    if (!statusCode) {
      logger.warn(`CDEK webhook: missing status for shipment ${shipment.id}`)
      return res.sendStatus(200)
    }

    if (shipment.status === statusCode) {
      return res.sendStatus(200)
    }

    const knownStatuses = new Set([
      "CREATED",
      "ACCEPTED",
      "RECEIVED_AT_SHIPMENT_WAREHOUSE",
      "READY_FOR_SHIPMENT_IN_SENDER_CITY",
      "RETURNED_TO_SENDER_CITY_WAREHOUSE",
      "TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY",
      "SENT_TO_TRANSIT_CITY",
      "ACCEPTED_IN_TRANSIT_CITY",
      "ACCEPTED_AT_TRANSIT_WAREHOUSE",
      "RETURNED_TO_TRANSIT_WAREHOUSE",
      "READY_FOR_SHIPMENT_IN_TRANSIT_CITY",
      "TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY",
      "SENT_TO_RECIPIENT_CITY",
      "ACCEPTED_IN_RECIPIENT_CITY",
      "ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE",
      "ACCEPTED_AT_PICK_UP_POINT",
      "TAKEN_BY_COURIER",
      "RETURNED_TO_RECIPIENT_CITY_WAREHOUSE",
      "DELIVERED",
      "NOT_DELIVERED",
      "INVALID",
      "pending",
      "created",
    ])

    if (!knownStatuses.has(statusCode)) {
      logger.warn(`CDEK webhook: unknown status "${statusCode}"`)
    }

    await cdekModuleService.updateCdekShipments({
      id: shipment.id,
      status: statusCode,
      cdek_number: cdekNumber ?? shipment.cdek_number,
      response_payload: payload,
    })
  } catch (error) {
    logger.error(
      `CDEK webhook processing error: ${error instanceof Error ? error.message : "unknown"}`
    )
  }

  return res.sendStatus(200)
}
