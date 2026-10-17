export const referenceTokens = {
  color: {
    canvas: "#edf4f7",
    canvasRaised: "#f8fbfc",
    ink: "#15222b",
    muted: "#5f707b",
    outline: "#bed0d8",
    signal: "#d55f2a",
    signalSoft: "#fce5d8",
    telemetry: "#0d6b75",
    telemetrySoft: "#d9eff0",
  },
  font: {
    body: "Inter, ui-sans-serif, system-ui, sans-serif",
    mono: "SFMono-Regular, Consolas, Liberation Mono, monospace",
  },
  radius: {
    card: "1.25rem",
    control: "0.75rem",
  },
  shadow: {
    panel: "0 18px 50px rgba(21, 34, 43, 0.08)",
  },
  space: {
    page: "1.5rem",
    room: "2rem",
  },
} as const;

/** Shared interaction timings in milliseconds. */
export const motionTokens = {
  feedback: 120,
  enter: 180,
  exit: 120,
  disclosureOpen: 220,
  disclosureClose: 160,
} as const;

export const semanticStatusColors = {
  light: {
    success: { color: "#1f6b45", foreground: "#ffffff", soft: "#e8f4ec" },
    warning: { color: "#805400", foreground: "#ffffff", soft: "#fff2d0" },
    danger: { color: "#a51d16", foreground: "#ffffff", soft: "#fbe9e8" },
    info: { color: "#155f8b", foreground: "#ffffff", soft: "#e8f2f9" },
  },
  dark: {
    success: { color: "#72d59b", foreground: "#07150d", soft: "#13291e" },
    warning: { color: "#ffd166", foreground: "#241900", soft: "#33270d" },
    danger: { color: "#ff827a", foreground: "#250706", soft: "#361513" },
    info: { color: "#7bc8f3", foreground: "#061d2b", soft: "#102d3b" },
  },
} as const;

/**
 * React Native aliases for the shared reference palette. Web themes have their
 * own semantic mappings; these values keep the mobile interface on the same
 * color roles while preserving its existing canvas and action colors.
 */
export const mobilePalettes = {
  light: {
    canvas: referenceTokens.color.canvas,
    canvasRaised: referenceTokens.color.canvasRaised,
    destructive: "#b42318",
    ink: referenceTokens.color.ink,
    inputBackground: "#ffffff",
    muted: referenceTokens.color.muted,
    onSignal: "#171009",
    outline: referenceTokens.color.outline,
    controlBorder: "#767676",
    signal: referenceTokens.color.signal,
    signalSoft: referenceTokens.color.signalSoft,
    telemetry: referenceTokens.color.telemetry,
    telemetrySoft: referenceTokens.color.telemetrySoft,
    status: semanticStatusColors.light,
  },
  dark: {
    canvas: "#10181d",
    canvasRaised: "#182229",
    destructive: "#f97066",
    ink: "#eef4f7",
    inputBackground: "#1c2830",
    muted: "#93a6b1",
    onSignal: "#171009",
    outline: "#31434e",
    controlBorder: "#808080",
    signal: "#e97a45",
    signalSoft: "#3a2418",
    telemetry: "#4db8c2",
    telemetrySoft: "#123a3f",
    status: semanticStatusColors.dark,
  },
} as const;
