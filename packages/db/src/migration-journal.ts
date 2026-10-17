/**
 * Embedded copy of drizzle/meta/_journal.json entries. The package tsconfig
 * roots at src/, so the JSON cannot be imported directly — this module ships
 * the migration tags + timestamps instead, and migration-journal.test.ts
 * asserts it stays in sync with the real journal.
 */
export const MIGRATION_JOURNAL_ENTRIES = [
  { tag: "0000_init", when: 1789866159256 },
  { tag: "0001_far_luke_cage", when: 1790077157329 },
  { tag: "0002_steady_wolverine", when: 1790080847242 },
  { tag: "0003_petite_wallow", when: 1790104019379 },
  { tag: "0004_luxuriant_switch", when: 1790104524155 },
  { tag: "0005_ambitious_gladiator", when: 1790138025696 },
  { tag: "0006_mushy_franklin_storm", when: 1790188587298 },
  { tag: "0007_eager_franklin_richards", when: 1790189665552 },
  { tag: "0008_wonderful_lyja", when: 1790228140033 },
  { tag: "0009_cheerful_hellfire_club", when: 1790250571733 },
  { tag: "0010_numerous_power_man", when: 1790252450369 },
  { tag: "0011_right_marrow", when: 1790273449210 },
  { tag: "0012_outgoing_marauders", when: 1790528880516 },
  { tag: "0013_gray_pixie", when: 1791000914935 },
  { tag: "0014_waitlist_created_at", when: 1791001000000 },
  { tag: "0015_sharp_white_tiger", when: 1791691232237 },
  { tag: "0016_credits-reference-idempotency", when: 1791695885876 },
  { tag: "0017_plain_ultron", when: 1791700268580 },
  { tag: "0018_brainy_captain_america", when: 1792119231949 },
  { tag: "0019_famous_magus", when: 1792122228237 },
  { tag: "0020_flat_nehzno", when: 1792177883665 },
] as const;
