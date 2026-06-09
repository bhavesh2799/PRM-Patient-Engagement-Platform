---
name: Query key function cleanup pattern
description: Removing getXxxQueryKey() import requires grep for inline usages in invalidateQueries calls too.
---
When removing `getXxxQueryKey` named imports from `@workspace/api-client-react`, also search the file body for calls like `queryClient.invalidateQueries({ queryKey: getXxxQueryKey() })`. These inline usages cause TS2304 "Cannot find name" after the import is removed.

**Fix:** Replace with plain string arrays: `queryClient.invalidateQueries({ queryKey: ["xxx"] })`.

**Why:** Encountered in marketing/Dashboard.tsx after removing `getListCampaignsQueryKey` and `getGetEngagementDashboardQueryKey` imports — two TS errors remained in the file body.
