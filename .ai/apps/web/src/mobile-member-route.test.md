# mobile-member-route.test.ts

## Purpose

Exercise the actual member PATCH route with a dotted user ID, mocked session/BFF dependencies, and real streamed requests.

## Open Threads / Resume Context

- Prove unauthenticated requests do not consume the body, oversized chunked requests cancel before BFF execution, invalid JSON returns 400, and bounded valid JSON forwards the target ID and role.
