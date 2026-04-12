import { Hono } from "hono";
import type { AppVariables } from "../middleware/auth";

const router = new Hono<{ Variables: AppVariables }>();

router.get("/", (c) => c.json({ userId: c.get("userId") }));

export default router;
