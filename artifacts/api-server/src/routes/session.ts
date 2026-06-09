import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sessionTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
const SESSION_KEY = "active_role";

async function getRole(): Promise<string> {
  const rows = await db.select().from(sessionTable).where(eq(sessionTable.key, SESSION_KEY));
  return rows[0]?.value ?? "exec";
}

router.get("/session/role", async (_req, res): Promise<void> => {
  const role = await getRole();
  const user = (await db.select().from(usersTable).where(eq(usersTable.role, role)))[0] ?? null;
  res.json({ role, userId: user?.id ?? null, userName: user?.name ?? null });
});

router.put("/session/role", async (req, res): Promise<void> => {
  const parsed = z.object({ role: z.enum(["exec", "manager", "ap_admin"]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db
    .insert(sessionTable)
    .values({ key: SESSION_KEY, value: parsed.data.role })
    .onConflictDoUpdate({ target: sessionTable.key, set: { value: parsed.data.role } });
  const user = (await db.select().from(usersTable).where(eq(usersTable.role, parsed.data.role)))[0] ?? null;
  res.json({ role: parsed.data.role, userId: user?.id ?? null, userName: user?.name ?? null });
});

export default router;
