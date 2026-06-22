import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    workerMode: (process.env.MEDUSA_WORKER_MODE || "shared") as "shared" | "worker" | "server",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  modules: [
    {
      resolve: "./src/modules/cdek",
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/modules/cdek/fulfillment",
            id: "cdek",
            options: {
              baseUrl: process.env.CDEK_BASE_URL,
              clientId: process.env.CDEK_CLIENT_ID,
              clientSecret: process.env.CDEK_CLIENT_SECRET,
              fromCityCode: Number(process.env.CDEK_FROM_CITY_CODE ?? "0"),
              fromPostalCode: process.env.CDEK_FROM_POSTAL_CODE,
              fromAddress: process.env.CDEK_FROM_ADDRESS,
              senderCompany: process.env.CDEK_SENDER_COMPANY,
              senderName: process.env.CDEK_SENDER_NAME,
              senderPhone: process.env.CDEK_SENDER_PHONE,
              tariffPickup: Number(process.env.CDEK_TARIFF_PICKUP ?? "0"),
              tariffCourier: Number(process.env.CDEK_TARIFF_COURIER ?? "0"),
              defaultWeightGrams: Number(
                process.env.CDEK_DEFAULT_WEIGHT_GRAMS ?? "500"
              ),
              defaultLengthCm: Number(process.env.CDEK_DEFAULT_LENGTH_CM ?? "20"),
              defaultWidthCm: Number(process.env.CDEK_DEFAULT_WIDTH_CM ?? "15"),
              defaultHeightCm: Number(
                process.env.CDEK_DEFAULT_HEIGHT_CM ?? "10"
              ),
              webhookSecret: process.env.CDEK_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/yookassa",
            id: "yookassa",
            options: {
              shopId: process.env.YOOKASSA_SHOP_ID,
              secretKey: process.env.YOOKASSA_SECRET_KEY,
              apiUrl: process.env.YOOKASSA_API_URL,
              currency: process.env.YOOKASSA_CURRENCY,
              returnUrl: process.env.YOOKASSA_RETURN_URL,
              frontendUrl: process.env.FRONTEND_URL,
              receiptsEnabled:
                process.env.YOOKASSA_RECEIPTS_ENABLED === "true",
              vatCode: Number(process.env.YOOKASSA_VAT_CODE ?? "1"),
              trustProxy: process.env.TRUST_PROXY === "true",
              ipAllowlistEnabled:
                process.env.YOOKASSA_IP_ALLOWLIST_ENABLED === "true",
            },
          },
        ],
      },
    },
  ],
})
