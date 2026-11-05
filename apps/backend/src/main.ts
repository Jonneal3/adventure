import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { AppModule } from "./app.module.js";
import { auth } from "./auth.js";
import { pool } from "./database/client.js";

async function main() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const authHandler = toNodeHandler(auth);
  app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (request.path.startsWith("/api/auth/")) {
      request.url = request.url.replace(/^\/api\/auth\//, "/api/platform/auth/");
      return void authHandler(request, response);
    }
    next();
  });
  app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: "1mb" }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || process.env.BACKEND_PORT || 3200), process.env.BACKEND_HOST || "127.0.0.1");
  process.once("SIGTERM", async () => { await app.close(); await pool.end(); });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
