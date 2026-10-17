# src/marketing/site-config.test.ts

## Purpose

Guards demo branding, navigation, optional destinations, legal links, and FAQ.

## Coverage

- A regression requires the generic demo tagline and sample-pricing FAQ, in
  addition to existing link, optional-destination, and active-section tests.
- Also pins `resourceLinks` (`/changelog`, `/roadmap`, `/api-reference`) as a
  footer-only group that must stay out of header `navigation`.
