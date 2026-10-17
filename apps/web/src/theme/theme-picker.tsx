"use client";

import { useEffect, useRef, useState } from "react";

import { toast } from "../toast";
import type { AppLocale } from "@supastack/i18n";
import { copyForLocale, localizedAxis, paletteDescription } from "../ui/ui-copy";
import { APPEARANCE_APPLIED_EVENT, markAppearanceChanged } from "./appearance";
import { applyTheme, DEFAULT_THEME_ID, THEME_CATALOG, resolveThemeId, themeById } from "./catalog";
import { applyStyle, currentStyleId, STYLE_CATALOG } from "./styles";
import { runThemeTransition, type ThemeTransitionOrigin } from "./theme-transition";
import {
  applyDensity,
  applyFontPairing,
  applyLayout,
  applyRadius,
  applyToastStyle,
  DEFAULT_DENSITY_ID,
  DEFAULT_FONT_PAIRING_ID,
  DEFAULT_LAYOUT_ID,
  DEFAULT_RADIUS_ID,
  DEFAULT_TOAST_STYLE_ID,
  DENSITY_CATALOG,
  FONT_PAIRING_CATALOG,
  LAYOUT_CATALOG,
  RADIUS_CATALOG,
  TOAST_STYLE_CATALOG,
  resolveDensityId,
  resolveFontPairingId,
  resolveLayoutId,
  resolveRadiusId,
  resolveToastStyleId,
  type DensityId,
  type FontPairingId,
  type LayoutId,
  type RadiusId,
  type ToastStyleId,
} from "./presets";

type PresetCatalog = typeof DENSITY_CATALOG;

/** Rect center of the clicked control — reveal origin for keyboard/virtual picks. */
function elementCenter(element: Element): ThemeTransitionOrigin {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function PresetRadiogroup({
  legend,
  name,
  catalog,
  selected,
  onSelect,
}: {
  legend: string;
  name: string;
  catalog: PresetCatalog;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="theme-picker">
      <legend>{legend}</legend>
      <div className="theme-picker-grid" role="radiogroup" aria-label={legend}>
        {catalog.map((entry) => (
          <label className="theme-option theme-option-plain" key={entry.id}>
            <input
              aria-label={entry.name}
              checked={selected === entry.id}
              name={name}
              onChange={() => {
                onSelect(entry.id);
              }}
              type="radio"
              value={entry.id}
            />
            <span>
              <strong>{entry.name}</strong>
              <span>{entry.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ThemePicker({ locale = "en" }: { locale?: AppLocale | undefined }) {
  const copy = copyForLocale(locale);
  const presetCatalog = (catalog: PresetCatalog) =>
    catalog.map((entry) => ({
      ...entry,
      name: localizedAxis(copy, entry.id),
      description: locale === "en" ? entry.description : "",
    }));
  const [selected, setSelected] = useState(DEFAULT_THEME_ID);
  const [density, setDensity] = useState<DensityId>(DEFAULT_DENSITY_ID);
  const [radius, setRadius] = useState<RadiusId>(DEFAULT_RADIUS_ID);
  const [font, setFont] = useState<FontPairingId>(DEFAULT_FONT_PAIRING_ID);
  const [layout, setLayout] = useState<LayoutId>(DEFAULT_LAYOUT_ID);
  const [toastStyle, setToastStyle] = useState<ToastStyleId>(DEFAULT_TOAST_STYLE_ID);
  const [style, setStyle] = useState("");
  /* Click point for the "spread of color" reveal — pointerdown carries real
     coordinates (change events don't); keyboard activation falls back to the
     control's rect center in onChange. `forId` guards stale origins. */
  const pointerOriginRef = useRef<(ThemeTransitionOrigin & { forId: string }) | undefined>(
    undefined,
  );

  useEffect(() => {
    function syncFromDom() {
      const root = document.documentElement;
      setSelected(resolveThemeId(root.dataset.theme));
      setDensity(resolveDensityId(root.dataset.density));
      setRadius(resolveRadiusId(root.dataset.radius));
      setFont(resolveFontPairingId(root.dataset.font));
      setLayout(resolveLayoutId(root.dataset.layout));
      setToastStyle(resolveToastStyleId(root.dataset.toastStyle));
      setStyle(currentStyleId());
    }
    syncFromDom();
    /* A server-snapshot apply repaints the axes without touching this
       component's state — re-read the DOM so an open picker reflects it. */
    window.addEventListener(APPEARANCE_APPLIED_EVENT, syncFromDom);
    return () => window.removeEventListener(APPEARANCE_APPLIED_EVENT, syncFromDom);
  }, []);

  return (
    <div className="theme-picker-stack">
      <fieldset className="theme-picker">
        <legend>{copy.appearance.style}</legend>
        <p className="quiet-note">{copy.appearance.styleHelp}</p>
        <div className="theme-picker-grid" role="radiogroup" aria-label={copy.appearance.style}>
          {STYLE_CATALOG.map((entry) => {
            const pack = themeById(entry.theme);
            return (
              <label
                className="theme-option"
                key={entry.id}
                onPointerDown={(event) => {
                  pointerOriginRef.current = {
                    forId: entry.id,
                    x: event.clientX,
                    y: event.clientY,
                  };
                }}
              >
                <input
                  aria-label={entry.name}
                  checked={style === entry.id}
                  name="supastack-style"
                  onChange={(event) => {
                    const pending = pointerOriginRef.current;
                    pointerOriginRef.current = undefined;
                    const origin =
                      pending?.forId === entry.id ? pending : elementCenter(event.currentTarget);
                    runThemeTransition(() => {
                      applyStyle(entry.id);
                      markAppearanceChanged();
                      const root = document.documentElement;
                      setStyle(currentStyleId());
                      setSelected(resolveThemeId(root.dataset.theme));
                      setDensity(resolveDensityId(root.dataset.density));
                      setRadius(resolveRadiusId(root.dataset.radius));
                      setFont(resolveFontPairingId(root.dataset.font));
                      setLayout(resolveLayoutId(root.dataset.layout));
                      setToastStyle(resolveToastStyleId(root.dataset.toastStyle));
                    }, origin);
                  }}
                  type="radio"
                  value={entry.id}
                />
                <span
                  aria-hidden="true"
                  className="theme-swatch"
                  style={{
                    background: pack.tokens["--page"],
                    borderColor: pack.tokens["--border-strong"],
                  }}
                >
                  <span style={{ background: pack.tokens["--accent"] }} />
                </span>
                <span>
                  <strong>{entry.name}</strong>
                  <span>
                    {locale === "en"
                      ? entry.description
                      : [
                          pack.name,
                          localizedAxis(copy, entry.density),
                          localizedAxis(copy, entry.radius),
                          localizedAxis(copy, entry.font),
                          localizedAxis(copy, entry.layout),
                        ].join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="theme-picker">
        <legend>{copy.appearance.theme}</legend>
        <p className="quiet-note">{copy.appearance.themeHelp}</p>
        <div className="theme-picker-grid" role="radiogroup" aria-label={copy.appearance.theme}>
          {THEME_CATALOG.map((theme) => (
            <label
              className="theme-option"
              key={theme.id}
              onPointerDown={(event) => {
                pointerOriginRef.current = {
                  forId: theme.id,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
            >
              <input
                aria-label={theme.name}
                checked={selected === theme.id}
                name="supastack-theme"
                onChange={(event) => {
                  const pending = pointerOriginRef.current;
                  pointerOriginRef.current = undefined;
                  const origin =
                    pending?.forId === theme.id ? pending : elementCenter(event.currentTarget);
                  runThemeTransition(() => {
                    setSelected(applyTheme(theme.id));
                    markAppearanceChanged();
                    setStyle(currentStyleId());
                  }, origin);
                }}
                type="radio"
                value={theme.id}
              />
              <span
                aria-hidden="true"
                className="theme-swatch"
                style={{
                  background: theme.tokens["--page"],
                  borderColor: theme.tokens["--border-strong"],
                }}
              >
                <span style={{ background: theme.tokens["--accent"] }} />
              </span>
              <span>
                <strong>{theme.name}</strong>
                <span>{paletteDescription(locale, theme.id, theme.description)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <PresetRadiogroup
        catalog={presetCatalog(DENSITY_CATALOG)}
        legend={copy.appearance.density}
        name="supastack-density"
        onSelect={(id) => {
          setDensity(applyDensity(id));
          markAppearanceChanged();
          setStyle(currentStyleId());
        }}
        selected={density}
      />
      <PresetRadiogroup
        catalog={presetCatalog(RADIUS_CATALOG)}
        legend={copy.appearance.radius}
        name="supastack-radius"
        onSelect={(id) => {
          setRadius(applyRadius(id));
          markAppearanceChanged();
          setStyle(currentStyleId());
        }}
        selected={radius}
      />
      <PresetRadiogroup
        catalog={presetCatalog(FONT_PAIRING_CATALOG)}
        legend={copy.appearance.font}
        name="supastack-font"
        onSelect={(id) => {
          setFont(applyFontPairing(id));
          markAppearanceChanged();
          setStyle(currentStyleId());
        }}
        selected={font}
      />
      <PresetRadiogroup
        catalog={presetCatalog(LAYOUT_CATALOG)}
        legend={copy.appearance.layout}
        name="supastack-layout"
        onSelect={(id) => {
          setLayout(applyLayout(id));
          markAppearanceChanged();
          setStyle(currentStyleId());
        }}
        selected={layout}
      />
      <fieldset className="theme-picker">
        <legend>{copy.appearance.toast}</legend>
        <p className="quiet-note">{copy.appearance.toastHelp}</p>
        <div className="theme-picker-grid" role="radiogroup" aria-label={copy.appearance.toast}>
          {presetCatalog(TOAST_STYLE_CATALOG).map((entry) => (
            <label className="theme-option theme-option-plain" key={entry.id}>
              <input
                aria-label={entry.name}
                checked={toastStyle === entry.id}
                name="supastack-toast-style"
                onChange={() => {
                  setToastStyle(applyToastStyle(entry.id));
                  markAppearanceChanged();
                  setStyle(currentStyleId());
                }}
                type="radio"
                value={entry.id}
              />
              <span>
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p>
          <button
            className="button button-secondary"
            onClick={() => {
              toast.success(copy.appearance.saved);
            }}
            type="button"
          >
            {copy.appearance.previewToast}
          </button>
        </p>
      </fieldset>
    </div>
  );
}
