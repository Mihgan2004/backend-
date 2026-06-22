import CdekModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const CDEK_MODULE = "cdek"

export default Module(CDEK_MODULE, {
  service: CdekModuleService,
})
