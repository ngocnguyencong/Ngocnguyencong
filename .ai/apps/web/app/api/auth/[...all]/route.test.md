# apps/web/app/api/auth/[...all]/route.test.ts

## Purpose

Verify POST admission, internal client-IP header sanitization, and bounded auth-body forwarding at the route boundary.

## Coverage

- Unknown requests bypass the trusted-client window while stripping a caller-supplied canonical IP header.
- Bounded JSON body, content type, URL, and parser input survive delegation, including dotted callback identifiers.
- Declared oversized bodies return 413 without invoking the auth handler.
