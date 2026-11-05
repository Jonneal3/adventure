import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import bcrypt from "bcryptjs";
import { db } from "./database/client.js";
import { account, session, user, verification } from "./database/schema.js";

const baseURL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
const emailEnabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_EMAIL_ENABLED === "true";
const localSiteURL = new URL(baseURL);
const trustedOrigins = [baseURL, process.env.NEXT_PUBLIC_WIDGET_URL];
if (["localhost", "127.0.0.1"].includes(localSiteURL.hostname)) {
  localSiteURL.hostname = localSiteURL.hostname === "localhost" ? "127.0.0.1" : "localhost";
  trustedOrigins.push(localSiteURL.origin);
}

async function sendEmail(to: string, subject: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ADVENTURE_EMAIL_FROM;
  if (!key || !from) throw new Error("Auth email delivery is unavailable");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: `${subject}\n\n${url}` }),
  });
  if (!response.ok) throw new Error(`Auth email delivery failed (${response.status})`);
}

export const auth = betterAuth({
  baseURL,
  basePath: "/api/platform/auth",
  secret,
  trustedOrigins: trustedOrigins.filter((value): value is string => !!value),
  database: drizzleAdapter(db, {
    provider: "pg",
    schemaName: "app_auth",
    schema: { user, session, account, verification },
  }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailEnabled,
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => sendEmail(user.email, "Reset your Adventure password", url),
  },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    sendVerificationEmail: async ({ user, url }) => sendEmail(user.email, "Confirm your Adventure email", url),
  },
});
