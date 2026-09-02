import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStarterReferencePrompt,
  selectStarterReference,
  starterReferenceCandidate,
  V8_STARTER_MODEL_ID,
  type StarterReferenceRow,
} from "../lib/adventure-v8/starter-reference";

const SERVICE_ID = "258f4d7f-746f-416b-b617-e1cca25b748f";

function approvedRow(opts: {
  id: string;
  visible: string[];
  hero?: string[];
  finishTier?: string;
  accountId?: string | null;
  cameraAngle?: string;
  defects?: string[];
  reviewStatus?: string;
}): StarterReferenceRow {
  return {
    id: opts.id,
    image_url: `https://cdn.example.com/${opts.id}.jpg`,
    account_id: opts.accountId || null,
    subcategory_id: SERVICE_ID,
    metadata: {
      generated_for: "v8_starter_reference",
      starter_profile: {
        version: 1,
        eligible: true,
        review_status: opts.reviewStatus || "approved",
        service_id: SERVICE_ID,
        visible_scope_keys: opts.visible,
        hero_scope_keys: opts.hero || opts.visible,
        finish_tier: opts.finishTier || "mid",
        layout_family: "compact-hall-bath",
        camera_angle: opts.cameraAngle || "doorway-three-quarter-wide",
        fixture_inventory: {
          wet_zone_type: "tub-shower-combo",
          wet_zone_count: 1,
          vanity_count: 1,
          toilet_count: 1,
        },
        plainness_score: 0.9,
        editability_score: 0.9,
        structural_valid: true,
        defects: opts.defects || [],
      },
    },
  };
}

test("multi-scope bathroom requests choose the full-room reference over a close-up", () => {
  const full = approvedRow({
    id: "full-room",
    visible: ["shower-tub", "vanity", "wall-tile", "floor-tile"],
    hero: ["shower-tub", "vanity", "wall-tile"],
  });
  const showerOnly = approvedRow({
    id: "shower-close-up",
    visible: ["shower-tub", "wall-tile"],
    cameraAngle: "wet-zone-close-up",
  });
  const selected = selectStarterReference({
    rows: [showerOnly, full],
    serviceId: SERVICE_ID,
    scopes: ["Shower/tub", "Vanity", "Wall tile"],
    finishTier: "mid",
    sessionId: "session-a",
  });

  assert.equal(selected?.id, "full-room");
  assert.deepEqual(selected?.matchedScopeKeys, ["shower-tub", "vanity", "wall-tile"]);
  assert.deepEqual(selected?.missingScopeKeys, []);
});

test("finish-tier proximity wins when scope coverage is equal", () => {
  const selected = selectStarterReference({
    rows: [
      approvedRow({ id: "value", visible: ["vanity"], finishTier: "value" }),
      approvedRow({ id: "premium", visible: ["vanity"], finishTier: "premium" }),
    ],
    serviceId: SERVICE_ID,
    scopes: ["Vanity"],
    finishTier: "premium",
    sessionId: "session-tier",
  });

  assert.equal(selected?.id, "premium");
});

test("unapproved, defective, wrong-account, and generated customer images are excluded", () => {
  const rows: StarterReferenceRow[] = [
    approvedRow({ id: "pending", visible: ["vanity"], reviewStatus: "pending" }),
    approvedRow({ id: "defective", visible: ["vanity"], defects: ["duplicate-fixture"] }),
    approvedRow({ id: "wrong-account", visible: ["vanity"], accountId: "account-b" }),
    {
      id: "customer-generation",
      image_url: "https://cdn.example.com/customer.jpg",
      metadata: { generated_for: "adventure_v8", starter_experiment_eligible: true },
    },
    approvedRow({ id: "approved", visible: ["vanity"] }),
  ];
  const selected = selectStarterReference({
    rows,
    serviceId: SERVICE_ID,
    accountId: "account-a",
    scopes: ["Vanity"],
    finishTier: "mid",
    sessionId: "session-filter",
  });

  assert.equal(selected?.id, "approved");
  assert.equal(starterReferenceCandidate(rows[0], SERVICE_ID), null);
  assert.equal(starterReferenceCandidate(rows[1], SERVICE_ID), null);
  assert.equal(starterReferenceCandidate(rows[3], SERVICE_ID), null);
});

test("approved account references outrank equally suitable global references", () => {
  const selected = selectStarterReference({
    rows: [
      approvedRow({ id: "global", visible: ["vanity"] }),
      approvedRow({ id: "account", visible: ["vanity"], accountId: "account-a" }),
    ],
    serviceId: SERVICE_ID,
    accountId: "account-a",
    scopes: ["Vanity"],
    finishTier: "mid",
    sessionId: "session-account",
  });

  assert.equal(selected?.id, "account");
});

test("similarly ranked references rotate deterministically by session", () => {
  const rows = [
    approvedRow({ id: "angle-a", visible: ["vanity"] }),
    approvedRow({ id: "angle-b", visible: ["vanity"] }),
  ];
  const pick = (sessionId: string) =>
    selectStarterReference({
      rows,
      serviceId: SERVICE_ID,
      scopes: ["Vanity"],
      finishTier: "mid",
      sessionId,
    })?.id;

  assert.equal(pick("stable-session"), pick("stable-session"));
  const selections = new Set(Array.from({ length: 20 }, (_, index) => pick(`session-${index}`)));
  assert.deepEqual(selections, new Set(["angle-a", "angle-b"]));
});

test("legacy neutral controls remain approved references during metadata backfill", () => {
  const legacy: StarterReferenceRow = {
    id: "legacy-full-bath",
    image_url: "https://cdn.example.com/legacy.jpg",
    subcategory_id: SERVICE_ID,
    metadata: {
      generated_for: "v2_neutral_scope_starter",
      starter_experiment_eligible: true,
      starter_scope_key: "full-bathroom-renovation",
      subcategory_id: SERVICE_ID,
    },
  };

  const candidate = starterReferenceCandidate(legacy, SERVICE_ID);
  assert.equal(candidate?.profile.reviewStatus, "approved");
  assert.ok(candidate?.profile.visibleScopeKeys.includes("shower-tub"));
  assert.ok(candidate?.profile.visibleScopeKeys.includes("vanity"));
  assert.equal(candidate?.profile.fixtureInventory.wet_zone_count, 1);
});

test("starter prompt locks geometry and inventory while applying scope and budget", () => {
  const reference = starterReferenceCandidate(
    approvedRow({ id: "prompt-reference", visible: ["shower-tub", "vanity", "wall-tile"] }),
    SERVICE_ID
  );
  assert.ok(reference);
  const prompt = buildStarterReferencePrompt({
    serviceLabel: "Bathroom Remodeling",
    scopes: ["Shower/tub", "Vanity", "Wall tile"],
    budget: 18_000,
    finishTier: "mid",
    reference,
  });

  assert.match(prompt, /immutable object, plumbing, spatial, lighting-position, and camera reference/i);
  assert.match(prompt, /wet zone count=1/i);
  assert.match(prompt, /exactly ONE showerhead total/i);
  assert.match(prompt, /may not become a lamp/i);
  assert.match(prompt, /may not appear inside the tiled tub\/shower wet zone/i);
  assert.match(prompt, /Never add, remove, mirror, or duplicate a showerhead, shower, tub/i);
  assert.match(prompt, /Shower\/tub, Vanity, Wall tile/);
  assert.match(prompt, /\$18,000/);
  assert.match(prompt, /intentionally modest, neutral, clean, partially designed/i);
  assert.match(prompt, /constrained reference edit, not a new scene/i);
  assert.doesNotMatch(prompt, /Create one fresh/i);
  assert.doesNotMatch(prompt, /unique natural variation/i);
  assert.equal(V8_STARTER_MODEL_ID, "prunaai/p-image-edit");
});
