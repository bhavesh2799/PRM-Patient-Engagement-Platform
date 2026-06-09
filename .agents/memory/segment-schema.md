---
name: Segment schema — no sourceListTag
description: segmentsTable does not have a sourceListTag column; inserting it causes TS2353.
---
`lib/db/src/schema/segments.ts` — columns are: id, name, description, source, conditionTree, memberLeadIds, count, lastRefreshAt, createdAt.

**Rule:** Never insert `sourceListTag` into `segmentsTable`. It doesn't exist.

**Why:** Was accidentally used in seed.ts and leads.ts CSV upload route, causing TS2769 overload errors.

**How to apply:** Any code that inserts into `segmentsTable`.
