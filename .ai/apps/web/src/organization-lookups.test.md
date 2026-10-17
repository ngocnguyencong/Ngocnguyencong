# organization-lookups.test.ts

## Purpose

Exercise exported organization lookup actions directly with controlled sessions
and database queries. Anonymous/cross-user preference requests must not read
preferences; seat lookups must require current user membership before billing
reads. Authorized cookie/preference and plan-derived results remain unchanged.
No live database or provider calls.
