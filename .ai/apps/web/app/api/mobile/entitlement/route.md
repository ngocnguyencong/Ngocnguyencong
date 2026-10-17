# Mobile entitlement route

## Purpose
Expose server-owned entitlement for the signed-in user's active workspace.

## Workspace and expiry
The old loader selected the earliest membership, so an organization purchase could display a personal workspace's access. Use the shared active-workspace resolver and filter expired rows before choosing the latest visible grant. Preserve workspace isolation and never infer access from a failed lookup.
