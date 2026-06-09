---
name: Notification read field type mismatch
description: DB stores notifications.read as text "true"/"false" but generated API client types it as boolean — causes TS2367.
---
The `notificationsTable` in `lib/db/src/schema/notifications.ts` stores `read` as `text("read").default("false")`. But the generated OpenAPI client may type the field as `boolean`.

**Rule:** Always compare with `String(n.read) !== "true"` (or `&& n.read !== true`) rather than `n.read === "false"`.

**Why:** TypeScript TS2367 "no overlap" error fires when comparing `boolean` and `string` literals. The `String()` cast satisfies the compiler and handles both DB text and generated-type boolean.

**How to apply:** Any component rendering notification unread state.
