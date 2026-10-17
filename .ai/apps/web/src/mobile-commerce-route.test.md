# apps/web/src/mobile-commerce-route.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Route plumbing tests for the four `app/api/mobile/commerce/**` routes —
`./commerce-actions` and `./workspace-access` are mocked so only HTTP
delegation/JSON mapping is exercised (mirrors
`mobile-push-tokens-route.test.ts`).

## What It Does

- products GET: `createdAt` → ISO + `manageable`; errors → 401/403.
- products POST: manager check before body consumption; fields →
  `createCommerceProductAction`; 201 `{id}` / 422.
- products PATCH: fields → `updateCommerceProductAction`; `{status}` →
  `setCommerceProductStatusAction` FormData bridge; unknown status /
  empty body → 400.
- orders GET: ISO dates + line items; orders PATCH: `{status}` →
  `setCommerceOrderStatusAction` FormData bridge; invalid/missing
  status → 400; manager role required before body read.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
