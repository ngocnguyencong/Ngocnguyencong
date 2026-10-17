# Mobile theme adapter

ThemeMode dark/light/system/synced resolves through paletteForMode. `synced` paints the web color pack cached from the account's synced appearance (`src/theme/synced.ts`, SecureStore `supastack.theme.synced`) and falls back to the system palette when no pack is cached. lightPalette/darkPalette adapt shared mobilePalettes from @supastack/design-tokens; createAppStyles preserves native StyleSheet controls and typography.

Primary labels use a dark onSignal color at 4.5:1 or better. Inputs and outline buttons use the distinct controlBorder role at3:1 on their adjacent canvases; outline remains decorative for cards and dividers. Status roles are shared with the web semantic grammar without forcing web chrome onto native navigation. Tests compute exact palette contrasts with StyleSheet mocked; native rendering/device performance is not verified.

2026-10-06: Pressed-control fills and labels keep 4.5:1 contrast; provide named pressed styles rather than reducing whole-control opacity.

2026-10-15: `ThemeMode` += `"synced"`; `paletteForMode` takes an optional cached synced palette (synced + no cache → system fallback).
