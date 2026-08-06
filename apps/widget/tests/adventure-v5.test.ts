import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

const experience = () => read("components/adventure/v5/AdventureV5Experience.tsx");
const v5Css = () => read("components/adventure/v5/visual-pricing-v5.module.css");

test("V5 ships as its own experience behind an isolated route and storage namespace", () => {
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const route = read("app/adventure/v5/[instanceId]/page.tsx");
  const wrapper = read("components/adventure/v5/index.ts");
  const storage = read("components/adventure/v3/visual-storage.ts");
  const component = experience();

  assert.match(unversioned, /AdventureV5Experience/);
  assert.match(route, /AdventureV5Experience/);
  assert.match(wrapper, /AdventureV5Experience/);
  assert.match(component, /export function AdventureV5Experience/);
  assert.match(component, /data-adventure-version="v5"/);
  assert.match(storage, /"v3" \| "v4" \| "v5"/);
});

test("V5 owns its markup and stylesheet instead of skinning V3/V4", () => {
  const component = experience();
  const legacy = read("components/adventure/v3/AdventureV3VisualPricingExperience.tsx");
  const legacyCss = read("components/adventure/v3/visual-pricing-v3.module.css");

  assert.match(component, /import css from "\.\/visual-pricing-v5\.module\.css"/);
  assert.doesNotMatch(component, /visual-pricing-v3\.module\.css/);
  assert.doesNotMatch(component, /visual-pricing-v4\.module\.css/);

  // V4 keeps working untouched: the shared experience carries no V5 branches.
  assert.doesNotMatch(legacy, /isV5|v5Styles|"v5"/);
  assert.doesNotMatch(legacyCss, /data-adventure-version="v5"/);
});

test("V5 inherits V4's flow: primer skipped, curated budget, and V4 refinement economics", () => {
  const component = experience();
  const css = v5Css();

  // Primer is retired: fresh sessions land on the first real question.
  assert.match(component, /function defaultSnapshot\([\s\S]*?showPrimer = false/);
  assert.match(component, /defaultSnapshot\(sessionId, implicit\)/);
  // Budget curates rather than constrains.
  assert.match(component, /budgetMode: "lens"/);
  // Refining the reference design is open; personalizing the customer's own
  // photo is what the phone gate unlocks.
  assert.match(component, /const PROJECT_REFINEMENT_LIMIT = Number\.POSITIVE_INFINITY/);
  assert.match(component, /const PERSONALIZED_REFINEMENT_LIMIT = 0/);
  assert.match(component, /personalize: "customize"/);
  assert.match(component, /\["Project", "Budget", "Inspiration", "Estimate", "Next steps"\]/);
  assert.match(component, /Something else/);
  assert.doesNotMatch(component, /Skip for now — show a rough range/);
  assert.match(component, /budgetGuidanceCopy\(selectedService\)/);
  assert.match(component, /serviceLabelLower\(selectedService\)/);
  assert.match(component, /See what’s possible for \$\{serviceName\}/);
  assert.match(component, /Your planning estimate for this \$\{serviceName\} direction/);
  assert.doesNotMatch(component, /Most full \{serviceWord\} projects land in the \$25,000–\$40,000 range/);
  // Answers accumulate in a vertical rail with clear actions, not top-right chips.
  assert.match(component, /className=\{css\.answerRail\}/);
  assert.match(component, /clearBudgetAnswer/);
  assert.match(css, /\.answerRail \{/);
  assert.doesNotMatch(component, /className=\{css\.selectionBar\}/);
});

test("V5 derives its whole palette from the tenant's design config", () => {
  const component = experience();
  const css = v5Css();

  // Only two anchors plus the accent are injected...
  assert.match(component, /"--v5-bg": design\.background_color/);
  assert.match(component, /"--v5-ink": design\.prompt_text_color/);
  assert.match(component, /"--v5-accent": design\.primary_color/);
  assert.match(component, /"--v5-radius":/);
  assert.match(component, /fontFamily: design\.font_family/);
  // ...and every other tone is mixed from them, so any brand stays coherent.
  assert.match(css, /--v5-muted: color-mix\(in oklab, var\(--v5-ink\)/);
  assert.match(css, /--v5-hair: color-mix\(in oklab, var\(--v5-ink\)/);
  assert.match(css, /--v5-card: color-mix\(in oklab, var\(--v5-bg\)/);
  assert.doesNotMatch(css, /#f0f|rgba\(17, 19, 24/);
});

test("V5 choreographs each step instead of swapping screens", () => {
  const component = experience();
  const css = v5Css();

  // Direction-aware: forward rises from below, back settles from above.
  assert.match(component, /const STAGE_SEQUENCE: VisualPricingStage\[\]/);
  assert.match(component, /setStageDirection\(/);
  assert.match(component, /data-direction=\{stageDirection\}/);
  assert.match(css, /@keyframes v5stepIn\b/);
  assert.match(css, /@keyframes v5stepInBack\b/);
  assert.match(css, /\.stage\[data-direction="back"\] \.step > \* \{\s*animation-name: v5stepInBack;/);
  // Children arrive in sequence rather than all at once.
  assert.match(css, /\.step > \*:nth-child\(2\) \{ animation-delay: 120ms; \}/);
  // Images cross-fade; the hero settles out of a slow scale.
  assert.match(css, /@keyframes v5crossFade\b/);
  assert.match(css, /@keyframes v5heroIn\b/);
  // One easing curve for the whole system.
  assert.match(css, /--v5-ease: cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
});

test("V5 scrolls inside its own frame because the adventure route pins the viewport", () => {
  const layout = read("app/adventure/layout.tsx");
  const component = experience();
  const css = v5Css();

  // The route wrapper clips overflow above the sm breakpoint, so the experience
  // cannot rely on the document scrolling.
  assert.match(layout, /overflow-hidden/);
  // The root is a fixed-height frame; the stage is the scroller beneath the chrome.
  assert.match(css, /\.root \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/);
  assert.match(css, /\.stage \{[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.stage \{[\s\S]*?overscroll-behavior-y: contain;/);
  assert.match(css, /\.stage \{[\s\S]*?-webkit-overflow-scrolling: touch;/);
  // Chrome sits outside the scroller, so it stays put without sticky positioning.
  assert.match(css, /\.chrome \{[^}]*position: relative;/);
  assert.doesNotMatch(css, /\.chrome \{[^}]*position: sticky;/);
  // Each new step starts at the top of that scroller.
  assert.match(component, /stageRef\.current\?\.scrollTo\(\{ top: 0/);
  assert.match(component, /<main ref=\{stageRef\}/);
});

test("V5 keeps V4's inspiration gallery: dense wall, locked pricing, V4 copy", () => {
  const component = experience();
  const css = v5Css();

  /*
   * V4's measure: the wall shares the 1180px column and the page gutter with
   * every other step, and never widens past three columns, so cards stay a
   * browsable size on a large monitor instead of stretching edge to edge.
   */
  assert.match(css, /\.step \{[\s\S]*?max-width: 1180px;/);
  assert.doesNotMatch(css, /\.stage\[data-stage="gallery"\] \.step \{[^}]*max-width:/);
  assert.doesNotMatch(css, /\.stage\[data-stage="gallery"\] \{[^}]*padding-left:/);
  assert.doesNotMatch(css, /grid-template-columns: repeat\(4/);
  assert.match(css, /min-width: 881px\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  // V4's seven-card shape cycle, laid out as a dense grid so cards fill
  // left-to-right and the strongest results land on the first screen.
  assert.match(component, /type LookShape = "wide" \| "portrait" \| "square"/);
  assert.match(
    component,
    /LOOK_SHAPES: LookShape\[\] = \["wide", "portrait", "square", "portrait", "portrait", "square", "wide"\]/
  );
  assert.match(css, /\.lookFlow \{[\s\S]*?grid-auto-flow: row dense;/);
  assert.match(css, /\.lookFlow \{[\s\S]*?grid-auto-rows: 1px;/);
  /*
   * A card is its span minus one gap, so the leftover row is the gutter between
   * stacked cards. Height and span have to move together or the wall's rows
   * either collide or drift apart.
   */
  assert.match(css, /\.look\[data-shape="portrait"\] \{ grid-row-end: span 312; height: 300px; \}/);
  assert.match(css, /\.look\[data-shape="wide"\] \{ grid-row-end: span 297; height: 280px; \}/);
  assert.match(css, /\.look\[data-shape="square"\] \{ grid-row-end: span 357; height: 340px; \}/);
  assert.match(css, /\.look\[data-shape="portrait"\] \{ grid-row-end: span 437; height: 420px; \}/);
  // Card: fit badge, caption on the image, and a blurred directional price teaser.
  assert.match(component, /className=\{css\.lookBadge\}[\s\S]*?Common at this level/);
  assert.match(component, /className=\{css\.lookLocked\}[\s\S]*?Est\. price/);
  assert.match(component, /className=\{css\.lookTeaser\}/);
  assert.match(component, /partialPriceTeaser\(/);
  assert.match(component, /props\.unlocked \? "Details" : "View pricing"/);
  assert.match(css, /\.lookMeta \{[\s\S]*?position: absolute;/);
  assert.match(css, /\.lookTeaser \{[\s\S]*?filter: blur\(/);
  assert.match(css, /\.stickyCta \{[\s\S]*?position: sticky;/);
  // Gallery copy stays service-aware, with a shared header component across every step.
  assert.match(component, /See what’s possible for \$\{serviceName\}/);
  assert.match(component, /See what’s possible at your budget/);
  assert.match(component, /body="Choose the direction you love—your range can evolve from there\."/);
  assert.match(css, /\.stage\[data-stage="gallery"\] \.stepHead \{/);
});

test("V5 holds one type scale across every step", () => {
  const css = v5Css();

  // Seven steps, declared once.
  for (const token of ["hero", "display", "title", "lead", "body", "meta", "micro"]) {
    assert.match(css, new RegExp(`--v5-t-${token}:`));
  }
  // Nothing sets a size outside the scale, so step six matches step two.
  assert.doesNotMatch(css, /font-size: (?!var\()/);
  // Three weights, not six.
  const weights = Array.from(new Set(
    (css.match(/font-weight: \d+/g) || []).map((rule) => rule.replace("font-weight: ", ""))
  )).sort();
  assert.deepEqual(weights, ["400", "550", "600"]);
});

test("V5 keeps each step's action above the fold", () => {
  const component = experience();
  const css = v5Css();

  // Rhythm is measured against viewport height, not width.
  assert.match(css, /--v5-step-gap: clamp\(\d+px, [\d.]+vh/);
  assert.match(css, /--v5-block-gap: clamp\(\d+px, [\d.]+vh/);
  assert.match(css, /\.step \{[\s\S]*?gap: var\(--v5-step-gap\);/);
  // Media is capped so the price and its action stay on screen.
  assert.match(css, /\.canvas > img \{[\s\S]*?max-height: \d+dvh;/);
  assert.match(css, /\.compare img \{[\s\S]*?max-height: \d+dvh;/);
  /*
   * Price reveal stays a stacked mobile-style composition; customize widens
   * into side-by-side from 900px so direction tools keep the studio shell.
   */
  assert.match(component, /stage === "details"[\s\S]*?className=\{css\.split\}/);
  assert.match(component, /stage === "customize"[\s\S]*?className=\{css\.split\}/);
  assert.match(css, /\.stage\[data-stage="details"\] \.split,\s*\.stage\[data-stage="customize"\] \.split/);
  assert.match(css, /\.stage\[data-stage="details"\] \.step \{[\s\S]*?max-width: 680px;/);
  assert.match(component, /stage === "details"[\s\S]*?<StepHead[\s\S]*?title=\{selectedProject\.title\}/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.stage\[data-stage="details"\] \.split \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.stage\[data-stage="customize"\] \.split \{[\s\S]*?grid-template-columns: minmax\(0, 1\.35fr\) minmax\(300px, 0\.9fr\)/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.stage\[data-stage="customize"\] \.canvas \{[\s\S]*?aspect-ratio: 1 \/ 1;/);
  // Short viewports tighten instead of overflowing.
  assert.match(css, /@media \(max-height: 820px\)[\s\S]*?--v5-step-gap:/);
  assert.match(css, /@media \(max-height: 820px\)[\s\S]*?\.dirOption \{[\s\S]*?min-height: 44px/);
  // Choice rows and direction rows share one set of metrics.
  assert.match(css, /\.choice \{[\s\S]*?min-height: 60px/);
  assert.match(css, /\.dirOption \{[\s\S]*?min-height: 60px/);
});

test("V5 choreographs stage changes with a real transition, not a swap", () => {
  const component = experience();
  const css = v5Css();
  const globals = read("app/adventure/globals.css");

  // Stage changes run through a view transition where the browser supports one.
  assert.match(component, /startViewTransition/);
  assert.match(component, /flushSync\(/);
  assert.match(component, /dataset\.adventureTransition = direction/);
  assert.match(component, /transition\.finished/);
  // Direction-aware enter and exit animations for the outgoing screen.
  assert.match(globals, /html\[data-adventure-transition="forward"\]::view-transition-old\(root\)/);
  assert.match(globals, /html\[data-adventure-transition="forward"\]::view-transition-new\(root\)/);
  assert.match(globals, /html\[data-adventure-transition="back"\]::view-transition-old\(root\)/);
  assert.match(globals, /@keyframes adventure-stage-enter-up/);
  // Reduced motion opts out entirely.
  assert.match(globals, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  // The chrome is held out of the transition so the frame stays put.
  assert.match(css, /view-transition-name: v5chrome;/);
  // The per-child fallback stands down during the native transition and stays
  // down afterward; otherwise removing the temporary document flag starts a
  // second entrance animation and one click looks like two page refreshes.
  assert.match(css, /:global\(html\[data-adventure-transition\]\) \.step > \* \{\s*animation: none;/);
  assert.match(component, /rootRef\.current\.dataset\.nativeTransitions = "true"/);
  assert.match(css, /\.root\[data-native-transitions="true"\] \.step > \* \{\s*animation: none;/);
  // The wall assembles rather than appearing at once.
  assert.match(css, /@keyframes v5lookIn\b/);
});

test("V5 avoids SaaS chrome and keeps one primary action per step", () => {
  const css = v5Css();

  // Grouped rows carry a single shadow and inset hairlines, never per-row borders.
  assert.match(css, /\.choice \{[\s\S]*?border: none;/);
  assert.match(css, /\.choice \+ \.choice \{\s*box-shadow: inset 0 1px 0 var\(--v5-hair\);/);
  assert.match(css, /\.dirOption \+ \.dirOption \{\s*box-shadow: inset 0 1px 0 var\(--v5-hair\);/);
  // Headlines are centered and constrained; hierarchy comes from type, not boxes.
  assert.match(css, /\.stepHead \{[\s\S]*?text-align: center/);
  assert.match(css, /\.stepHead h1 \{[\s\S]*?font-size: var\(--v5-t-display\)/);
  // Chrome stays borderless and transparent so it doesn’t read as a header bar.
  assert.match(css, /\.chrome \{[\s\S]*?border-bottom: none;/);
  assert.match(css, /\.chrome \{[\s\S]*?background: transparent;/);
});

test("V5 is responsive and respects touch, safe areas, and reduced motion", () => {
  const css = v5Css();

  // Stacked by default, side-by-side configurator on larger screens.
  assert.match(css, /\.split \{[^}]*grid-template-columns: 1fr;/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.split \{[\s\S]*?grid-template-columns: minmax\(0, 1\.55fr\) minmax\(300px, 0\.7fr\)/);
  // The wall is two columns even on the smallest phone, and stops at V4's three.
  assert.match(css, /\.lookFlow \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(min-width: 881px\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  // Bottom sheets on phones, centered dialogs from tablet up.
  assert.match(css, /@media \(min-width: 640px\)[\s\S]*?\.scrim \{ align-items: center/);
  // Touch targets, safe areas, motion preference, focus ring.
  assert.match(css, /\.primaryAction \{[\s\S]*?min-height: 54px/);
  assert.match(css, /\.secondaryAction \{[\s\S]*?min-height: 50px/);
  assert.match(css, /\.choice \{[\s\S]*?min-height: 60px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /focus-visible/);
});

test("V5 states price impact in money and keeps secondary tools behind a disclosure", () => {
  const component = experience();

  assert.match(component, /function signedDeltaText\(/);
  assert.match(component, /function impactDeltaText\(/);
  assert.match(component, /About \$\{signedDeltaText\([^)]+\)\} from this choice/);
  assert.match(component, /This change moves your estimate by about \$\{signedDeltaText\(/);
  // No percentage deltas anywhere in the pricing UI.
  assert.doesNotMatch(component, /Math\.round\(option\.priceImpact \* 100\)/);
  assert.doesNotMatch(component, /liveRangeDelta/);
  // Parts and free-text sit behind one quiet line.
  assert.match(component, /More ways to adjust/);
  assert.match(component, /className=\{css\.moreWays\}/);

  /*
   * The delta is a span, and so is the option's description, so its column has
   * to be set by a selector that outranks `.dirOption span` or the two collapse
   * into each other at narrow widths.
   */
  const css = v5Css();
  assert.match(css, /\.dirOption \.dirDelta \{[\s\S]*?grid-column: 2;/);
  assert.match(css, /\.dirOption \.dirDelta \{[\s\S]*?white-space: nowrap;/);
});

test("V5 keeps the conversion gates and their wiring intact", () => {
  const component = experience();
  const css = v5Css();

  assert.match(component, /Unlock \{props\.project\.title\} pricing/);
  assert.match(component, /See pricing/);
  assert.match(component, /We’ll email your estimate\. Unsubscribe anytime\./);
  assert.match(component, /Keep customizing your project/);
  assert.match(component, /Unlock continued refinements/);
  assert.match(component, /This unlocks your project workspace\. It does not request a consultation\./);
  assert.match(component, /Pricing unlocked/);
  assert.match(component, /Customize this design/);
  assert.match(component, /Adjust this estimate/);
  assert.match(component, /See this direction in your own space/);
  assert.match(component, /Get a free pro review of this plan/);
  assert.match(component, /Get a free contractor review/);
  assert.match(component, /open=\{emailOpen && !snapshot\.lead\.emailCaptured\}/);
  assert.match(component, /captureEmail\(email, ""\)/);
  assert.match(component, /capturePhone\(phone\)/);
  assert.match(component, /adventure_v3_project_refinement_gate_viewed/);
  assert.match(component, /saveVisualPricingSnapshot\(instanceId, snapshot, routeVersion\)/);
  // Primary CTAs must win over the inherited root button color.
  assert.match(css, /\.root button\.primaryAction \{[\s\S]*?color: var\(--v5-on-accent\);/);
});

/*
 * V5 is a new interface for the previous version's words. Every line below is
 * asserted against that source first, so this list can only ever contain real
 * legacy copy, and against V5 second, so a redesign can move a line but never
 * rewrite it. Where the legacy file had two variants for a line, V5 takes the
 * plain-spoken one: budgets and prices, never "investment".
 */
test("V5 speaks entirely in the previous version's copy", () => {
  const component = experience();
  const legacy = read("components/adventure/v3/AdventureV3VisualPricingExperience.tsx");

  // Shared foundation still matches the previous funnel's language.
  const sharedCopy = [
    "Loading visual pricing…",
    "What are you planning?",
    "What do you need?",
    "What’s your budget?",
    "This helps us curate inspiration. It does not cap your project.",
    "See what’s possible at your budget",
    "Common at this level",
    "Estimated price hidden",
    "We couldn’t load the project gallery.",
    "Your estimate",
    "Planning range, not a quote",
    "What’s covered",
    "See your version in your space",
    "See pricing",
    "Keep customizing your project",
    "Unlock continued refinements",
    "Preview this direction",
    "Try another project direction",
    "See this direction in your own space.",
    "Upload or take a photo",
    "Keep browsing visual pricing",
    "What’s included",
    "Recommended priorities",
  ];

  for (const line of sharedCopy) {
    assert.ok(legacy.includes(line), `not legacy copy: ${line}`);
    assert.ok(component.includes(line), `V5 dropped shared copy: ${line}`);
  }

  // Conversion-tuned lines that intentionally diverge from legacy phrasing.
  for (const line of [
    "Unlock {props.project.title} pricing",
    "We’ll email your estimate. Unsubscribe anytime.",
    "Adjust this estimate",
    "Get a free pro review of this plan",
    "Get a free contractor review",
    "Most popular",
    "Something else",
    "Email to unlock full estimate",
  ]) {
    assert.ok(component.includes(line), `V5 missing conversion copy: ${line}`);
  }

  assert.ok(!component.includes("Skip for now — show a rough range"), "V5 should not allow skipping email");

  for (const invented of [
    "See your estimate",
    "Show my estimate",
    "One email. No spam",
    "Unlock more versions of your project",
    "Typically includes",
    "What moves this number",
    "Add a photo of your space",
    "Take one now or choose from your library",
    "Create my preview",
    "Keep browsing designs",
    "Moves with each revision you make.",
    "Preparing your estimate…",
    "Get started\n",
  ]) {
    assert.ok(!component.includes(invented), `V5 still paraphrases: ${invented}`);
  }

  // Money is a budget or a price here. "Investment" is not a word this funnel uses.
  assert.doesNotMatch(component, /investment/i);
  assert.doesNotMatch(v5Css(), /investment/i);
});
