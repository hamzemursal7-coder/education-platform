import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { academicRouter } from "./routes/academic.js";
import { attendanceRouter } from "./routes/attendance.js";
import { parentsRouter } from "./routes/parents.js";
import { promotionRouter } from "./routes/promotion.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { studentsRouter } from "./routes/students.js";
import { resultsRouter } from "./routes/results.js";
import { teachersRouter } from "./routes/teachers.js";
import { teacherPortalRouter } from "./routes/teacherPortal.js";
import { announcementsRouter } from "./routes/announcements.js";
import { auditRouter } from "./routes/audit.js";
import { documentsRouter } from "./routes/documents.js";
import { feesRouter } from "./routes/fees.js";
import { reportsRouter } from "./routes/reports.js";
import { searchRouter } from "./routes/search.js";
import { staffRouter } from "./routes/staff.js";
import { schoolSettingsRouter } from "./routes/schoolSettings.js";
import { superadminRouter } from "./routes/superadmin.js";
import { transfersRouter } from "./routes/transfers.js";
import { conductRouter } from "./routes/conduct.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
      allowedHeaders: ["Content-Type", "X-Session-Key"],
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1", attendanceRouter);
  app.use("/api/v1", parentsRouter);
  app.use("/api/v1", promotionRouter);
  app.use("/api/v1", resultsRouter);
  app.use("/api/v1", academicRouter);
  app.use("/api/v1", studentsRouter);
  app.use("/api/v1", teachersRouter);
  app.use("/api/v1", teacherPortalRouter);
  app.use("/api/v1", transfersRouter);
  app.use("/api/v1", feesRouter);
  app.use("/api/v1", staffRouter);
  app.use("/api/v1", announcementsRouter);
  app.use("/api/v1", reportsRouter);
  app.use("/api/v1", documentsRouter);
  app.use("/api/v1", searchRouter);
  app.use("/api/v1", auditRouter);
  app.use("/api/v1", schoolSettingsRouter);
  app.use("/api/v1", superadminRouter);
  app.use("/api/v1", conductRouter);
  app.use(errorHandler);
  return app;
}
