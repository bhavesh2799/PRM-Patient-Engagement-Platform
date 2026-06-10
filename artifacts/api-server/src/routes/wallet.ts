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
  const schema = z.object({
    amount: z.number().positive().min(500).max(500000),
    paymentMethod: z.enum(["PayU", "Easebuzz"]).optional().default("PayU"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { amount, paymentMethod } = parsed.data;
  const [wallet] = await db.select().from(walletTable);
  const currentBalance = parseFloat(wallet?.balance ?? "0");
  const newBalance = currentBalance + amount;
  await db.update(walletTable).set({ balance: String(newBalance) }).where(eq(walletTable.id, wallet.id));
  const pgRef = `${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-10)}`;
  await db.insert(walletTransactionsTable).values({
    type: "topup",
    amount: String(amount),
    description: `Wallet top-up via ${paymentMethod}`,
    reference: pgRef,
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
