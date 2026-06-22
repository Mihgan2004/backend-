import { MedusaService } from "@medusajs/framework/utils"
import CdekShipment from "./models/cdek-shipment"

class CdekModuleService extends MedusaService({
  CdekShipment,
}) {}

export default CdekModuleService
