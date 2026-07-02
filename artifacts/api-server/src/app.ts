import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { runSeed } from "./lib/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use("/api", router);

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  // In production the built frontend sits at:
  // artifacts/hospital-crm/dist/public  (relative to repo root)
  // This file is at artifacts/api-server/dist/index.mjs at runtime,
  // so we go up three levels to reach the repo root.
  const frontendDist = path.resolve(
    __dirname,
    "../../../artifacts/hospital-crm/dist/public",
  );

  app.use(express.static(frontendDist));

  // SPA fallback — any non-API route returns index.html
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Run seed on startup (idempotent — skips if data already exists)
runSeed().catch((e) => logger.error({ e }, "Seed failed"));

export default app;
