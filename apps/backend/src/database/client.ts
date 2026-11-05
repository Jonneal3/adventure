import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const hostname = new URL(connectionString).hostname;
if (hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com")) throw new Error("Use an Adventure-owned PostgreSQL database");
export const pool = new Pool({ connectionString, max: 10, ssl: ["localhost", "127.0.0.1"].includes(hostname) ? undefined : { rejectUnauthorized: true } });
export const db = drizzle({ client: pool, schema });
