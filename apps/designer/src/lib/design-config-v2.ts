import { DESIGN_CONFIG_KEY_ORDER_V2, orderObjectKeys } from "@/lib/design-config-order";
import { defaultDesignSettingsV2 } from "@/types/design-v2";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeDesignConfigForStorage(
  config: unknown,
  options: { fillDefaults?: boolean } = {}
): Record<string, unknown> {
  // Storage contract for V2: only persist the V2 keys, ordered in section order.
  // Any legacy/widget keys must not be stored in `instances.config`.
  return compactDesignConfigToV2(config, options);
}

export function pickDesignConfigV2Keys(config: unknown): Record<string, unknown> {
  if (!isPlainObject(config)) return {};

  const picked: Record<string, unknown> = {};
  for (const key of DESIGN_CONFIG_KEY_ORDER_V2) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      picked[key] = config[key];
    }
  }
  return picked;
}

export function compactDesignConfigToV2(
  config: unknown,
  options: { fillDefaults?: boolean } = {}
): Record<string, unknown> {
  const { fillDefaults = true } = options;
  const picked = pickDesignConfigV2Keys(config);

  const compacted = fillDefaults
    ? ({ ...defaultDesignSettingsV2, ...picked } as Record<string, unknown>)
    : picked;

  return orderObjectKeys(compacted, DESIGN_CONFIG_KEY_ORDER_V2);
}
