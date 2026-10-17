# apps/web/src/reference-app.tsx

## Purpose

Local reference dashboard showing a deterministic task flow. ShellNavigation
owns desktop and mobile framing; the screen state, local API actions, and
dashboard content remain in this component.

## Important Notes

- Preserve the existing local flow and its controls when moving the sidebar
  content into ShellNavigation.
- Keep reference screen navigation available in the modal drawer on narrow
  screens and focused layout; use Lucide icons when the rail is collapsed.
- Initial server markup retains the navigation controls before enhancement.
