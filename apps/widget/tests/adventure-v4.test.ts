import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V4 exposes V3 behavior through an isolated route and storage namespace", () => {
  const route = read("app/adventure/v4/[instanceId]/page.tsx");
  const wrapper = read("components/adventure/v4/index.ts");
  const experience = read("components/adventure/v3/AdventureV3VisualPricingExperience.tsx");
  const storage = read("components/adventure/v3/visual-storage.ts");

  assert.match(route, /AdventureV4Experience/);
  assert.match(wrapper, /AdventureV3VisualPricingExperience/);
  assert.match(wrapper, /routeVersion: "v4"/);
  assert.match(experience, /routeVersion\?: AdventureVisualRouteVersion/);
  assert.match(experience, /AdventureVisualRouteVersion = "v3" \| "v4"/);
  assert.match(experience, /data-adventure-version=\{routeVersion\}/);
  assert.match(storage, /adventure:\$\{namespace\}:visual-pricing/);
  assert.match(storage, /"v3" \| "v4" \| "v5"/);
});

test("V4 is a theme-driven minimal skin with glass limited to image tools", () => {
  const css = read("components/adventure/v3/visual-pricing-v3.module.css");
  const stepCss = read("components/adventure/v4/visual-pricing-v4.module.css");
  const experience = read("components/adventure/v3/AdventureV3VisualPricingExperience.tsx");
  const v4Css = css.slice(css.indexOf("/* V4 minimal"));
  const allV4Css = `${v4Css}\n${stepCss}`;

  assert.match(css, /V4 minimal — flat, simple, and entirely theme-driven/);
  assert.match(css, /\.root\[data-adventure-version="v4"\]/);
  assert.match(v4Css, /background: var\(--v3-surface\)/);
  assert.match(v4Css, /border: 1px solid var\(--v3-border\)/);
  assert.match(v4Css, /\.choiceCard,[\s\S]*?\.budgetGrid > button \{[\s\S]*?border-radius: 999px/);
  assert.match(experience, /visual-pricing-v4\.module\.css/);
  assert.match(stepCss, /\.detailGrid > \.projectImage \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 1 \/ 3/);
  assert.match(stepCss, /\.detailGrid > \.priceSummary \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1/);
  assert.match(stepCss, /\.customizationWrap \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2/);
  assert.match(stepCss, /\.priceRoomAction \{[\s\S]*?border-radius:/);
  assert.match(stepCss, /\.customizationTabs \{[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(stepCss, /\.imageActions button \{[\s\S]*?backdrop-filter: blur\(18px\)/);
  assert.match(stepCss, /\.galleryHeader \{[\s\S]*?gap: 8px/);
  assert.match(experience, /const isMinimalCustomizeStage = isMinimalRoute && snapshot\.stage === "customize"/);
  assert.match(experience, /snapshot\.stage === "details" \|\| isMinimalCustomizeStage/);
  assert.match(experience, /stage: "customize"/);
  assert.match(experience, /\["Inspiration", "Investment", "Personalize", "Your space", "Continue"\]/);
  assert.match(experience, /Claim this project/);
  assert.match(experience, /Claim and view investment/);
  assert.match(experience, /Choose a part/);
  assert.match(experience, /Describe a change/);
  assert.match(experience, /Project versions/);
  assert.match(experience, /See it in your room/);
  assert.match(experience, /Optional next step/);
  assert.match(experience, /See your version in your space/);
  assert.match(experience, /Upload a photo and we’ll apply your selected design and personalization choices\./);
  assert.match(experience, /Upload my space/);
  assert.match(experience, /Take a photo/);
  assert.match(experience, /capture="environment"/);
  assert.match(experience, /Unlock continued refinements/);
  assert.match(experience, /This unlocks your project workspace\. It does not request a consultation\./);
  assert.match(experience, /Want contractor feedback\?/);
  assert.match(experience, /Get contractor feedback/);
  assert.match(experience, /refinementLimit = isMinimalVisualRoute\(routeVersion\) \? 0 : FREE_PERSONALIZED_REFINEMENTS/);
  assert.match(stepCss, /\.personalizationFallback \{/);
  assert.match(stepCss, /\.priceRevealCta \{/);
  assert.match(stepCss, /\.priceRevealContent \{/);
  assert.match(stepCss, /\.priceRevealGroup \{/);
  assert.match(stepCss, /\.takePhotoAction \{/);
  assert.doesNotMatch(experience, /Budget target/);
  assert.doesNotMatch(stepCss, /\.quickControl/);
  assert.doesNotMatch(v4Css, /\.projectImageMeta\s*\{/);
  assert.doesNotMatch(allV4Css, /linear-gradient/);

  const shadowValues = [...allV4Css.matchAll(/box-shadow:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  const backdropValues = [
    ...allV4Css.matchAll(/(?:-webkit-)?backdrop-filter:\s*([^;]+);/g),
  ].map((match) => match[1].trim());

  assert.ok(shadowValues.every((value) => value === "none" || value === "0 8px 24px rgb(14 20 30 / 12%) !important"));
  assert.ok(backdropValues.every((value) => value === "none" || value === "blur(18px) saturate(140%)"));
  assert.equal(backdropValues.filter((value) => value !== "none").length, 2);
  assert.match(css, /\.primerContent/);
  assert.match(css, /\.choiceCard/);
  assert.match(css, /\.priceSummaryBar/);
  assert.match(css, /\.refinementPanel/);
  assert.match(experience, /Before we price it, we need a little context\./);
  assert.match(experience, /Projects that fit your budget/);
  assert.match(experience, /This look, in your space/);
  assert.match(experience, /Want to adjust this design to match your goals\?/);
  assert.match(experience, /Personalize your vision/);
});
