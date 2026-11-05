"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Experience, FormElement, PriceRange } from "@adventure/experience";
import styles from "./service-experience.module.css";

type PublicExperience = Omit<Experience, "priceRanges">;
type Config = { instanceId: string; name: string; revision: number; experience: PublicExperience };
type SavedProject = { projectId: string; token: string };
const key = (id: string, preview: boolean) => `adventure:project:v2:${id}:${preview ? 'preview' : 'customer'}`;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

async function api(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`/api/platform${path}`, { ...init, cache: "no-store", headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(token ? { "x-adventure-project-token": token } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status})`);
  return body;
}

export function ServiceExperience({ initial }: { initial: Config }) {
  const [config, setConfig] = useState(initial);
  const [project, setProject] = useState<SavedProject | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [range, setRange] = useState<PriceRange | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [quoted, setQuoted] = useState(false);
  const [visualAssets, setVisualAssets] = useState<{ assetId: string; url: string }[]>([]);

  const start = useCallback(async () => {
    const path = `/adventure/${initial.instanceId}`;
    const previewToken = new URLSearchParams(window.location.search).get('preview');
    const storageKey = key(initial.instanceId, !!previewToken);
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as SavedProject | null;
    if (saved?.projectId && saved?.token) {
      try {
        const resumed = await api(`${path}/projects/${saved.projectId}`, {}, saved.token);
        setProject(saved);
        setConfig(current => ({ ...current, experience: resumed.experience }));
        setServiceId(resumed.serviceId || "");
        setAnswers(resumed.answers || {});
        setAssetIds((resumed.experience.elements as FormElement[]).filter(element => element.kind === 'upload').map(element => (resumed.answers || {})[element.id]).filter((value: unknown): value is string => typeof value === 'string'));
        setRange(resumed.revealedRange || null);
        setQuoted(!!resumed.quoteRequested);
        if (resumed.revealedRange) setStep((resumed.experience.elements as FormElement[]).findIndex(e => e.kind === "price"));
        return;
      } catch { localStorage.removeItem(storageKey); }
    }
    const created = await api(`${path}/projects`, { method: "POST", body: JSON.stringify({ previewToken: previewToken || undefined }) });
    const next = { projectId: created.projectId, token: created.token };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setProject(next);
    setConfig(current => ({ ...current, experience: created.experience }));
  }, [initial.instanceId]);

  useEffect(() => { void start().catch(reason => setError(reason.message || "Unable to start")); }, [start]);
  const elements = useMemo(() => config.experience.elements.filter(element => !element.serviceIds.length || element.serviceIds.includes(serviceId)), [config.experience.elements, serviceId]);
  const current = elements[Math.min(step, elements.length - 1)];
  const base = project ? `/adventure/${initial.instanceId}/projects/${project.projectId}` : "";

  async function next() {
    if (!project || !current) return;
    setError(""); setBusy(true);
    try {
      if (current.kind === "service") {
        if (!serviceId) throw new Error("Choose a service to continue");
        await api(`${base}/answers`, { method: "PATCH", body: JSON.stringify({ serviceId, answers: {} }) }, project.token);
      } else if (["single_choice", "multi_choice", "text", "number", "measurement"].includes(current.kind)) {
        const value = answers[current.id];
        if (current.required && (value == null || value === "" || Array.isArray(value) && !value.length)) throw new Error("Complete this step to continue");
        await api(`${base}/answers`, { method: "PATCH", body: JSON.stringify({ serviceId, answers: { [current.id]: value } }) }, project.token);
      } else if (current.kind === 'upload') {
        const value = answers[current.id];
        if (current.required && !value) throw new Error('Add a photo to continue');
        if (value) await api(`${base}/answers`, { method: 'PATCH', body: JSON.stringify({ serviceId, answers: { [current.id]: value } }) }, project.token);
      } else if (current.kind === "contact") {
        if (!email || !phone) throw new Error("Enter your email and phone number");
        const result = await api(`${base}/contact`, { method: "POST", body: JSON.stringify({ email, phone }) }, project.token);
        setRange(result.range);
      } else if (current.kind === "quote") {
        await api(`${base}/quote`, { method: "POST", body: JSON.stringify({ note }) }, project.token);
        setQuoted(true);
        return;
      }
      setStep(index => Math.min(index + 1, elements.length - 1));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to continue"); }
    finally { setBusy(false); }
  }

  async function upload(file: File, purpose: "scene" | "tryon_person" | "tryon_item", elementId?: string) {
    if (!project) return;
    if (file.size > 10_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPG, PNG, or WebP under 10 MB"); return; }
    setBusy(true); setError("");
    try {
      const signed = await api(`${base}/assets`, { method: "POST", body: JSON.stringify({ purpose, contentType: file.type }) }, project.token);
      const response = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!response.ok) throw new Error("Upload failed");
      setAssetIds(ids => [...ids, signed.assetId]);
      if (elementId) setAnswers(old => ({ ...old, [elementId]: signed.assetId }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!project) return;
    setBusy(true); setError("");
    try {
      const created = await api(`${base}/visual`, { method: "POST", body: JSON.stringify({ requestKey: crypto.randomUUID(), referenceAssetIds: assetIds, brief: String(answers["brief"] || "") }) }, project.token);
      for (let attempts = 0; attempts < 45; attempts += 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await api(`${base}/visual/${created.jobId}`, {}, project.token);
        if (result.status === "complete") { setVisualAssets(result.assets || []); return; }
        if (result.status === "failed") throw new Error("The preview failed. Try again.");
      }
      throw new Error("The preview is still being prepared. Please return shortly.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preview failed"); }
    finally { setBusy(false); }
  }

  function question(element: FormElement) {
    const value = answers[element.id];
    if (element.kind === "service") return <div className={styles.options}>{element.options.map(option => <button type="button" className={serviceId === option.value ? styles.selected : ""} key={option.value} onClick={() => { setServiceId(option.value); setStep(0); }}>{option.label}</button>)}</div>;
    if (element.kind === "single_choice") return <div className={styles.options}>{element.options.map(option => <button type="button" className={value === option.value ? styles.selected : ""} key={option.value} onClick={() => setAnswers(old => ({ ...old, [element.id]: option.value }))}>{option.label}</button>)}</div>;
    if (element.kind === "multi_choice") return <div className={styles.options}>{element.options.map(option => <button type="button" className={Array.isArray(value) && value.includes(option.value) ? styles.selected : ""} key={option.value} onClick={() => setAnswers(old => { const values = Array.isArray(old[element.id]) ? old[element.id] as string[] : []; return { ...old, [element.id]: values.includes(option.value) ? values.filter(item => item !== option.value) : [...values, option.value] }; })}>{option.label}</button>)}</div>;
    if (element.kind === "text") return <textarea value={String(value || "")} onChange={event => setAnswers(old => ({ ...old, [element.id]: event.target.value }))} rows={4} />;
    if (element.kind === "number" || element.kind === "measurement") return <div className={styles.measure}><input type="number" min="0" value={String(value || "")} onChange={event => setAnswers(old => ({ ...old, [element.id]: event.target.value ? Number(event.target.value) : "" }))}/>{element.unit && <span>{element.unit}</span>}</div>;
    if (element.kind === "upload") return <label className={styles.upload}>Add a project photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, "scene", element.id); }} />{value ? ' Photo added' : ''}</label>;
    if (element.kind === "visual") return <div className={styles.visual}><p>{element.visualJob === "tryon" ? "Add a photo of the person or space and the item to try." : "Add a photo of your space for a closer preview."}</p><div className={styles.uploadRow}><label>Project photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, element.visualJob === "tryon" ? "tryon_person" : "scene"); }} /></label>{element.visualJob === "tryon" && <label>Item photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, "tryon_item"); }} /></label>}</div><button type="button" onClick={() => void generate()} disabled={busy}>{busy ? "Preparing…" : "Generate preview"}</button>{visualAssets.length > 0 && <div className={styles.gallery}>{visualAssets.map(asset => <img src={asset.url} alt="Project preview" key={asset.assetId} />)}</div>}</div>;
    if (element.kind === "contact") return <div className={styles.fields}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Phone<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} required /></label></div>;
    if (element.kind === "price") return range ? <div className={styles.price}>{money(range.minCents)}–{money(range.maxCents)}<small>Estimated range. Final pricing follows business review.</small></div> : <p>Provide your contact details to reveal the range.</p>;
    if (element.kind === "quote") return quoted ? <p className={styles.done}>Your request has been sent. The business will follow up.</p> : <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Anything else the business should know?" />;
    return null;
  }

  return <main className={styles.page}><header className={styles.header}><strong>{config.name}</strong><span>Plan your project</span></header><div className={styles.card}>{!project ? <p>Preparing your experience…</p> : current ? <><div className={styles.progress}>Step {step + 1} of {elements.length}</div><h1>{current.label}</h1>{question(current)}{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button type="button" onClick={() => setStep(index => Math.max(0, index - 1))} disabled={step === 0 || busy}>Back</button>{!(current.kind === "quote" && quoted) && <button type="button" className={styles.primary} onClick={() => void next()} disabled={busy || current.kind === "price" && !range}>{busy ? "Saving…" : current.kind === "quote" ? "Request quote" : "Continue"}</button>}</div></> : <p>This experience has no steps.</p>}</div></main>;
}
