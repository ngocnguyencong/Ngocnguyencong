# scripts/check-dependency-licenses.mjs

Consumes the JSON report from `pnpm licenses list --json --recursive` asynchronously on standard input, avoiding a nonblocking pipe `EAGAIN` on CI. It fails when an installed package has one of the explicitly denied SPDX licenses. A package with an allowed alternative in its license expression remains permitted. The checker lists package versions when it fails and prints no full dependency report on success.
