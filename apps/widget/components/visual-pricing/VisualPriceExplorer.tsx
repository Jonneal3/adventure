"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import styles from "./visual-price-explorer.module.css";

type TierKey = "essential" | "complete" | "premium";
type Stage = "browse" | "compare" | "gate" | "revealed" | "designer";

const TIERS: Array<{ key: TierKey; label: string; detail: string }> = [
  { key: "essential", label: "Essential", detail: "The foundation, beautifully resolved" },
  { key: "complete", label: "Complete", detail: "More features, finish, and flexibility" },
  { key: "premium", label: "Premium", detail: "Elevated materials and signature details" },
];

const LOOKS = [
  {
    name: "Modern Outdoor Living",
    eyebrow: "Warm minimalism",
    description: "Clean lines, natural stone, and spaces made for long evenings.",
    images: {
      essential: "/visual-pricing/modern-essential.png",
      complete: "/visual-pricing/modern-complete.png",
      premium: "/visual-pricing/modern-premium.png",
    },
    prices: { essential: "$28–38k", complete: "$52–72k", premium: "$95–135k" },
  },
  {
    name: "Resort-Inspired Retreat",
    eyebrow: "Relaxed luxury",
    description: "Layered greenery and generous gathering spaces with a getaway feel.",
    images: {
      essential: "/visual-pricing/landscape-1.png",
      complete: "/visual-pricing/landscape-2.png",
      premium: "/visual-pricing/landscape-3.png",
    },
    prices: { essential: "$32–44k", complete: "$64–86k", premium: "$110–155k" },
  },
  {
    name: "Garden Courtyard",
    eyebrow: "Quiet & architectural",
    description: "A private, planted room shaped by texture, shade, and soft light.",
    images: {
      essential: "/visual-pricing/courtyard-before.png",
      complete: "/visual-pricing/courtyard-after.png",
      premium: "/visual-pricing/example-9.png",
    },
    prices: { essential: "$24–34k", complete: "$46–66k", premium: "$82–118k" },
  },
  {
    name: "Social Backyard",
    eyebrow: "Built to gather",
    description: "Flexible dining, fire, and lounge zones for easy entertaining.",
    images: {
      essential: "/visual-pricing/landscape-2.png",
      complete: "/visual-pricing/example-8.png",
      premium: "/visual-pricing/modern-premium.png",
    },
    prices: { essential: "$30–42k", complete: "$58–78k", premium: "$98–142k" },
  },
  {
    name: "Natural Modern",
    eyebrow: "Softly structured",
    description: "Organic planting meets crisp geometry and grounded materials.",
    images: {
      essential: "/visual-pricing/landscape-3.png",
      complete: "/visual-pricing/modern-complete.png",
      premium: "/visual-pricing/example-9.png",
    },
    prices: { essential: "$26–36k", complete: "$50–70k", premium: "$88–128k" },
  },
] as const;

const SUGGESTIONS = [
  "Add a plunge pool",
  "Make it more private",
  "Use warmer materials",
  "Add an outdoor kitchen",
];

const STORAGE_KEY = "adventure.visual-pricing.v1";

export function VisualPriceExplorer({ compact = false }: { compact?: boolean }) {
  const [lookIndex, setLookIndex] = useState(0);
  const [tier, setTier] = useState<TierKey>("complete");
  const [stage, setStage] = useState<Stage>("browse");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("Keep this budget");
  const [generating, setGenerating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const look = LOOKS[lookIndex];

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      if (Number.isInteger(saved.lookIndex)) setLookIndex(Math.min(saved.lookIndex, LOOKS.length - 1));
      if (TIERS.some((item) => item.key === saved.tier)) setTier(saved.tier);
      if (saved.email) {
        setEmail(saved.email);
        setStage("revealed");
      }
    } catch {
      // Session restoration is a progressive enhancement.
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lookIndex, tier, email: stage === "browse" || stage === "gate" ? "" : email }));
  }, [lookIndex, tier, email, stage]);

  const nextLook = (direction: number) => {
    setLookIndex((current) => (current + direction + LOOKS.length) % LOOKS.length);
  };

  const selectedTier = useMemo(
    () => TIERS.find((item) => item.key === tier) || TIERS[1],
    [tier],
  );

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email to reveal your ranges.");
      return;
    }
    setError("");
    setStage("revealed");
  };

  const runGeneration = () => {
    setGenerating(true);
    window.setTimeout(() => setGenerating(false), 1600);
  };

  if (stage !== "browse") {
    return (
      <main className={styles.shell} data-compact={compact}>
        <section className={`${styles.focusCard} ${stage === "designer" ? styles.designerCard : ""}`}>
          <button className={styles.closeButton} onClick={() => setStage("browse")} aria-label="Back to looks">
            <X size={18} />
          </button>
          <div className={styles.focusVisual}>
            <img src={look.images[tier]} alt={`${look.name}, ${selectedTier.label} level`} />
            <div className={styles.imageTag}>
              <span>{look.name}</span>
              <b>{selectedTier.label}</b>
            </div>
          </div>

          {stage === "compare" && (
            <div className={styles.comparePanel}>
              <p className={styles.kicker}>Pricing direction selected</p>
              <h1>See this look at three project levels</h1>
              <p className={styles.support}>Compare what changes at each level. Exact ranges unlock next.</p>
              <div className={styles.compareTierList} role="tablist" aria-label="Project level">
                {TIERS.map((item) => (
                  <button
                    key={item.key}
                    role="tab"
                    aria-selected={tier === item.key}
                    className={tier === item.key ? styles.activeCompareTier : ""}
                    onClick={() => setTier(item.key)}
                  >
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                    <Check size={16} />
                  </button>
                ))}
              </div>
              <div className={styles.levelChanges}>
                <span>Materials</span><span>Features</span><span>Complexity</span><span>Finish</span>
              </div>
              <button className={styles.compareCta} onClick={() => setStage("gate")}>
                Reveal pricing for this look <ArrowRight size={18} />
              </button>
              <p className={styles.finePrint}>No design questionnaire or project photo required.</p>
            </div>
          )}

          {stage === "gate" && (
            <div className={styles.gatePanel}>
              <div className={styles.readyIcon}><LockKeyhole size={20} /></div>
              <p className={styles.kicker}>Your selected direction</p>
              <h1>Pricing for this look is ready</h1>
              <p className={styles.support}>Enter your email to reveal all three ranges and receive a copy.</p>
              <PriceCards look={look} locked />
              <form className={styles.emailForm} onSubmit={submitEmail}>
                <div className={styles.emailField}>
                  <Mail size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email address"
                  />
                </div>
                <button type="submit">Reveal my pricing <ArrowRight size={17} /></button>
              </form>
              {error && <p className={styles.error}>{error}</p>}
              <p className={styles.finePrint}>No phone number. No sales call required.</p>
            </div>
          )}

          {stage === "revealed" && (
            <div className={styles.gatePanel}>
              <div className={styles.successIcon}><Check size={20} /></div>
              <p className={styles.kicker}>Your pricing guide</p>
              <h1>Here’s what this look can cost</h1>
              <p className={styles.support}>Planning ranges for a project like this. Your copy is ready for {email}.</p>
              <PriceCards look={look} locked={false} selected={tier} />
              <div className={styles.refineCallout}>
                <div>
                  <span><Sparkles size={15} /> Next step · optional</span>
                  <h2>Want to change anything about this design?</h2>
                  <p>Keep this direction and make it feel more like yours.</p>
                </div>
                <button onClick={() => setStage("designer")}>Change this design <WandSparkles size={17} /></button>
              </div>
            </div>
          )}

          {stage === "designer" && (
            <div className={styles.designPanel}>
              <p className={styles.kicker}>AI design studio</p>
              <h1>Make this direction your own</h1>
              <p className={styles.support}>Describe a change or start with one of these ideas.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} onClick={() => setPrompt(suggestion)}>{suggestion}</button>
                ))}
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Try “Add a slim plunge pool and keep the warm cedar…”"
              />
              <div className={styles.designerControls}>
                <select value={budget} onChange={(event) => setBudget(event.target.value)} aria-label="Budget adjustment">
                  <option>Keep this budget</option>
                  <option>Reduce budget</option>
                  <option>Increase budget</option>
                  <option>Not sure yet</option>
                </select>
                <label className={styles.upload}>
                  <ImagePlus size={17} /> Add project photo
                  <input type="file" accept="image/*" />
                </label>
                <button className={styles.generateButton} onClick={runGeneration} disabled={generating || !prompt.trim()}>
                  {generating ? <LoaderCircle className={styles.spinner} size={18} /> : <WandSparkles size={18} />}
                  {generating ? "Creating variations…" : "Create variations"}
                </button>
              </div>
              {!generating && prompt && (
                <div className={styles.variationReady}>
                  <Sparkles size={18} />
                  <div><b>Your change is ready to explore</b><span>Generate variations to continue refining this design.</span></div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (compact) {
    return (
      <main className={styles.compactShell}>
        <section className={styles.compactExplorer}>
          <header className={styles.compactHeader}>
            <p className={styles.kicker}>Popular project ideas</p>
            <h1>See popular designs—and what they cost.</h1>
            <p>Swipe through ideas. Open any look to reveal pricing.</p>
          </header>

          <div
            className={styles.compactCarousel}
            onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => {
              if (touchStart === null) return;
              const distance = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
              if (Math.abs(distance) > 45) nextLook(distance < 0 ? 1 : -1);
              setTouchStart(null);
            }}
          >
            <button
              className={`${styles.arrow} ${styles.compactArrowLeft}`}
              onClick={() => nextLook(-1)}
              aria-label="Previous design"
            >
              <ArrowLeft size={20} />
            </button>

            <button
              className={styles.compactCard}
              onClick={() => setStage("compare")}
              aria-label={`See pricing for ${look.name}`}
            >
              <img src={look.images.complete} alt={look.name} />
              <span className={styles.compactShade} />
              <span className={styles.compactCardCopy}>
                <small>{look.eyebrow}</small>
                <strong>{look.name}</strong>
                <span>See pricing <ArrowRight size={17} /></span>
              </span>
            </button>

            <div className={styles.nextPeek} aria-hidden="true">
              <img src={LOOKS[(lookIndex + 1) % LOOKS.length].images.complete} alt="" />
            </div>

            <button
              className={`${styles.arrow} ${styles.compactArrowRight}`}
              onClick={() => nextLook(1)}
              aria-label="Next design"
            >
              <ArrowRight size={20} />
            </button>
          </div>

          <footer className={styles.compactFooter}>
            <div className={styles.compactCounter}>
              <button onClick={() => nextLook(-1)} aria-label="Previous design"><ArrowLeft size={16} /></button>
              <span><b>{lookIndex + 1}</b> of {LOOKS.length}</span>
              <button onClick={() => nextLook(1)} aria-label="Next design"><ArrowRight size={16} /></button>
            </div>
            <button className={styles.generalPricing} onClick={() => setStage("compare")}>
              Not sure which look? <span>Get general pricing</span>
            </button>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-compact={compact}>
      <section className={`${styles.explorer} ${styles.galleryExplorer}`}>
        <header className={styles.header}>
          <div className={styles.brandMark}><span>A</span><b>ADVENTURE</b></div>
          <div className={styles.headerCopy}>
            <p className={styles.kicker}>{compact ? "Visual price preview" : "Visual Price Explorer"}</p>
            <h1>{compact ? "See what your yard could look like" : "See what different project levels can look like—and reveal the pricing."}</h1>
            {!compact && <p>Browse real design directions, compare investment levels, and choose the closest fit.</p>}
          </div>
          {!compact && <div className={styles.stepPill}><span>1</span> Explore looks</div>}
        </header>

        <div className={styles.lookGallery}>
          {LOOKS.map((item, index) => (
            <button
              key={item.name}
              className={styles.lookCard}
              onClick={() => {
                setLookIndex(index);
                setTier("complete");
                setStage("compare");
              }}
            >
              <span className={styles.lookCardImage}>
                <img src={item.images.complete} alt={item.name} />
                <span>See pricing for this look <ArrowRight size={16} /></span>
              </span>
              <span className={styles.lookCardMeta}>
                <small>{item.eyebrow}</small>
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
            </button>
          ))}
        </div>

        <footer className={styles.galleryFooter}>
          <Sparkles size={15} />
          <span>Choose something close—your selection only helps make the pricing more relevant.</span>
        </footer>
      </section>
    </main>
  );
}

function PriceCards({
  look,
  locked,
  selected,
}: {
  look: (typeof LOOKS)[number];
  locked: boolean;
  selected?: TierKey;
}) {
  return (
    <div className={styles.priceGrid}>
      {TIERS.map((item) => (
        <div key={item.key} className={selected === item.key ? styles.selectedPrice : ""}>
          <span>{item.label}</span>
          <b aria-label={locked ? `${item.label} price locked` : look.prices[item.key]}>
            {locked ? "$••–•••k" : look.prices[item.key]}
          </b>
          <small>{item.detail}</small>
          {locked && <LockKeyhole size={15} />}
        </div>
      ))}
    </div>
  );
}
