import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V9 is a thin themed wrapper over the shared V8 behavior engine", () => {
  const wrapper = read("components/adventure/v9/AdventureV9Experience.tsx");
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const legacyStyles = read("components/adventure/v8/configurator-v8.module.css");

  assert.match(wrapper, /<AdventureV8Experience \{\.\.\.props\} uiVersion="v9"/);
  assert.match(wrapper, /configurator-v9\.module\.css/);
  assert.match(wrapper, /data-adventure-v9-theme="solid"/);
  assert.match(engine, /<AdventureUiProvider version=\{uiVersion\}>/);
  assert.doesNotMatch(legacyStyles, /data-adventure-version="v9"/);
});

test("every V9 form control routes through the version-aware UI layer", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const ui = read("components/adventure/shared/AdventureUi.tsx");

  assert.doesNotMatch(engine, /<button\b/);
  assert.doesNotMatch(engine, /<input\b/);
  assert.doesNotMatch(engine, /<Button\b|<Input\b/);
  assert.match(engine, /<AdventureButton/);
  assert.match(engine, /<AdventureChoiceCard/);
  assert.match(engine, /<AdventureInput/);
  assert.match(engine, /<AdventureActionBar/);
  assert.match(ui, /version === "v8" && !legacyShadcn/);
  assert.match(ui, /return <button/);
  assert.match(ui, /return <input/);
  assert.match(ui, /data-adventure-ui="button"/);
  assert.match(ui, /data-adventure-ui="choice-card"/);
});

test("V9 linear selections use explicit primary actions except the intentional no-photo shortcut", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");

  assert.match(engine, /uiVersion === "v9" \? patch\(\{ serviceId \}\) : void onSelectService/);
  assert.match(engine, /disabled=\{!state\.serviceId\}/);
  assert.match(engine, /onClick=\{\(\) => state\.serviceId && void onSelectService\(state\.serviceId\)\}/);
  assert.match(engine, /disabled=\{!scopeReady\}/);
  assert.match(engine, /disabled=\{!state\.finishTierId\}/);
  assert.match(engine, /disabled=\{!state\.styleId \|\| state\.generating\}/);
  assert.match(engine, /onClick=\{\(\) => void continueWithoutPhoto\(\)\}/);
  assert.match(engine, /state\.photoPathChosen === true/);
  assert.doesNotMatch(engine, /Continue to projects/);
});

test("V9 navigation and progress cover skipped-service and photo/no-photo paths", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");

  assert.match(engine, /const firstStep = state\.serviceSkipped \? "project" : "service"/);
  assert.match(engine, /uiVersion === "v8" \|\| state\.stage !== firstStep/);
  assert.match(engine, /!\(serviceSkipped && s === "service"\)/);
  assert.match(engine, /!\(photoPathChosen === false && s === "style"\)/);
  assert.match(engine, /return `Step \$\{idx \+ 1\} of \$\{visible\.length\}`/);
});

test("V9 photo intake uses one premium upload target instead of explanatory demo cards", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const copySource = read("components/adventure/v8/adventureCopy.ts");
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(engine, /uiVersion === "v9" \? \([\s\S]*?data-adventure-ui="photo-uploader"/);
  assert.match(engine, /data-adventure-ui="photo-dropzone"[\s\S]*?<Camera \/>[\s\S]*?data-adventure-ui="photo-upload-copy"/);
  assert.match(engine, /Choose a \{industryLanguage\.photoSubject\} photo/);
  assert.doesNotMatch(engine, /data-adventure-ui="photo-upload-arrow"/);
  assert.match(engine, /JPG, PNG or HEIC/);
  assert.match(engine, /<p>No photo\?<\/p>/);
  assert.match(engine, /Continue without one/);
  assert.match(copySource, /preciseTitle: `Have a photo of your \$\{language\.photoSubject\}\?`/);
  assert.match(copySource, /Upload it and we'll use your actual space for a more accurate estimate\./);
  assert.doesNotMatch(styles, /data-stage="path"\] \[data-adventure-ui="step-body"\]/);
  assert.match(styles, /data-adventure-ui="photo-uploader"[\s\S]*?width:\s*min\(100%, 560px\);[\s\S]*?margin:\s*0;/);
  assert.match(
    styles,
    /data-adventure-ui="photo-dropzone"[\s\S]*?min-height:\s*80px;[\s\S]*?flex-direction:\s*row;[\s\S]*?border:\s*1px solid #d9d9d9;[\s\S]*?border-radius:\s*16px;[\s\S]*?background:\s*hsl\(var\(--background\)\);/
  );
  assert.match(styles, /data-adventure-ui="photo-upload-icon"[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*#f4f4f4;/);
});

test("V9 uses stable responsive masonry columns, image overlays, and image-level view controls", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");
  const v9GalleryBranch = engine
    .split('{uiVersion === "v9" ? pricingMasonryColumns.map')[1]
    .split(')) : pricingMasonryColumns.map')[0];

  assert.match(engine, /uiVersion === "v9" \? pricingMasonryColumns\.map/);
  assert.match(engine, /data-adventure-ui="project-grid"/);
  assert.match(engine, /data-adventure-ui="project-column"/);
  assert.match(engine, /--project-aspect/);
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--pricing-column-count, 1\)/);
  assert.match(styles, /data-adventure-ui="project-column"[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(styles, /column-count:/);
  assert.match(engine, /loading="eager"/);
  assert.match(styles, /data-adventure-ui="project-caption"\]\)\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(v9GalleryBranch, /data-adventure-ui="project-title"/);
  assert.match(v9GalleryBranch, /\{copy\.gallery\.action\}/);
  assert.doesNotMatch(v9GalleryBranch, /project-price|project-features|project-locality|cardEstimate|superlative/);

  const toolbar = engine.indexOf('data-adventure-ui="media-toolbar"');
  const figure = engine.lastIndexOf("<figure", toolbar);
  const figureEnd = engine.indexOf("</figure>", toolbar);
  const viewControl = engine.indexOf('data-adventure-ui="segmented-control"', figure);
  assert.ok(toolbar > figure && toolbar < figureEnd, "the V9 toolbar must float over the media figure");
  assert.ok(viewControl > figure, "the Before/After switch must render over the media figure");
  assert.match(engine, /aria-label="Download after image"/);
  assert.match(engine, /aria-label="View after image full screen"/);
  assert.match(engine, /aria-label="Share after image"/);
  assert.match(styles, /data-adventure-ui=\\?"media-toolbar\\?"[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*12px;[\s\S]*?right:\s*12px/);
  assert.match(styles, /data-adventure-ui=\\?"media-toolbar\\?"[\s\S]*?data-intent=\\?"icon\\?"[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px/);
});

test("V9 locked pricing uses a larger sentence-case estimate and a clear pricing opt-in", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(engine, /data-adventure-ui="price-label">\{copy\.detail\.priceLabel\}/);
  assert.match(engine, /data-adventure-ui="unlock-heading">[\s\S]*?Get instant pricing/);
  assert.match(engine, /<LockOpen aria-hidden="true" \/>[\s\S]*?Unlock/);
  assert.match(engine, /href="\/terms"[\s\S]*?Terms &amp; Conditions/);
  assert.match(engine, /We’ll never send you spam\. :\)/);
  assert.doesNotMatch(engine, /Instant access\./);
  assert.doesNotMatch(engine, /Instant — see your price/);
  assert.match(styles, /data-adventure-ui="locked-price"[\s\S]*?font-size:\s*28px/);
  assert.match(styles, /data-adventure-ui="locked-price-digits"[\s\S]*?border-radius:\s*999px;[\s\S]*?filter:\s*blur\(3px\)/);
  assert.match(styles, /data-adventure-ui="unlock-form"[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?gap:\s*6px/);
  assert.doesNotMatch(styles, /data-access="locked"\]\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.55fr\)/);
  assert.match(styles, /data-adventure-ui="price-label"[\s\S]*?text-transform:\s*none/);
  assert.match(styles, /data-adventure-ui="segmented-control"[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*12px;[\s\S]*?left:\s*12px/);
});

test("V9 unlock opens the breakdown and refinement stays in the same pricing rail", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(engine, /setPricingDetailMode\("review"\);[\s\S]*?emailCaptured: true/);
  assert.match(engine, /data-adventure-ui="estimate-breakdown"/);
  assert.match(engine, /data-adventure-ui="refinement-section"/);
  assert.match(engine, /data-adventure-ui="refinement-targets"/);
  assert.match(engine, /data-adventure-ui="refinement-suggestions"/);
  assert.match(engine, /data-adventure-ui="refinement-references"/);
  assert.match(engine, /data-adventure-ui="refinement-prompt"/);
  assert.match(engine, /aria-label=\{pricingDetailMode === "refine" \? "View price and breakdown"/);
  assert.match(engine, /View price &amp; breakdown/);
  assert.match(styles, /data-access="unlocked"[\s\S]*?data-adventure-ui="pricing-panel"[\s\S]*?gap:\s*0;[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /data-adventure-ui="refinement-targets"[\s\S]*?data-adventure-ui="button"[\s\S]*?min-height:\s*34px/);
  assert.match(styles, /data-adventure-ui="refinement-prompt"[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(styles, /data-adventure-ui="estimate-return"[\s\S]*?border-radius:\s*999px/);
});

test("V9 desktop uses the full application canvas instead of a centered form card", () => {
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(
    styles,
    /data-adventure-ui="navigation"\]\)\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?border:\s*0;/
  );
  assert.match(
    styles,
    /data-adventure-ui="viewport"\]\)\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?box-shadow:\s*none;/
  );
  assert.doesNotMatch(styles, /max-width:\s*760px|\),\s*760px\)/);
});

test("V9 keeps navigation, actions, toggles, and selected states visually consistent", () => {
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(
    styles,
    /data-adventure-ui="navigation"\]\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;[\s\S]*?border:\s*0;/
  );
  assert.match(
    styles,
    /data-adventure-ui="action-bar"\]\)\s*\{[\s\S]*?min-height:\s*72px;[\s\S]*?justify-content:\s*flex-end/
  );
  assert.match(
    styles,
    /data-adventure-ui="button"\]\[aria-pressed="true"\][\s\S]*?background:\s*hsl\(var\(--primary\)\);[\s\S]*?color:\s*hsl\(var\(--primary-foreground\)\)/
  );
  assert.match(
    styles,
    /data-adventure-ui="choice-card"\]\[aria-pressed="true"\]:hover:not\(:disabled\)[\s\S]*?background:\s*hsl\(var\(--primary\)\)/
  );
  assert.match(
    styles,
    /data-adventure-ui="media-toolbar"\]\)\s*\{[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.74\);[\s\S]*?background:\s*linear-gradient/
  );
});

test("V9 text-choice steps use the same compact wrapping pill layout", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.match(engine, /className=\{css\.stack\} data-adventure-ui="choice-grid"/);
  assert.match(styles, /data-stage="project"/);
  assert.match(styles, /data-stage="budget"/);
  assert.match(styles, /data-stage="path"/);
  assert.match(styles, /data-stage="connect"/);
  assert.match(
    styles,
    /data-stage="project"\][\s\S]*?data-adventure-ui="choice-grid"[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?gap:\s*8px;/
  );
  assert.match(
    styles,
    /data-stage="project"\][\s\S]*?data-intent="choice"[\s\S]*?width:\s*auto;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*999px;/
  );
  assert.match(styles, /data-intent="choice"\] > \*\)[\s\S]*?align-items:\s*center;[\s\S]*?margin:\s*0;/);
  assert.match(styles, /span:first-child[\s\S]*?width:\s*14px;[\s\S]*?min-width:\s*14px/);
  assert.match(styles, /div::after[\s\S]*?width:\s*14px;[\s\S]*?min-width:\s*14px;[\s\S]*?margin-left:\s*4px/);
});

test("V9 gallery is frameless and scrollable with image titles, get-price actions, and a centered photo action", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const loader = read("components/form/AdventureLoader.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");

  assert.doesNotMatch(engine, /PRICING_GALLERY_SUPERLATIVES|data-adventure-ui="project-superlative"/);
  assert.match(engine, /data-adventure-ui="project-title"/);
  assert.match(engine, /\{copy\.gallery\.action\}/);
  assert.match(engine, /<span aria-hidden="true">＋<\/span>\s*Add your own photo/);
  assert.match(
    styles,
    /data-adventure-ui="gallery-scroll"[\s\S]*?overflow-y:\s*auto;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?padding:\s*0 2px 18px 0;/
  );
  assert.doesNotMatch(styles, /data-adventure-ui="project-superlative"/);
  assert.match(styles, /data-adventure-ui="gallery-action-bar"[\s\S]*?justify-content:\s*center;/);
  assert.match(engine, /data-loading=\{!state\.looks\.length && state\.generating \? "true" : "false"\}/);
  assert.match(styles, /data-adventure-ui="gallery-scroll"\]\[data-loading="true"\][\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*transparent;/);
  assert.doesNotMatch(loader, /subMessages|subMessage=\{subMessage\}/);
});

test("V9 uses solid semantic surfaces, inherited branding, and accessible motion/focus contracts", () => {
  const engine = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v9/configurator-v9.module.css");
  const nonPriceStyles = styles.replace(
    /\.theme :global\(\[data-adventure-version="v9"\] \[data-adventure-ui="locked-price-digits"\]\) \{[\s\S]*?\n\}/g,
    ""
  );

  assert.doesNotMatch(engine, /\bZap\b|<Zap/);
  assert.match(styles, /font-family:\s*inherit/);
  assert.match(styles, /min-height:\s*48px/);
  assert.match(styles, /outline:\s*2px solid hsl\(var\(--ring\)\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(nonPriceStyles, /blur\([1-9]/);
  assert.doesNotMatch(styles, /background:\s*rgba\(/);
  assert.match(styles, /position:\s*static !important/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(320px, 0\.8fr\)/);
});
