export function roundBudgetStep(span: number): number {
  const raw = Math.max(100, Math.round(span / 20));
  if (raw >= 10000) return Math.max(1000, Math.round(raw / 1000) * 1000);
  if (raw >= 5000) return Math.max(500, Math.round(raw / 500) * 500);
  if (raw >= 1000) return Math.max(250, Math.round(raw / 250) * 250);
  return Math.max(100, Math.round(raw / 100) * 100);
}

export function niceBudgetFloor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / magnitude;
  if (scaled >= 10) return 10 * magnitude;
  if (scaled >= 5) return 5 * magnitude;
  if (scaled >= 2) return 2 * magnitude;
  return magnitude;
}

export function niceBudgetCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / magnitude;
  if (scaled <= 1) return magnitude;
  if (scaled <= 2) return 2 * magnitude;
  if (scaled <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function deriveBudgetSliderRange(seedMin: number, seedMax: number, fallbackMin: number, fallbackMax: number) {
  const minInput = Number.isFinite(seedMin) && seedMin > 0 ? seedMin : null;
  const maxInput = Number.isFinite(seedMax) && seedMax > 0 ? seedMax : null;
  const baseline =
    minInput !== null && maxInput !== null
      ? (minInput + maxInput) / 2
      : maxInput !== null
        ? maxInput
        : minInput !== null
          ? minInput * 1.2
          : (fallbackMin + fallbackMax) / 2;

  const minTarget = baseline / 3;
  const maxTarget = baseline * 3.333;
  let min = niceBudgetFloor(minTarget);
  let max = niceBudgetCeil(maxTarget);

  if (minInput !== null) min = Math.min(min, niceBudgetFloor(minInput * 0.9));
  if (maxInput !== null) max = Math.max(max, niceBudgetCeil(maxInput * 1.1));
  if (max <= min) max = niceBudgetCeil(min * 2);

  min = Math.max(100, Math.round(min));
  max = Math.max(min + 100, Math.round(max));
  const step = roundBudgetStep(max - min);
  return { min, max, step };
}
