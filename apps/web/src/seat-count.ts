export function sanitizeSeatInput(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function parseSeatInput(draft: string): number | null {
  if (!/^\d+$/.test(draft)) {
    return null;
  }
  const seats = Number.parseInt(draft, 10);
  return Number.isSafeInteger(seats) && seats >= 1 ? seats : null;
}

export function clampSeatCount(seats: number, max: number): number {
  return Math.min(max, Math.max(1, Math.trunc(seats)));
}
