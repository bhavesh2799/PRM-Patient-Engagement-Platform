---
name: Express route ordering — bulk vs :id conflict
description: tagsRouter with PATCH /leads/bulk must be mounted before leadsRouter with PATCH /leads/:id or "bulk" is parsed as an ID
---

## Rule
In `artifacts/api-server/src/routes/index.ts`, `tagsRouter` must be registered **before** `leadsRouter`.

## Why
Express matches routes in registration order. `PATCH /leads/:id` in `leadsRouter` matches `/leads/bulk` with `id="bulk"`. `parseId("bulk")` returns NaN and throws. Registering `tagsRouter` first lets its explicit `/leads/bulk` route win before `:id` is tried.

## How to apply
Any time a new router adds routes that share a path prefix with a wildcard param route in another router, ensure the explicit router is mounted first. The current correct order in routes/index.ts is: `tagsRouter` → `leadsRouter`.
