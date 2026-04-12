import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { DockerProvider } from "./providers/machines/docker";
import { FlyProvider } from "./providers/machines/fly";
import { createMachineRoutes } from "./routes/machines";
import meRoutes from "./routes/me";
import apiKeyRoutes from "./routes/api-keys";

const provider = process.env.USE_DOCKER === "true"
  ? new DockerProvider(process.env.DOCKER_IMAGE ?? "rele-openclaw:latest")
  : new FlyProvider();

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

app.use("/me", authMiddleware);
app.use("/api-keys", authMiddleware);
app.use("/machines", authMiddleware);
app.use("/machines/*", authMiddleware);

app.route("/me", meRoutes);
app.route("/api-keys", apiKeyRoutes);
app.route("/machines", createMachineRoutes(provider));

export default {
  port: process.env.PORT ?? 3001,
  fetch: app.fetch,
};
