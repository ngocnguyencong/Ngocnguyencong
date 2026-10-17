# Shared structural CSS

Root structural defaults supply body-mounted overlays as well as app/marketing surfaces. Density/radius/font axes apply before paint. Loaded font variables are resolved at body level; derived hover/press/hairline/elevation values are recomputed at app, marketing, and pinned palette boundaries so nested themes never borrow the global text color.

Use the same complete font fallback lists as marketing so default app/homepage typography remains identical. A browser regression caught a missing explicit Inter fallback in the shared foundation.

Motion: feedback120ms, entrance180ms, exit120ms, disclosure-open220ms, disclosure-close160ms. Semantic text/control/status colors live in the theme catalog, with compatible mobile roles exported by design-tokens. Surface-specific marketing geometry remains intentionally separate. No open implementation work.
