/**
 * "Spread of color" theme switching: picking a color pack or a design style
 * reveals the new theme as a circle growing from the pick point, via the
 * View Transitions API. Every fallback — SSR, a missing origin, no
 * `document.startViewTransition`, or `prefers-reduced-motion` — applies the
 * change synchronously so the switch stays instant and accessible.
 *
 * The matching `::view-transition-old/new(root)` rules live in
 * `app/globals.css`: they disable the default crossfade and stack the new
 * snapshot on top so this clip-path reveal is the only motion.
 */

export type ThemeTransitionOrigin = {
  x: number;
  y: number;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REVEAL_DURATION_MS = 550;
/* Same curve as --ease in app/app-theme.css + app/theme.css. */
const REVEAL_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const REVEAL_PSEUDO = "::view-transition-new(root)";

/**
 * Runs `apply` inside a same-document view transition, then animates a
 * clip-path circle on the new-state snapshot from `origin` out to the
 * farthest viewport corner. `apply` must mutate the DOM synchronously — the
 * browser captures the new-state snapshot right after the update callback
 * runs (applyTheme/applyStyle already are synchronous).
 */
export function runThemeTransition(apply: () => void, origin?: ThemeTransitionOrigin): void {
  if (typeof document === "undefined") {
    apply();
    return;
  }
  if (!origin || typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    apply();
    return;
  }

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(apply);
  } catch {
    /* The update callback is always invoked asynchronously, so `apply` has
       not run yet — fall back to an instant switch. */
    apply();
    return;
  }

  /* `ready` resolves once the ::view-transition-new(root) snapshot exists. */
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${farthestCornerRadius(origin)}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          pseudoElement: REVEAL_PSEUDO,
        },
      );
    })
    .catch(() => {
      /* `ready` rejects when the transition is skipped — theme already applied. */
    });
  /* Skipped or superseded transitions reject `finished`/`updateCallbackDone`;
     swallow both — the DOM change itself already happened. */
  void transition.finished.catch(() => {});
  void transition.updateCallbackDone.catch(() => {});
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Radius of the circle at `origin` that covers the farthest viewport corner. */
function farthestCornerRadius(origin: ThemeTransitionOrigin): number {
  return Math.hypot(
    Math.max(origin.x, globalThis.innerWidth - origin.x),
    Math.max(origin.y, globalThis.innerHeight - origin.y),
  );
}
