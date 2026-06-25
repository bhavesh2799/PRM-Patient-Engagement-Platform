---
name: API server stale routes
description: api-server dev server can serve stale route handlers after editing route files
---
After editing files under `artifacts/api-server/src/routes/`, the running dev server may keep serving the OLD handler — a curl can show new fields present but other new fields from the same `res.json` missing/undefined, which is the tell-tale sign of a partially-stale bundle.

**Why:** the api-server dev bundle does not always pick up route-file changes via watch.

**How to apply:** after changing a route handler, `restart_workflow "artifacts/api-server: API Server"` before curl-verifying the response shape. Don't trust curl output until after the restart.
