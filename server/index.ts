import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { authRouter } from "./routes/auth";
import { prescriptionRouter } from "./routes/prescriptions";
import { medicationRouter } from "./routes/medications";
import { pharmacyRouter } from "./routes/pharmacies";
import { otpRouter } from "./routes/otp";
import { categoriesAgeRouter } from "./routes/categories";
import { countriesRouter } from "./routes/countries";
import { adminRouter } from "./routes/admin";
import { paymentRouter } from "./routes/payments";
import { ordonnanceRouter } from "./routes/ordonnances";
import { commercialRouter } from "./routes/commercial";
import { pharmaciesGardeRouter } from "./routes/pharmaciesGarde";
import { notificationRouter } from "./routes/notifications";
import { startPharmacyScheduler } from "./services/pharmacyScheduler";
import { startReminderWorker } from "./services/reminderWorker";
import { connectToWhatsApp } from "./services/whatsappProvider";
import { db, initializeDatabase } from "./db";

// Initialize the SQLite database on server startup
initializeDatabase();

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(express.static("public"));

  // Custom CSP Middleware
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data: blob: ws: wss:;"
    );
    next();
  });

  // Example API routes
  app.get("/api", (_req, res) => {
    res.json({
      status: "ok",
      message: "TAKYMED API is running",
      endpoints: {
        ping: "/api/ping",
      },
    });
  });

  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/otp", otpRouter);
  app.use("/api/prescriptions", prescriptionRouter);
  app.use("/api/medications", medicationRouter);
  app.use("/api/pharmacies", pharmacyRouter);
  app.use("/api/categories", categoriesAgeRouter);
  app.use("/api/countries", countriesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/ordonnances", ordonnanceRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/pharmacies-garde", pharmaciesGardeRouter);
  app.use("/api/commercial", commercialRouter);

  // Toujours renvoyer du JSON pour les routes API inconnues
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint API introuvable" });
  });

  // Global Error Handlers
  process.on("uncaughtException", (error) => {
    console.error("❌ UNCAUGHT EXCEPTION:", error);
    // On ne quitte pas le processus pour les erreurs réseau type ETIMEDOUT
    if (!(error instanceof Error && (error as any).code === "ETIMEDOUT")) {
      // Pour les autres erreurs critiques, on pourrait vouloir redémarrer
      // process.exit(1);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ UNHANDLED REJECTION at:", promise, "reason:", reason);
  });

  // Start services
  connectToWhatsApp().catch(err => console.error("WhatsApp Init Error:", err));
  startReminderWorker();
  startPharmacyScheduler();

  console.log("🚀 Server running in HTTP mode");
  return app;
}
