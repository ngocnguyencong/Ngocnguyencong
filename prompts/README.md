# Prompt library

Ready prompts for driving an agent (Devin, Cursor, Claude Code, etc.) on this
starter kit. The workflow: **pick a design style, pick blocks, paste a prompt.**
The agent builds on the kit's token/theme/layout system instead of inventing
one — that is what keeps products consistent and fast to ship.
`agent-setup.md` is the zero-to-running path: paste it first to stand the kit
up (and deploy it), then reach for the styling prompts below. Once the app is
running, open `/setup` in the browser — the readiness checklist shows what is
configured, what runs in demo mode, and what to do next.

## How to use

1. **Pick a look** — browse `apps/web/src/theme/styles.ts` (`STYLE_CATALOG`) or
   try them live in the app: Settings → Appearance → _Design style_. Each style
   sets color pack + density + radius + font + layout at once.
2. **Pick blocks** — browse `/kit-blocks` during `pnpm dev` (dev-only route) or
   `apps/web/src/kit/blocks.ts` for the copyable section library.
3. **Paste a prompt** from this folder and fill the `<placeholders>`.

## Prompts

| File                  | Use it to                                         |
| --------------------- | ------------------------------------------------- |
| `agent-setup.md`      | Stand up the kit + deploy with an agent           |
| `pick-a-style.md`     | Apply a design style across the whole product     |
| `new-landing-page.md` | Scaffold a marketing/landing page from kit blocks |
| `new-app-screen.md`   | Add a screen inside the workspace app shell       |
| `restyle-product.md`  | Re-theme an existing page onto kit tokens         |
| `ui-audit.md`         | Run the visual/accessibility audit on a route     |

Rules of the game (the agent should hold these; the prompts repeat them):

- Consume tokens (`var(--page|--raised|--text|--muted|--border|--accent|…)`),
  never hardcode colors — blocks must restyle with packs and presets.
- Prefer kit blocks over new section patterns; add new blocks in the same
  token-only style and register them in `apps/web/src/kit/blocks.ts`.
- App chrome changes go through the `data-layout` axis, not new markup.
- Marketing identity is a one-line product choice in
  `apps/web/src/theme/marketing-theme.ts` (`MARKETING_THEME_MODE`).
