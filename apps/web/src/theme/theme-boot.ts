import "server-only";

import { buildThemeBootScript } from "./catalog";
import { DEFAULT_STYLE_ID, styleById } from "./styles";

const defaultStyle = styleById(DEFAULT_STYLE_ID);

/** Server-rendered defaults also work without JavaScript or browser storage. */
export const DEFAULT_STYLE_ATTRIBUTES = {
  "data-theme": defaultStyle.theme,
  "data-density": defaultStyle.density,
  "data-radius": defaultStyle.radius,
  "data-font": defaultStyle.font,
  "data-layout": defaultStyle.layout,
  "data-toast-style": defaultStyle.toastStyle,
};

/** FOUC-safe boot: only import from the root server layout — never from client components. */
export const THEME_BOOT_SCRIPT = buildThemeBootScript(defaultStyle);
