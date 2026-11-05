import { Controller, Req } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { backendContract } from "@adventure/api-contract";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Request } from "express";
import { auth } from "./auth.js";
import { db } from "./database/client.js";
import { accounts, categories, plans, servicePresets, services, userAccounts } from "./database/schema.js";

function headers(request: Request): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") result.set(key, value);
    else if (Array.isArray(value)) value.forEach(item => result.append(key, item));
  }
  return result;
}

@Controller()
export class AppController {
  @TsRestHandler(backendContract.health)
  health() {
    return tsRestHandler(backendContract.health, async () => {
      try { await db.execute(sql`select 1`); return { status: 200 as const, body: { status: "ok" as const } }; }
      catch { return { status: 503 as const, body: { error: "Database unavailable" } }; }
    });
  }

  @TsRestHandler(backendContract.me)
  me(@Req() request: Request) {
    return tsRestHandler(backendContract.me, async () => {
      const session = await auth.api.getSession({ headers: headers(request) });
      if (!session) return { status: 401 as const, body: { error: "Please sign in" } };
      return { status: 200 as const, body: { id: session.user.id, email: session.user.email } };
    });
  }

  @TsRestHandler(backendContract.accounts)
  listAccounts(@Req() request: Request) {
    return tsRestHandler(backendContract.accounts, async () => {
      const session = await auth.api.getSession({ headers: headers(request) });
      if (!session) return { status: 401 as const, body: { error: "Please sign in" } };
      const rows = await db.select({ id: accounts.id, name: accounts.name, role: userAccounts.userStatus })
        .from(userAccounts).innerJoin(accounts, eq(accounts.id, userAccounts.accountId))
        .where(and(eq(userAccounts.userId, session.user.id), eq(userAccounts.status, "accepted")));
      return { status: 200 as const, body: { accounts: rows.filter(row => ["owner", "admin", "member"].includes(row.role)).map(row => ({ ...row, role: row.role as "owner" | "admin" | "member" })) } };
    });
  }

  @TsRestHandler(backendContract.plans)
  listPlans() {
    return tsRestHandler(backendContract.plans, async () => {
      const rows = await db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.monthlyPriceCents));
      return { status: 200 as const, body: rows.map(row => ({ code: row.code as "usage" | "basic" | "pro", name: row.name, monthlyPriceCents: row.monthlyPriceCents, includedEngagements: row.includedEngagements, overageEngagementPriceCents: row.overageEngagementPriceCents, includedAiDesigns: row.includedAiDesigns, extraAiDesignPriceCents: row.extraAiDesignPriceCents, includedInstances: row.includedInstances })) };
    });
  }

  @TsRestHandler(backendContract.industries)
  listIndustries() {
    return tsRestHandler(backendContract.industries, async () => {
      const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.status, "active"), eq(categories.instanceType, "service"), isNull(categories.accountId))).orderBy(asc(categories.name));
      return { status: 200 as const, body: rows };
    });
  }

  @TsRestHandler(backendContract.services)
  listServices() {
    return tsRestHandler(backendContract.services, async ({ params }) => {
      const [industry] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, params.industryId), eq(categories.instanceType, "service"))).limit(1);
      if (!industry) return { status: 404 as const, body: { error: "Industry not found" } };
      const rows = await db.select({ id: services.id, name: services.name, description: services.description, defaultRange: servicePresets.defaultRange }).from(services)
        .leftJoin(servicePresets, eq(servicePresets.serviceId, services.id))
        .where(and(eq(services.categoryId, industry.id), eq(services.status, "active"), eq(services.instanceType, "service"), isNull(services.accountId))).orderBy(asc(services.name));
      return { status: 200 as const, body: rows.map(({ defaultRange, ...row }) => ({ ...row, hasDefaultRange: !!defaultRange })) };
    });
  }
}
