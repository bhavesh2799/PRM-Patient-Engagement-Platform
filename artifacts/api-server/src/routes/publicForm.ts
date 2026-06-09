import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { leadsTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.post("/public/form/submit", async (req, res): Promise<void> => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    mobile: z.string().min(10),
    specialization: z.string().optional(),
    message: z.string().optional(),
    preferredDate: z.string().optional(),
    optedIn: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(leadsTable).where(eq(leadsTable.mobile, parsed.data.mobile));
  if (existing.length > 0) {
    res.json({
      success: true,
      message: "We already have your details on file. Our team will reach out shortly.",
      leadId: existing[0].id,
      duplicate: true,
    });
    return;
  }
  const [lead] = await db.insert(leadsTable).values({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    mobile: parsed.data.mobile,
    specialization: parsed.data.specialization ?? null,
    sourceChannel: "form",
    status: "new",
    optedIn: parsed.data.optedIn,
  }).returning();
  await db.insert(activityLogTable).values({
    leadId: lead.id,
    type: "created",
    description: `Lead submitted via public enquiry form${parsed.data.specialization ? ` for ${parsed.data.specialization}` : ""}${parsed.data.message ? `: "${parsed.data.message.substring(0, 80)}"` : ""}`,
    userId: null,
  });
  res.status(201).json({
    success: true,
    message: "Thank you! Our team will contact you within 24 hours.",
    leadId: lead.id,
    duplicate: false,
  });
});

export default router;
