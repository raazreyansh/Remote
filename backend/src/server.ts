import http from "node:http";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import integrationsRoutes from "./routes/integrations";
import kitchenRoutes from "./routes/kitchen";
import publicRoutes from "./routes/public";
import { errorHandler } from "./middleware/error-handler";
import { initSocket } from "./lib/socket";
import { startJobWorker } from "./services/jobs";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: false,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use("/api/integrations/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: config.appName,
    now: new Date().toISOString(),
  });
});

app.get("/api/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ready",
      service: config.appName,
      now: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "not_ready",
      service: config.appName,
      now: new Date().toISOString(),
    });
  }
});

app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/integrations", integrationsRoutes);

app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);
startJobWorker();

server.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
