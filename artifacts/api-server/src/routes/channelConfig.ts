import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { channelConfigTable } from "@workspace/db";
import { gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/channel-config", async (_req, res): Promise<void> => {
  const [config] = await db.select().from(channelConfigTable);
  res.json({ channels: config?.channels ?? [] });
});

router.patch("/channel-config", async (req, res): Promise<void> => {
  const smsHeaderSchema = z.object({
    value: z.string(),
    ownership: z.enum(["affordplan", "hospital"]),
    isDefault: z.boolean(),
  });
  const wabaNumberSchema = z.object({
    number: z.string(),
    profilePic: z.string().nullable().optional(),
    ownership: z.enum(["affordplan", "hospital"]),
    isDefault: z.boolean(),
  });
  const channelEntrySchema = z.object({
    type: z.enum(["sms", "whatsapp", "push"]),
    status: z.enum(["live", "not_configured", "pending", "error"]),
    smsHeaders: z.array(smsHeaderSchema).optional(),
    wabaNumbers: z.array(wabaNumberSchema).optional(),
    pushWorkspaceId: z.string().nullable().optional(),
  });
  const schema = z.object({
    channels: z.array(channelEntrySchema),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(channelConfigTable);
  if (existing) {
    await db.update(channelConfigTable).set({ channels: parsed.data.channels }).where(gt(channelConfigTable.id, 0));
  } else {
    await db.insert(channelConfigTable).values({ channels: parsed.data.channels });
  }
  const [config] = await db.select().from(channelConfigTable);
  res.json({ channels: config?.channels ?? [] });
});

export default router;
