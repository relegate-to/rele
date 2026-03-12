import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/", (c) => {
  return c.json({ ok: true });
});

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
