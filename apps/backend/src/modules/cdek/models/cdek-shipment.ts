import { model } from "@medusajs/framework/utils"

const CdekShipment = model.define("cdek_shipment", {
  id: model.id().primaryKey(),
  order_id: model.text().index(),
  cdek_uuid: model.text().nullable(),
  cdek_number: model.text().nullable(),
  status: model.text().default("pending"),
  delivery_type: model.text(),
  tariff_code: model.number(),
  delivery_point_code: model.text().nullable(),
  request_payload: model.json().nullable(),
  response_payload: model.json().nullable(),
  last_error: model.text().nullable(),
  attempts: model.number().default(0),
})

export default CdekShipment
