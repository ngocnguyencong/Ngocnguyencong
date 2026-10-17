# src/landing-page.test.tsx

## Purpose

Regression tests for the generic boilerplate landing page shared with desktop.

## Test Strategy

Render the real landing blocks with server boundaries mocked. Check every locale
for generic demo copy, useful actions, sample pricing, and absence of customer
quotes, trust links, rating markup, avatars, setup estimates, and video frames.
Check that removed testimonial source/asset paths are absent from the checkout.

## Verification

- The five regressions failed against the original page and pass after cleanup.
  All supported locales render the neutral demo without customer proof, and the
  removed testimonial source/portrait directory is absent.
