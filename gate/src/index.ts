import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());
app.use("*", clerkMiddleware());

app.get("/", (c) => {
  return c.json({ ok: true });
});

app.get("/me", (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ userId: auth.userId });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
