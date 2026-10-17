# UI foundation browser regressions

Verify real native-dialog focus containment, themed select keyboard/form behavior, root overlay radius inheritance, new style bundles, responsive navigation, reduced motion, and essential no-JavaScript navigation. Fake/local providers only. No live provider or native-device claims.

Also exercise normal/reduced hover feedback and capture representative dark/light previews at 1440/390/320px. A 200% CSS zoom check verifies reflow and keyboard access; it does not claim native browser toolbar zoom or screen-reader verification.

Whole-style picks use click plus awaited checked state: the preserved theme reveal applies the change asynchronously through the View Transitions API.

Both Appearance and `/kit-blocks` exercise rendered loading/empty/error/disabled states and narrow master/detail Back focus restoration.

Measure selected-navigation text against its actual computed background in every pack. Normalize CSS color-mix values through the browser canvas and require 4.5:1.

Final validation: 11 foundation cases plus six existing application-theme cases pass (17 total), with fake/local providers and representative 1440/390/320px, reduced-motion, zoom, and no-JavaScript checks.
