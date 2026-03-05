"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MousePointer2 } from "lucide-react"
import { motion } from "framer-motion"

interface Props {
  containerId: string
  contactId: string
  contactFormId?: string
  heroId: string
  codeEmbedId?: string
  widgetId: string
  promptId: string
  generateButtonId: string
  resultId: string
  leadToastId: string
  beforeMetric: string
  afterMetric: string
  promptLength: number
  typedLength: number
  onTypePromptNext: () => void
  onPressGenerate: () => void
  onShowHero: () => void
  onHideHero: () => void
  onShowCodeEmbed?: () => void
  onHideCodeEmbed?: () => void
  onShowBeforeCard: () => void
  onHideBeforeCard: () => void
  onShowAfterCard?: () => void
  onHideAfterCard?: () => void
  onShowLeadCapture: () => void
  onShowGenerating: () => void
  onShowResult: () => void
  onHideLeadCapture: () => void
  scenarioId?: number
}

export default function HomepageTutorialOverlay(props: Props) {
  const { containerId, contactId, contactFormId, heroId, codeEmbedId, widgetId, promptId, generateButtonId, resultId, leadToastId, beforeMetric, afterMetric, promptLength, typedLength, onTypePromptNext, onPressGenerate, onShowHero, onHideHero, onShowCodeEmbed, onHideCodeEmbed, onShowBeforeCard, onHideBeforeCard, onShowAfterCard, onHideAfterCard, onShowLeadCapture, onShowGenerating, onShowResult, onHideLeadCapture, scenarioId } = props
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null)
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11>(1)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [targetRect, setTargetRect] = useState<{
    left: number
    top: number
    width: number
    height: number
    tl: number
    tr: number
    br: number
    bl: number
  } | null>(null)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const uidRef = useRef(Math.random().toString(36).slice(2))
  const currentTargetElRef = useRef<HTMLElement | null>(null)
  const lastTargetElRef = useRef<HTMLElement | null>(null)

  // Lead popup typing state
  const [showLeadPopup, setShowLeadPopup] = useState(false)
  const [typedEmail, setTypedEmail] = useState("")
  const [typedName, setTypedName] = useState("")
  const leadEmailTarget = "visitor@example.com"
  const leadNameTarget = "Alex Visitor"

  const LINGER = 5200
  const RETRY = 120
  const TOAST_DWELL = 3000

  function getContainerRect() {
    const c = containerEl ?? document.getElementById(containerId)
    if (!c) return null
    return c.getBoundingClientRect()
  }

  function getEl(id: string) {
    return document.getElementById(id) as HTMLElement | null
  }

  function clampToContainer(x: number, y: number) {
    const r = getContainerRect()
    if (!r) return { x, y }
    const pad = 6
    return {
      x: Math.max(pad, Math.min(r.width - pad, x)),
      y: Math.max(pad, Math.min(r.height - pad, y))
    }
  }

  function getCornerRadii(el: HTMLElement) {
    const cs = window.getComputedStyle(el)
    const tl = parseFloat(cs.borderTopLeftRadius || "0") || 0
    const tr = parseFloat(cs.borderTopRightRadius || "0") || 0
    const br = parseFloat(cs.borderBottomRightRadius || "0") || 0
    const bl = parseFloat(cs.borderBottomLeftRadius || "0") || 0
    return {
      tl: tl || 12,
      tr: tr || 12,
      br: br || 12,
      bl: bl || 12,
    }
  }

  function getRectForId(id: string) {
    const c = getContainerRect()
    const el = getEl(id)
    if (!c || !el) return null
    const r = el.getBoundingClientRect()
    const { tl, tr, br, bl } = getCornerRadii(el)
    return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height, tl, tr, br, bl }
  }

  function setHighlightTo(id: string) {
    const c = getContainerRect()
    const el = getEl(id)
    if (!c || !el) return
    const r = el.getBoundingClientRect()
    const { tl, tr, br, bl } = getCornerRadii(el)
    setTargetRect({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height, tl, tr, br, bl })
    currentTargetElRef.current = el
  }

  function moveTo(id: string, dx = 0, dy = 0) {
    const c = getContainerRect()
    const el = getEl(id)
    if (!c || !el) return
    const r = el.getBoundingClientRect()
    const pos = clampToContainer(r.left - c.left + r.width / 2 + dx, r.top - c.top + r.height / 2 + dy)
    setCursorPos(pos)
    const { tl, tr, br, bl } = getCornerRadii(el)
    setTargetRect({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height, tl, tr, br, bl })
    currentTargetElRef.current = el
  }

  function schedule(fn: () => void, ms: number) {
    // Allow multiple scheduled steps to run in sequence without cancelling previous ones
    window.setTimeout(fn, ms)
  }

  function moveWhenReady(id: string, dx = 0, dy = 0, attempts = 14, after?: () => void) {
    const el = getEl(id)
    if (el) {
      moveTo(id, dx, dy)
      if (after) after()
      return
    }
    if (attempts > 0) setTimeout(() => moveWhenReady(id, dx, dy, attempts - 1, after), RETRY)
  }

  useEffect(() => {
    const el = document.getElementById(containerId) as HTMLElement | null
    setContainerEl(el)
    const handle = () => {
      if (step === 1) {
        const r = getContainerRect()
        if (r) setCursorPos({ x: r.width * 0.5, y: r.height * 0.22 })
      } else if (step === 2) {
        moveWhenReady(contactId)
        if (contactFormId) setHighlightTo(contactFormId)
      } else if (step === 3) {
        // Drag step: focus snippet pill and highlight editor drop zone
        moveWhenReady('mock-draggable-snippet')
        setHighlightTo('mock-embed-editor')
        // Ensure code embed section is visible to the user
        try { document.getElementById('code-embed-section')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch {}
      } else if (step === 4) {
        // Paste step: focus embed editor
        moveWhenReady('mock-embed-editor', -12, 8)
        setHighlightTo('mock-embed-editor')
        // Ensure editor is visible while pasting
        try { document.getElementById('mock-embed-editor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch {}
      } else if (step === 5) moveWhenReady(widgetId)
      else if (step === 6) moveWhenReady(promptId, -8, 12)
      else if (step === 7) moveWhenReady(generateButtonId)
      else if (step === 8) {
        // highlight popup when open
        if (showLeadPopup) setHighlightTo("lead-popup")
      } else if (step === 9) {
        // Lead capture toast: highlight it, but move cursor away so it doesn't cover the card
        setHighlightTo(leadToastId)
        const r = getContainerRect()
        if (r) setCursorPos({ x: Math.max(12, r.width * 0.14), y: Math.max(12, r.height * 0.18) })
      }
      else if (step === 10) moveWhenReady(resultId, 16, 16)
    }
    const ro = new ResizeObserver(handle)
    const mo = new MutationObserver(handle)
    if (el) {
      ro.observe(el)
      mo.observe(el, { attributes: true, childList: true, subtree: true })
    }
    window.addEventListener("resize", handle)
    window.addEventListener("scroll", handle, true)
    handle()
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener("resize", handle)
      window.removeEventListener("scroll", handle, true)
    }
  }, [containerId, step, contactId, contactFormId, heroId, promptId, generateButtonId, resultId, leadToastId, showLeadPopup])

  // Apply a single pulse on the currently focused element and a brief shrink on the previous one
  useEffect(() => {
    // Wait for DOM updates of highlight targeting
    const id = requestAnimationFrame(() => {
      const prev = lastTargetElRef.current
      const next = currentTargetElRef.current

      if (prev && prev !== next) {
        try {
          prev.classList.remove('tutorial-pulse-once')
          prev.classList.add('tutorial-shrink-once')
          const handlePrev = () => prev.classList.remove('tutorial-shrink-once')
          prev.addEventListener('animationend', handlePrev, { once: true } as any)
        } catch {}
      }

      if (next) {
        try {
          next.classList.remove('tutorial-shrink-once')
          next.classList.add('tutorial-pulse-once')
          const handleNext = () => next.classList.remove('tutorial-pulse-once')
          next.addEventListener('animationend', handleNext, { once: true } as any)
        } catch {}
      }

      lastTargetElRef.current = next || prev
    })
    return () => cancelAnimationFrame(id)
  }, [step, targetRect])

  // Cleanup animation classes on unmount
  useEffect(() => {
    return () => {
      try {
        lastTargetElRef.current?.classList.remove('tutorial-pulse-once', 'tutorial-shrink-once')
        currentTargetElRef.current?.classList.remove('tutorial-pulse-once', 'tutorial-shrink-once')
      } catch {}
    }
  }, [])

  useEffect(() => {
    const run = () => {
      if (runningRef.current) return
      runningRef.current = true
      // Ensure any external lead toast is hidden at the start of a new loop
      onHideLeadCapture()
      // Reset site state at loop start: show hero (mock site), hide widget and before-card
      onShowHero()
      onHideBeforeCard()
      setStep(1)
      setShowLeadPopup(false)
      setTypedEmail("")
      setTypedName("")
      const r = getContainerRect()
      if (r) setCursorPos({ x: r.width * 0.5, y: r.height * 0.22 })
      schedule(() => {
        setStep(2)
        onShowBeforeCard()
        onShowHero() // Show standard site (no widget) during BEFORE
        moveWhenReady(contactId)
        schedule(() => {
          // Move to Code Embed step - Step 3: Drag embed block
          onHideBeforeCard()
          setStep(3)
          if (typeof onShowCodeEmbed === 'function') onShowCodeEmbed()
          if (codeEmbedId) moveWhenReady(codeEmbedId)
          // Show dragging action
          schedule(() => {
            try { document.dispatchEvent(new CustomEvent('demo:dragToEmbed')) } catch {}
            moveWhenReady('mock-draggable-snippet', 0, 0)
            schedule(() => {
              // Step 4: Paste code snippet (separate step)
              setStep(4)
              schedule(() => {
                try { document.dispatchEvent(new CustomEvent('demo:dropEmbed')) } catch {}
                try { document.dispatchEvent(new CustomEvent('demo:pasteEmbed')) } catch {}
              }, 500)
            }, 1200) // Longer pause between drag and paste steps
          }, 600)
          // Chain AFTER (Step 5) to occur after Step 4 paste completes, not in parallel
          schedule(() => {
            // Move to AFTER (widget) step
            if (typeof onHideCodeEmbed === 'function') onHideCodeEmbed()
            onHideHero()
            setStep(5)
            if (typeof onShowAfterCard === 'function') onShowAfterCard()
            moveWhenReady(widgetId)
            schedule(() => {
              onHideHero()
              if (typeof onHideAfterCard === 'function') onHideAfterCard()
              setStep(6)
              moveWhenReady(promptId, -8, 12)
              // Type the prompt under overlay control
              let i = typedLength
              const typeEnd = promptLength
              const typer = setInterval(() => {
                if (i >= typeEnd) {
                  clearInterval(typer)
                  return
                }
                onTypePromptNext()
                i++
              }, 70)
              schedule(() => {
                setStep(7)
                moveWhenReady(generateButtonId)
                schedule(() => {
                  // Lead popup + type email/name
                  setStep(8)
                  setShowLeadPopup(true)
                  schedule(() => {
                    moveWhenReady("lead-popup-email", -20, 0)
                    let i = 0
                    const typerEmail = setInterval(() => {
                      i++
                      setTypedEmail(leadEmailTarget.slice(0, i))
                      if (i >= leadEmailTarget.length) {
                        clearInterval(typerEmail)
                        // Now type Name
                        schedule(() => {
                          moveWhenReady("lead-popup-name", -20, 0)
                          let j = 0
                          const typerName = setInterval(() => {
                            j++
                            setTypedName(leadNameTarget.slice(0, j))
                            if (j >= leadNameTarget.length) {
                              clearInterval(typerName)
                              // Move to submit and submit
                              schedule(() => {
                                moveWhenReady("lead-popup-submit", 0, 0)
                                schedule(() => {
                                  // Close popup and clear highlight
                                  setShowLeadPopup(false)
                                  setTargetRect(null)
                                  // Trigger demo state changes in sequence (separate views)
                                  onPressGenerate()
                                  onShowLeadCapture()
                                  // 1) Highlight toast
                                  schedule(() => {
                                    setStep(9)
                                    moveWhenReady(leadToastId, -10, -10)
                                    // Final step: highlight result image while showing a central generating bubble
                                    schedule(() => {
                                      setStep(10)
                                      onHideLeadCapture()
                                      onShowGenerating()
                                      moveWhenReady(resultId, 16, 16)
                                      // Show the generated image while keeping the bubble visible (overlay renders it)
                                      schedule(() => {
                                        onShowResult()
                                        // Allow the tutorial to loop by resetting the running flag
                                        schedule(() => {
                                          runningRef.current = false
                                          run()
                                        }, LINGER)
                                      }, 600)
                                    }, TOAST_DWELL)
                                  }, 0)
                                }, 600)
                              }, 400)
                            }
                          }, 65)
                        }, 300)
                      }
                    }, 65)
                  }, 300)
                }, LINGER)
              }, LINGER)
            }, LINGER)
          }, LINGER)
        }, LINGER)
      }, LINGER)
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(run))
    return () => cancelAnimationFrame(id)
  }, [contactId, promptId, generateButtonId, resultId, leadToastId, onHideLeadCapture])

  function narrationForStep() {
    if (step === 2) return `📊 Before: ${beforeMetric} via previous flow`
    if (step === 3) return `🧩 Drag embed block into your site`
    if (step === 4) return `📋 Paste one line of code`
    if (step === 5) return `✨ After: 2.5X website engagement with AI widget`
    if (step === 6) return `✍️ Your visitor types a request in the AI visualizer`
    if (step === 7) return `🚀 Your visitor clicks Generate (popup will request details)`
    if (step === 8) return `📧 Your visitor enters email & name`
    if (step === 9) return `🎯 Lead captured`
    if (step === 10) return `🎨 User sees their AI results`
    return null
  }

  if (!containerEl) return null

  const narration = narrationForStep()
  const labelStyle = (() => {
    if (!targetRect) return null
    const cw = containerEl.clientWidth
    const ch = containerEl.clientHeight
    const cardWidth = 280 // Wider for internal cards
    const cardHeight = 50
    const margin = 12
    
    // Try to position to the right first, then left, then above/below
    let left = targetRect.left + targetRect.width + margin
    let top = targetRect.top + targetRect.height / 2 - cardHeight / 2 // Center vertically
    
    // If too far right, try left side
    if (left + cardWidth > cw - margin) {
      left = targetRect.left - cardWidth - margin
    }
    
    // If still too far left, position above
    if (left < margin) {
      left = Math.max(margin, targetRect.left + targetRect.width / 2 - cardWidth / 2)
      top = targetRect.top - cardHeight - margin
    }
    
    // If too high, position below
    if (top < margin) {
      top = targetRect.top + targetRect.height + margin
    }
    
    // If too low, position above again
    if (top + cardHeight > ch - margin) {
      top = targetRect.top - cardHeight - margin
    }
    
    return { left, top }
  })()

  const overlay = (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
      {/* Global, minimal keyframes for per-step pulse/shrink on real elements */}
      <style jsx global>{`
        @keyframes tutorial-pulse {
          0% { scale: 1; }
          40% { scale: 1.03; }
          100% { scale: 1; }
        }
        .tutorial-pulse-once {
          animation: tutorial-pulse 1600ms ease-in-out 1;
          transform-origin: center;
        }
        @keyframes tutorial-shrink {
          0% { scale: 1; }
          60% { scale: 0.965; }
          100% { scale: 1; }
        }
        .tutorial-shrink-once {
          animation: tutorial-shrink 300ms ease-out 1;
          transform-origin: center;
        }
      `}</style>
      {/* Dimming within the demo card */}
      {step === 1 ? (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.22) 100%)',
            }}
          />
        </div>
      ) : targetRect ? (
        <>
          {(() => {
            const dpr = window.devicePixelRatio || 1
            const snap = (v: number) => Math.round(v * dpr) / dpr
            const cw = Math.round(containerEl.clientWidth)
            const ch = Math.round(containerEl.clientHeight)
            // Adjust for container border: absolute positioning uses the padding box as origin
            const cs = window.getComputedStyle(containerEl)
            const borderLeft = parseFloat(cs.borderLeftWidth || "0") || 0
            const borderTop = parseFloat(cs.borderTopWidth || "0") || 0
            const clamp = (v: number, w: number, h: number) => Math.max(0, Math.min(v, Math.min(w, h) / 2))

            // Determine which rects to cut out: in step 2, both contact button and form; otherwise targetRect only
            const rects = (() => {
              if (step === 2) {
                const r1 = getRectForId(contactId)
                const r2 = contactFormId ? getRectForId(contactFormId) : null
                return [r1, r2].filter(Boolean) as typeof targetRect[]
              }
              return [targetRect]
            })()

            function pathForRect(rr: NonNullable<typeof targetRect>) {
              const left = snap(rr.left - borderLeft)
              const top = snap(rr.top - borderTop)
              const width = snap(rr.width)
              const height = snap(rr.height)
              const tl = snap(clamp(rr.tl, width, height))
              const tr = snap(clamp(rr.tr, width, height))
              const br = snap(clamp(rr.br, width, height))
              const bl = snap(clamp(rr.bl, width, height))
              return [
                `M ${left + tl} ${top}`,
                `H ${left + width - tr}`,
                `A ${tr} ${tr} 0 0 1 ${left + width} ${top + tr}`,
                `V ${top + height - br}`,
                `A ${br} ${br} 0 0 1 ${left + width - br} ${top + height}`,
                `H ${left + bl}`,
                `A ${bl} ${bl} 0 0 1 ${left} ${top + height - bl}`,
                `V ${top + tl}`,
                `A ${tl} ${tl} 0 0 1 ${left + tl} ${top}`,
                'Z',
              ].join(' ')
            }
            const id = uidRef.current
            return (
              <svg width={cw} height={ch} style={{ position: 'absolute', inset: 0 }} shapeRendering="geometricPrecision">
                <defs>
                  <mask id={`mask-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={cw} height={ch}>
                    <rect width={cw} height={ch} fill="white" />
                    {rects.map((rr, i) => (
                      <path key={i} d={pathForRect(rr!)} fill="black" />
                    ))}
                  </mask>
                </defs>
                <rect width={cw} height={ch} fill="rgba(0,0,0,0.12)" mask={`url(#mask-${id})`} />
              </svg>
            )
          })()}
        </>
      ) : null}

      {/* Sparkle effect around AFTER (Step 5) */}
      {step === 5 && targetRect && (() => {
        const dpr = window.devicePixelRatio || 1
        const snap = (v: number) => Math.round(v * dpr) / dpr
        const cs = window.getComputedStyle(containerEl)
        const borderLeft = parseFloat(cs.borderLeftWidth || "0") || 0
        const borderTop = parseFloat(cs.borderTopWidth || "0") || 0
        const left = snap(targetRect.left - borderLeft)
        const top = snap(targetRect.top - borderTop)
        const width = snap(targetRect.width)
        const height = snap(targetRect.height)
        // Neutral, color-agnostic palette that works in light/dark
        const sparkleFill = 'rgba(255,255,255,0.95)'
        const sparkleStroke = 'rgba(229,231,235,0.9)' // gray-200
        const glow = 'rgba(255,255,255,0.65)'

        // Star positions around the widget
        const stars = [
          { x: left + width * 0.15, y: top - 18, s: 12 },
          { x: left + width * 0.45, y: top - 26, s: 16 },
          { x: left + width * 0.80, y: top - 16, s: 13 },
          { x: left + width + 18, y: top + height * 0.18, s: 14 },
          { x: left + width + 24, y: top + height * 0.52, s: 16 },
          { x: left + width + 18, y: top + height * 0.84, s: 14 },
          { x: left + width * 0.22, y: top + height + 18, s: 13 },
          { x: left + width * 0.72, y: top + height + 22, s: 15 },
          { x: left - 18, y: top + height * 0.25, s: 12 },
          { x: left - 22, y: top + height * 0.72, s: 13 },
        ]

        // Rising particle specs (small glowing dots drifting up)
        const particles = Array.from({ length: 10 }).map((_, i) => ({
          x: left + width * (0.2 + 0.6 * ((i % 5) / 4)),
          y: top + height * (0.3 + 0.4 * (i < 5 ? 0 : 1)),
          d: 900 + i * 120,
          r: 2 + (i % 3),
          delay: i * 0.15,
        }))

        const starPath = 'M12 2l2.95 6.12L22 9.27l-5 4.87 1.18 6.86L12 17.77 5.82 21l1.18-6.86-5-4.87 7.05-1.15L12 2z'

        return (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {/* Starbursts */}
            {stars.map((p, i) => (
              <motion.svg
                key={`star-${i}`}
                width={p.s}
                height={p.s}
                viewBox="0 0 24 24"
                style={{ position: 'absolute', left: p.x, top: p.y, filter: `drop-shadow(0 2px 4px ${glow})`, mixBlendMode: 'screen' }}
                initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
                animate={{ opacity: [0, 1, 0.2, 0.9, 0], scale: [0.7, 1.25, 0.95, 1.15, 0.8], rotate: [0, 25, -15, 10, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
              >
                <path d={starPath} fill={sparkleFill} />
                <path d={starPath} fill="none" stroke={sparkleStroke} strokeWidth={1.1} />
              </motion.svg>
            ))}

            {/* Rising particles */}
            {particles.map((p, i) => (
              <motion.div
                key={`part-${i}`}
                style={{ position: 'absolute', left: p.x, top: p.y, width: p.r * 2, height: p.r * 2, borderRadius: '9999px', background: sparkleFill, boxShadow: `0 0 8px ${glow}`, mixBlendMode: 'screen' }}
                initial={{ opacity: 0, y: 0, scale: 0.9 }}
                animate={{ opacity: [0, 0.9, 0], y: [-6, -22, -36], scale: [0.9, 1.1, 0.7] }}
                transition={{ duration: p.d / 1000, repeat: Infinity, ease: 'easeOut', delay: p.delay }}
              />
            ))}
          </div>
        )
      })()}

      {/* Mock lead popup (Step 5) */}
      {showLeadPopup && (
        <div id="lead-popup" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-[260px] md:w-[320px] rounded-lg border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-black shadow-xl p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Send design to your email</div>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-gray-600 dark:text-white/80 mb-1">Email</div>
                <div id="lead-popup-email" className="h-8 rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-black px-2 text-[12px] flex items-center">
                  <span className="text-gray-800 dark:text-white/90">{typedEmail}</span>
                  <span className="w-[1px] h-3 bg-gray-800 dark:bg-white ml-1 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 dark:text-white/80 mb-1">Name (optional)</div>
                <div id="lead-popup-name" className="h-8 rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-black px-2 text-[12px] flex items-center">
                  <span className="text-gray-800 dark:text-white/90">{typedName}</span>
                  {!typedName && <span className="text-white/50 ml-1">Your name</span>}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div id="lead-popup-submit" className="pointer-events-none select-none rounded bg-gray-900 text-white text-[12px] px-3 py-1.5 shadow">Submit</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cursor with label inside the demo card only (hidden during lead toast for readability) */}
      {step !== 8 && (
        <div className="absolute inset-0">
          <motion.div
            style={{ position: "absolute", left: cursorPos.x, top: cursorPos.y }}
            className="-translate-x-1 -translate-y-1 z-[60]"
            animate={step === 1 ? { x: [0, 6, 0], y: [0, -4, 0] } : { x: 0, y: 0 }}
            transition={step === 1 ? { duration: 1.2, ease: "easeInOut", repeat: Infinity } : { duration: 0.2 }}
          >
            <div className="flex items-center gap-1">
              {step === 1 && (
                <span className="absolute -inset-2 rounded-full border border-white/70 bg-white/10 animate-ping" />
              )}
              <MousePointer2 className="relative h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
              <span className="text-[10px] text-white bg-black/70 px-1.5 py-0.5 rounded">Website visitor</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Step 1 label */}
      {step === 1 && (
        <div className="absolute left-1/2 top-10 -translate-x-1/2 text-[12px] bg-white/80 dark:bg-gray-900/80 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">👋</span>
            <span className="font-medium">A visitor has landed on your site</span>
          </div>
        </div>
      )}

      {/* Narration label near highlighted area (hidden during step 2; external card used) */}
      {narration && labelStyle && step !== 2 && (
        <div style={{ position: "absolute", left: labelStyle.left, top: labelStyle.top, zIndex: 65 }}>
          <div className="text-[12px] bg-white/85 dark:bg-gray-900/85 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm max-w-[280px]">
            <div className="flex items-start gap-3">
              <span className="text-sm mt-0.5">{narration.split(' ')[0]}</span>
              <div className="flex-1 min-w-0 text-left">
                <span className="font-medium leading-tight">{narration.split(' ').slice(1).join(' ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 helper hint near editor */}
      {step === 4 && targetRect && (
        <div style={{ position: 'absolute', left: targetRect.left + targetRect.width - 90, top: targetRect.top - 26, zIndex: 66 }}>
          <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-black/70 text-white border border-white/20">
            <span className="opacity-90">⌘</span>
            <span>+ V</span>
            <span className="ml-1 opacity-80">Paste code</span>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(overlay, containerEl)
}
