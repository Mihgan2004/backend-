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
