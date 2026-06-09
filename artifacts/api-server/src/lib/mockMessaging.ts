import { db } from "@workspace/db";
import { campaignMetricsTable, walletTransactionsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export async function simulateDeliveryEvents(campaignId: number, totalSent: number): Promise<void> {
  logger.info({ campaignId, totalSent }, "Starting mock delivery simulation");

  const delivered = Math.floor(totalSent * (0.82 + Math.random() * 0.12));
  const opened = Math.floor(delivered * (0.28 + Math.random() * 0.15));
  const clicked = Math.floor(opened * (0.18 + Math.random() * 0.12));
  const converted = Math.floor(clicked * (0.12 + Math.random() * 0.1));
  const spend = 0;
  const revenueAttributed = converted * (800 + Math.floor(Math.random() * 1200));

  // Update sent immediately
  await db.update(campaignMetricsTable).set({
    sent: totalSent,
    updatedAt: new Date(),
  }).where(eq(campaignMetricsTable.campaignId, campaignId));

  // Simulate delivered after 3s
  setTimeout(async () => {
    try {
      await db.update(campaignMetricsTable).set({ delivered, updatedAt: new Date() })
        .where(eq(campaignMetricsTable.campaignId, campaignId));
    } catch (e) { logger.error({ e }, "Error updating delivered"); }
  }, 3000);

  // opened after 8s
  setTimeout(async () => {
    try {
      await db.update(campaignMetricsTable).set({ opened, updatedAt: new Date() })
        .where(eq(campaignMetricsTable.campaignId, campaignId));
    } catch (e) { logger.error({ e }, "Error updating opened"); }
  }, 8000);

  // clicked after 15s
  setTimeout(async () => {
    try {
      await db.update(campaignMetricsTable).set({ clicked, updatedAt: new Date() })
        .where(eq(campaignMetricsTable.campaignId, campaignId));
    } catch (e) { logger.error({ e }, "Error updating clicked"); }
  }, 15000);

  // converted after 25s
  setTimeout(async () => {
    try {
      await db.update(campaignMetricsTable).set({
        converted,
        revenueAttributed: String(revenueAttributed),
        updatedAt: new Date(),
      }).where(eq(campaignMetricsTable.campaignId, campaignId));

      // Fire completion notification
      await db.insert(notificationsTable).values({
        title: "Campaign Completed",
        body: `Campaign #${campaignId} completed. ${converted} conversions, ₹${revenueAttributed.toLocaleString("en-IN")} revenue attributed.`,
        type: "campaign_complete",
        read: "false",
        createdAt: new Date().toISOString(),
      });
    } catch (e) { logger.error({ e }, "Error updating converted"); }
  }, 25000);
}
