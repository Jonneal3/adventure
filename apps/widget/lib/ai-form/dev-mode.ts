"use client";

export function isDevModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const envEnabled = process.env.NEXT_PUBLIC_AI_FORM_DEV_MODE === "true";
  if (!envEnabled) return false;
  const params = new URLSearchParams(window.location.search);
  const flag =
    params.get("dev") ||
    params.get("dev_mode") ||
    params.get("ai_form_dev") ||
    params.get("debug");
  const enabled = flag === "1" || flag === "true" || flag === "yes";
  if (!enabled) return false;
  const requiredToken = process.env.NEXT_PUBLIC_AI_FORM_DEV_TOKEN;
  if (!requiredToken) return true;
  const token = params.get("dev_token") || params.get("token");
  return token === requiredToken;
}
