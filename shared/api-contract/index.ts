import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();
const error = z.object({ error: z.string() });
const uuid = z.string().uuid();
export const publicPlan = z.object({
  code: z.enum(["usage", "basic", "pro"]), name: z.string(), monthlyPriceCents: z.number().int(),
  includedEngagements: z.number().int(), overageEngagementPriceCents: z.number().int(),
  includedAiDesigns: z.number().int(), extraAiDesignPriceCents: z.number().int(),
  includedInstances: z.number().int(),
});

export const backendContract = c.router({
  health: { method: "GET", path: "/api/health", responses: { 200: z.object({ status: z.literal("ok") }), 503: error } },
  me: { method: "GET", path: "/api/me", responses: { 200: z.object({ id: uuid, email: z.string().email() }), 401: error } },
  accounts: { method: "GET", path: "/api/accounts", responses: { 200: z.object({ accounts: z.array(z.object({ id: uuid, name: z.string(), role: z.enum(["owner", "admin", "member"]) })) }), 401: error } },
  plans: { method: "GET", path: "/api/plans", responses: { 200: z.array(publicPlan) } },
  industries: { method: "GET", path: "/api/industries", responses: { 200: z.array(z.object({ id: uuid, name: z.string() })) } },
  services: { method: "GET", path: "/api/industries/:industryId/services", pathParams: z.object({ industryId: uuid }), responses: { 200: z.array(z.object({ id: uuid, name: z.string(), description: z.string().nullable(), hasDefaultRange: z.boolean() })), 404: error } },
});
