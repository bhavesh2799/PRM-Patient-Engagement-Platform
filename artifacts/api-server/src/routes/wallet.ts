import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { walletTable, walletTransactionsTable, invoicesTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/wallet", async (_req, res): Promise<void> => {
  const [wallet] = await db.select().from(walletTable);
  const transactions = await db.select().from(walletTransactionsTable)
    .orderBy(walletTransactionsTable.createdAt);
  res.json({
    balance: parseFloat(wallet?.balance ?? "0"),
    transactions: transactions.map(t => ({
      ...t,
      amount: parseFloat(t.amount),
      createdAt: t.createdAt.toISOString(),
    })).reverse(),
  });
});

router.post("/wallet/topup", async (req, res): Promise<void> => {
  const schema = z.object({ amount: z.number().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [wallet] = await db.select().from(walletTable);
  const currentBalance = parseFloat(wallet?.balance ?? "0");
  const newBalance = currentBalance + parsed.data.amount;
  await db.update(walletTable).set({ balance: String(newBalance) }).where(eq(walletTable.id, wallet.id));
  await db.insert(walletTransactionsTable).values({
    type: "topup",
    amount: String(parsed.data.amount),
    description: "Wallet top-up via PayU/Easebuzz",
    reference: `TOPUP-${Date.now()}`,
  });
  const transactions = await db.select().from(walletTransactionsTable)
    .orderBy(walletTransactionsTable.createdAt);
  res.json({
    balance: newBalance,
    transactions: transactions.map(t => ({
      ...t,
      amount: parseFloat(t.amount),
      createdAt: t.createdAt.toISOString(),
    })).reverse(),
  });
});

router.get("/invoices", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.createdAt);
  const enriched = await Promise.all(invoices.map(async (inv) => {
    const campaign = inv.campaignId
      ? (await db.select().from(campaignsTable).where(eq(campaignsTable.id, inv.campaignId)))[0]
      : null;
    return {
      ...inv,
      amount: parseFloat(inv.amount),
      gst: parseFloat(inv.gst),
      campaignName: campaign?.name ?? null,
      createdAt: inv.createdAt.toISOString(),
    };
  }));
  res.json(enriched.reverse());
});

export default router;
