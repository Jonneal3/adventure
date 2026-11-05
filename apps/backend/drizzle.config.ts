import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: ["./src/database/auth-schema.ts", "./src/database/new-schema.ts"], out: "./drizzle", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL || "postgres://localhost/adventure_staging" } });
