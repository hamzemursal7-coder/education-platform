import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { absoluteStoragePath, assertUploadSize, detectFile, storeDocumentFile } from "../lib/files.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const kindSchema = z.enum([
  "BIRTH_CERTIFICATE",
  "NATIONAL_ID",
  "TRANSFER_CERTIFICATE",
  "PREVIOUS_SCHOOL",
  "EDUCATION_CERTIFICATE",
  "PASSPORT",
  "OTHER",
]);

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

export const documentsRouter = Router();

documentsRouter.use("/students/:studentId/documents", requireAuth, requireRole("SCHOOL_ADMIN"));
documentsRouter.use("/documents", requireAuth, requireRole("SCHOOL_ADMIN"));

documentsRouter.get("/students/:studentId/documents", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const student = await prisma.student.findFirst({
      where: { id: String(req.params.studentId), organizationId: school.organizationId, enrollments: { some: { schoolId: school.id } } },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const rows = await prisma.studentDocument.findMany({
      where: { studentId: student.id, schoolId: school.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      status: row.status,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt,
      verifiedAt: row.verifiedAt,
    })));
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/students/:studentId/documents", upload.single("file"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const kind = kindSchema.safeParse(req.body.kind);
    const title = z.string().trim().min(2).max(120).safeParse(req.body.title ?? req.file?.originalname ?? "Document");
    if (!kind.success || !title.success) throw new HttpError(400, "Document kind, title, and file are required.");
    if (!req.file?.buffer) throw new HttpError(400, "Choose a PDF, JPEG, PNG, or WEBP file.");
    assertUploadSize(req.file.size);
    const detected = detectFile(req.file.buffer);
    if (!detected) throw new HttpError(400, "Only PDF, JPEG, PNG, and WEBP files are allowed.");
    const student = await prisma.student.findFirst({
      where: { id: String(req.params.studentId), organizationId: school.organizationId, enrollments: { some: { schoolId: school.id } } },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const storageKey = await storeDocumentFile(school.id, student.id, req.file.buffer, detected.extension);
    const created = await prisma.studentDocument.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        kind: kind.data,
        title: title.data,
        originalName: req.file.originalname || `document.${detected.extension}`,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: req.file.size,
        uploadedByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "DOCUMENT_UPLOAD",
      entityType: "StudentDocument",
      entityId: created.id,
      summary: `Uploaded ${created.title} for student ${student.permanentId}`,
    });
    res.status(201).json({
      id: created.id,
      kind: created.kind,
      title: created.title,
      status: created.status,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("10 MB")) {
      next(new HttpError(400, error.message));
      return;
    }
    next(error);
  }
});

documentsRouter.get("/documents/:id/download", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const doc = await prisma.studentDocument.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
    });
    if (!doc || doc.archivedAt) throw new HttpError(404, "Document was not found.");
    const absolute = absoluteStoragePath(doc.storageKey);
    await access(absolute);
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.originalName.replaceAll('"', "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    createReadStream(absolute).pipe(res);
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/documents/:id/verify", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const doc = await prisma.studentDocument.findFirst({ where: { id: String(req.params.id), schoolId: school.id, archivedAt: null } });
    if (!doc) throw new HttpError(404, "Document was not found.");
    const updated = await prisma.studentDocument.update({
      where: { id: doc.id },
      data: {
        status: "VERIFIED",
        rejectReason: null,
        verifiedAt: new Date(),
        verifiedByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "DOCUMENT_VERIFY",
      entityType: "StudentDocument",
      entityId: updated.id,
      summary: `Verified document ${updated.title}`,
    });
    res.json({ id: updated.id, status: updated.status });
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/documents/:id/reject", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({ reason: z.string().trim().min(3) }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "A rejection reason is required.");
    const doc = await prisma.studentDocument.findFirst({ where: { id: String(req.params.id), schoolId: school.id, archivedAt: null } });
    if (!doc) throw new HttpError(404, "Document was not found.");
    const updated = await prisma.studentDocument.update({
      where: { id: doc.id },
      data: {
        status: "REJECTED",
        rejectReason: body.data.reason,
        verifiedAt: null,
        verifiedByUserId: null,
      },
    });
    res.json({ id: updated.id, status: updated.status, rejectReason: updated.rejectReason });
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/documents/:id/archive", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({ reason: z.string().trim().min(3) }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "An archive reason is required.");
    const doc = await prisma.studentDocument.findFirst({ where: { id: String(req.params.id), schoolId: school.id, archivedAt: null } });
    if (!doc) throw new HttpError(404, "Document was not found.");
    await prisma.studentDocument.update({
      where: { id: doc.id },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        archiveReason: body.data.reason,
        archivedByUserId: req.authUser!.id,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
