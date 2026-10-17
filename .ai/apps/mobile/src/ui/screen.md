# src/ui/screen.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Themed building blocks every app screen composes from — `Screen`
(SafeArea + ScrollView), `Card`, `H1`/`H2`/`Title`/`Detail`/`SectionLabel`,
`AppButton`/`DestructiveButton`, `AppInput`/`FieldLabel`, `ListRow`,
`Badge`, `Loading`, `EmptyState`, `ErrorText`.

## Important Notes

- All blocks pull `styles`/`palette` from `useRequiredMobileApp`, so they
  only render inside `MobileAppProvider` — never in bare test harnesses.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |

## 2026-10-06 foundation integration
Native buttons expose a static pressed-fill and foreground state with measured label contrast without introducing an animation dependency. The native adapter shares semantic roles and durations; device rendering/performance remains unverified.
