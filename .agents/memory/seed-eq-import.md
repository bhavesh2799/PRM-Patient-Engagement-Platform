---
name: Seed file drizzle-orm eq import
description: seed.ts does not import drizzle-orm helpers by default; add eq when using .where(eq(...)) in seed update statements
---

## Rule
`artifacts/api-server/src/lib/seed.ts` imports tables from `@workspace/db` but does NOT import query helpers from `drizzle-orm`. If you add `db.update(...).where(eq(...))` calls to the seed, add `import { eq } from "drizzle-orm"` at the top.

## Why
The seed historically only used `.insert().returning()` and `.delete()` (whole-table), so no `eq` was needed. Adding per-row updates (e.g., assigning tags to named leads) requires the eq comparator.

## How to apply
Add the import alongside the existing db/table imports at the top of seed.ts whenever a `.where(eq(...))` expression is needed.
