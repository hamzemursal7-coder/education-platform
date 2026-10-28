import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Prisma, ConductCategory, ConductSeverity, ConductStatus, ConductVisibilityLevel } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { absoluteStoragePath, detectFile, storeConductAttachmentFile } from "../lib/files.js";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const conductRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

async function nextConductReportNumber(tx: Prisma.TransactionClient, schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const sequenceId = `conduct:${schoolId}:${year}`;
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${sequenceId}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  const seq = rows[0]?.value ?? 1;
  return `CR-${year}-${String(seq).padStart(4, "0")}`;
}

const createReportSchema = z.object({
  studentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  category: z.nativeEnum(ConductCategory),
  severity: z.nativeEnum(ConductSeverity).default(ConductSeverity.LOW),
  isPositive: z.boolean().default(false),
  incidentDate: z.string().min(1),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(4000),
  actionsTakenByTeacher: z.string().trim().max(2000).optional().or(z.literal("")),
  requestedVisibility: z.nativeEnum(ConductVisibilityLevel).default(ConductVisibilityLevel.STAFF_INTERNAL),
  status: z.enum(["DRAFT", "SUBMITTED"]).default("SUBMITTED"),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(ConductStatus),
  comment: z.string().trim().max(2000).optional(),
});

const updateVisibilitySchema = z.object({
  isParentVisible: z.boolean(),
  isStudentVisible: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

const addActionSchema = z.object({
  actionType: z.string().trim().min(2).max(50),
  comment: z.string().trim().min(3).max(2000),
  isInternalOnly: z.boolean().default(true),
});

const createAdminReportSchema = z.object({
  studentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  category: z.nativeEnum(ConductCategory),
  severity: z.nativeEnum(ConductSeverity).default(ConductSeverity.LOW),
  isPositive: z.boolean().default(false),
  incidentDate: z.string().min(1),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(5).max(4000),
  actionsTakenByTeacher: z.string().trim().max(2000).optional().or(z.literal("")),
  sharingAudience: z.enum(["INTERNAL_ONLY", "PARENT_ONLY", "STUDENT_ONLY", "PARENT_AND_STUDENT"]).default("INTERNAL_ONLY"),
  status: z.nativeEnum(ConductStatus).default(ConductStatus.RESOLVED),
});

// ---------------------------------------------------------------------------
// 1. TEACHER PORTAL ENDPOINTS
// ---------------------------------------------------------------------------

// Get eligible students that this teacher is authorized to report on
conductRouter.get("/teacher/conduct/eligible-students", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.authUser!.id, isActive: true },
      include: { assignments: true, schools: true },
    });
    if (!teacher) throw new HttpError(403, "Teacher account was not found or is inactive.");

    const sectionIds = [...new Set(teacher.assignments.map((item) => item.sectionId))];
    if (sectionIds.length === 0) {
      res.json({ students: [], sections: [] });
      return;
    }

    const [enrollments, sections] = await Promise.all([
      prisma.enrollment.findMany({
        where: {
          sectionId: { in: sectionIds },
          status: "ACTIVE",
        },
        include: {
          student: true,
          section: true,
          classGroup: true,
          academicYear: true,
        },
        orderBy: [{ classGroup: { level: "asc" } }, { section: { name: "asc" } }, { rollNumber: "asc" }],
      }),
      prisma.section.findMany({
        where: { id: { in: sectionIds } },
        include: { classGroup: { include: { academicYear: true } } },
      }),
    ]);

    const formattedStudents = enrollments.map((enr) => ({
      studentId: enr.student.id,
      enrollmentId: enr.id,
      permanentId: enr.student.permanentId,
      name: `${enr.student.firstName} ${enr.student.fatherName} ${enr.student.grandfatherName}`,
      studentNumber: enr.studentNumber,
      rollNumber: enr.rollNumber,
      sectionId: enr.sectionId,
      sectionName: enr.section.name,
      classLabel: levelLabel(enr.classGroup.level),
      classGroupId: enr.classGroupId,
      academicYearId: enr.academicYearId,
      academicYearName: enr.academicYear.name,
      schoolId: enr.schoolId,
    }));

    const formattedSections = sections.map((sec) => ({
      sectionId: sec.id,
      sectionName: sec.name,
      classLabel: levelLabel(sec.classGroup.level),
      academicYearName: sec.classGroup.academicYear.name,
      schoolId: sec.classGroup.schoolId,
    }));

    res.json({
      students: formattedStudents,
      sections: formattedSections,
    });
  } catch (error) {
    next(error);
  }
});

// List conduct reports authored by requesting teacher
conductRouter.get("/teacher/conduct/reports", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const reports = await prisma.conductReport.findMany({
      where: { reporterUserId: req.authUser!.id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            fatherName: true,
            grandfatherName: true,
            permanentId: true,
            photoUrl: true,
          },
        },
        enrollment: {
          select: {
            section: { select: { name: true } },
            classGroup: { select: { level: true } },
            academicYear: { select: { name: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { attachments: true, actions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = reports.map((rep) => ({
      id: rep.id,
      reportNumber: rep.reportNumber,
      studentName: `${rep.student.firstName} ${rep.student.fatherName} ${rep.student.grandfatherName}`,
      studentPermanentId: rep.student.permanentId,
      classLabel: levelLabel(rep.enrollment.classGroup.level),
      sectionName: rep.enrollment.section.name,
      academicYear: rep.enrollment.academicYear.name,
      category: rep.category,
      severity: rep.severity,
      isPositive: rep.isPositive,
      title: rep.title,
      incidentDate: rep.incidentDate.toISOString(),
      location: rep.location,
      status: rep.status,
      isSensitive: rep.isSensitive,
      isParentVisible: rep.isParentVisible,
      isStudentVisible: rep.isStudentVisible,
      attachmentCount: rep._count.attachments,
      actionCount: rep._count.actions,
      createdAt: rep.createdAt.toISOString(),
      updatedAt: rep.updatedAt.toISOString(),
    }));

    res.json({ reports: items });
  } catch (error) {
    next(error);
  }
});

// Submit or save draft report by teacher
conductRouter.post("/teacher/conduct/reports", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const {
      studentId,
      enrollmentId,
      category,
      severity,
      isPositive,
      incidentDate,
      location,
      title,
      description,
      actionsTakenByTeacher,
      requestedVisibility,
      status,
    } = parsed.data;

    // Verify teacher and authorized assignments
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.authUser!.id, isActive: true },
      include: { assignments: true },
    });
    if (!teacher) throw new HttpError(403, "Teacher profile not found.");

    const teacherSectionIds = new Set(teacher.assignments.map((a) => a.sectionId));

    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true, school: true },
    });
    if (!enrollment || enrollment.studentId !== studentId) {
      throw new HttpError(404, "Student enrollment not found.");
    }

    if (!teacherSectionIds.has(enrollment.sectionId)) {
      throw new HttpError(403, "You can only report conduct for students currently in your assigned sections.");
    }

    // Teacher reports are strictly confidential to School Administration upon submission
    const isSensitive = category === ConductCategory.SAFEGUARDING || severity === ConductSeverity.URGENT;
    const visibilityLevel = ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY;

    const report = await prisma.$transaction(async (tx) => {
      const reportNumber = await nextConductReportNumber(tx, enrollment.schoolId);

      const created = await tx.conductReport.create({
        data: {
          reportNumber,
          schoolId: enrollment.schoolId,
          studentId,
          enrollmentId,
          reporterTeacherId: teacher.id,
          reporterUserId: req.authUser!.id,
          category,
          severity,
          isPositive,
          incidentDate: new Date(incidentDate),
          location: location || null,
          title,
          description,
          actionsTakenByTeacher: actionsTakenByTeacher || null,
          status: status as ConductStatus,
          requestedVisibility,
          visibilityLevel,
          isSensitive,
          isParentVisible: false,
          isStudentVisible: false,
        },
      });

      await tx.conductAction.create({
        data: {
          reportId: created.id,
          actorUserId: req.authUser!.id,
          actionType: status === "DRAFT" ? "DRAFT_SAVED" : "REPORT_SUBMITTED",
          newStatus: status as ConductStatus,
          comment: status === "DRAFT" ? "Draft saved by teacher." : "Report submitted for administration review.",
          isInternalOnly: false,
        },
      });

      return created;
    });

    await writeAudit({
      schoolId: enrollment.schoolId,
      actorUserId: req.authUser!.id,
      action: status === "DRAFT" ? "CONDUCT_REPORT_DRAFT" : "CONDUCT_REPORT_SUBMITTED",
      entityType: "ConductReport",
      entityId: report.id,
      summary: `Teacher submitted conduct report ${report.reportNumber} for ${enrollment.student.firstName} ${enrollment.student.fatherName} (${category}).`,
    });

    res.status(201).json({
      message: status === "DRAFT" ? "Draft report saved successfully." : "Report submitted successfully for school review.",
      reportId: report.id,
      reportNumber: report.reportNumber,
    });
  } catch (error) {
    next(error);
  }
});

// Get single report detail for teacher
conductRouter.get("/teacher/conduct/reports/:id", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const report = await prisma.conductReport.findFirst({
      where: {
        id: String(req.params.id),
        reporterUserId: req.authUser!.id,
      },
      include: {
        student: true,
        enrollment: {
          include: {
            section: true,
            classGroup: true,
            academicYear: true,
          },
        },
        actions: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: {
              select: { firstName: true, lastName: true, role: true },
            },
          },
        },
        attachments: true,
      },
    });

    if (!report) throw new HttpError(404, "Report not found.");

    res.json({
      id: report.id,
      reportNumber: report.reportNumber,
      student: {
        id: report.student.id,
        name: `${report.student.firstName} ${report.student.fatherName} ${report.student.grandfatherName}`,
        permanentId: report.student.permanentId,
        photoUrl: report.student.photoUrl,
      },
      enrollment: {
        sectionName: report.enrollment.section.name,
        classLabel: levelLabel(report.enrollment.classGroup.level),
        academicYear: report.enrollment.academicYear.name,
      },
      category: report.category,
      severity: report.severity,
      isPositive: report.isPositive,
      incidentDate: report.incidentDate.toISOString(),
      location: report.location,
      title: report.title,
      description: report.description,
      actionsTakenByTeacher: report.actionsTakenByTeacher,
      status: report.status,
      requestedVisibility: report.requestedVisibility,
      isSensitive: report.isSensitive,
      resolutionNotes: report.resolutionNotes,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      actions: report.actions.map((act) => ({
        id: act.id,
        actionType: act.actionType,
        previousStatus: act.previousStatus,
        newStatus: act.newStatus,
        comment: act.comment,
        actorName: `${act.actorUser.firstName} ${act.actorUser.lastName} (${act.actorUser.role})`,
        createdAt: act.createdAt.toISOString(),
      })),
      attachments: report.attachments.map((att) => ({
        id: att.id,
        title: att.title,
        originalName: att.originalName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        createdAt: att.createdAt.toISOString(),
      })),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Update draft report by teacher
conductRouter.put("/teacher/conduct/reports/:id", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const report = await prisma.conductReport.findFirst({
      where: {
        id: String(req.params.id),
        reporterUserId: req.authUser!.id,
      },
    });

    if (!report) throw new HttpError(404, "Report not found.");
    if (report.status !== ConductStatus.DRAFT) {
      throw new HttpError(400, "Submitted reports cannot be edited directly. Contact your School Administrator for corrections.");
    }

    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const { category, severity, isPositive, incidentDate, location, title, description, actionsTakenByTeacher, requestedVisibility, status } = parsed.data;
    const isSensitive = category === ConductCategory.SAFEGUARDING || severity === ConductSeverity.URGENT;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.conductReport.update({
        where: { id: report.id },
        data: {
          category,
          severity,
          isPositive,
          incidentDate: new Date(incidentDate),
          location: location || null,
          title,
          description,
          actionsTakenByTeacher: actionsTakenByTeacher || null,
          status: status as ConductStatus,
          requestedVisibility,
          isSensitive,
          visibilityLevel: isSensitive ? ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY : report.visibilityLevel,
        },
      });

      if (status === "SUBMITTED") {
        await tx.conductAction.create({
          data: {
            reportId: report.id,
            actorUserId: req.authUser!.id,
            actionType: "REPORT_SUBMITTED",
            previousStatus: ConductStatus.DRAFT,
            newStatus: ConductStatus.SUBMITTED,
            comment: "Draft finalized and submitted for review.",
            isInternalOnly: false,
          },
        });
      }

      return up;
    });

    res.json({
      message: status === "SUBMITTED" ? "Report submitted successfully." : "Draft updated.",
      reportId: updated.id,
    });
  } catch (error) {
    next(error);
  }
});

// Upload attachment to conduct report
conductRouter.post("/teacher/conduct/reports/:id/attachments", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, "Please provide a file to attach.");

    const detected = detectFile(file.buffer);
    if (!detected) {
      throw new HttpError(400, "Invalid file format. Only PDF, PNG, JPG, and WEBP attachments are supported.");
    }

    const report = await prisma.conductReport.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!report) throw new HttpError(404, "Report not found.");

    // Check authorization: author or school admin
    if (req.authUser!.role === "TEACHER" && report.reporterUserId !== req.authUser!.id) {
      throw new HttpError(403, "You are not authorized to upload attachments to this report.");
    }
    if (req.authUser!.role === "SCHOOL_ADMIN" && req.authUser!.schoolId !== report.schoolId) {
      throw new HttpError(403, "You are not authorized to upload attachments to another school's report.");
    }

    const title = String(req.body.title || file.originalname || "Supporting Document").trim().slice(0, 100);
    const storageKey = await storeConductAttachmentFile(report.schoolId, report.id, file.buffer, detected.extension);

    const attachment = await prisma.conductAttachment.create({
      data: {
        reportId: report.id,
        title,
        originalName: file.originalname,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
        uploadedByUserId: req.authUser!.id,
        isParentVisible: false,
        isStudentVisible: false,
      },
    });

    await prisma.conductAction.create({
      data: {
        reportId: report.id,
        actorUserId: req.authUser!.id,
        actionType: "ATTACHMENT_ADDED",
        comment: `Attached ${file.originalname} (${(file.size / 1024).toFixed(1)} KB).`,
        isInternalOnly: true,
      },
    });

    res.status(201).json({
      message: "Attachment uploaded successfully.",
      attachment: {
        id: attachment.id,
        title: attachment.title,
        originalName: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 2. SCHOOL ADMIN WORKBENCH ENDPOINTS
// ---------------------------------------------------------------------------

// Get all eligible students in the school for admin report creation
conductRouter.get("/school/conduct/eligible-students", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");
    const schoolId = admin.school.id;

    const [enrollments, sections, academicYears] = await Promise.all([
      prisma.enrollment.findMany({
        where: { schoolId, status: "ACTIVE" },
        include: {
          student: true,
          section: true,
          classGroup: true,
          academicYear: true,
        },
        orderBy: [{ classGroup: { level: "asc" } }, { section: { name: "asc" } }, { rollNumber: "asc" }],
      }),
      prisma.section.findMany({
        where: { classGroup: { schoolId } },
        include: { classGroup: { include: { academicYear: true } } },
      }),
      prisma.academicYear.findMany({
        where: { schoolId },
        orderBy: { startDate: "desc" },
      }),
    ]);

    const formattedStudents = enrollments.map((enr) => ({
      studentId: enr.student.id,
      enrollmentId: enr.id,
      permanentId: enr.student.permanentId,
      name: `${enr.student.firstName} ${enr.student.fatherName} ${enr.student.grandfatherName}`,
      studentNumber: enr.studentNumber,
      rollNumber: enr.rollNumber,
      sectionId: enr.sectionId,
      sectionName: enr.section.name,
      classLabel: levelLabel(enr.classGroup.level),
      classGroupId: enr.classGroupId,
      academicYearId: enr.academicYearId,
      academicYearName: enr.academicYear.name,
      schoolId: enr.schoolId,
    }));

    const formattedSections = sections.map((sec) => ({
      sectionId: sec.id,
      sectionName: sec.name,
      classLabel: levelLabel(sec.classGroup.level),
      classGroupId: sec.classGroupId,
      academicYearId: sec.classGroup.academicYearId,
      academicYearName: sec.classGroup.academicYear.name,
      schoolId: sec.classGroup.schoolId,
    }));

    res.json({
      students: formattedStudents,
      sections: formattedSections,
      academicYears: academicYears.map((y) => ({ id: y.id, name: y.name, isCurrent: y.isCurrent })),
    });
  } catch (error) {
    next(error);
  }
});

// Admin creates a conduct report directly
conductRouter.post("/school/conduct/reports", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");
    const schoolId = admin.school.id;

    const parsed = createAdminReportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const {
      studentId,
      enrollmentId,
      category,
      severity,
      isPositive,
      incidentDate,
      location,
      title,
      description,
      actionsTakenByTeacher,
      sharingAudience,
      status,
    } = parsed.data;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true },
    });
    if (!enrollment || enrollment.schoolId !== schoolId || enrollment.studentId !== studentId) {
      throw new HttpError(404, "Student enrollment not found in this school.");
    }

    const isParentVisible = sharingAudience === "PARENT_ONLY" || sharingAudience === "PARENT_AND_STUDENT";
    const isStudentVisible = sharingAudience === "STUDENT_ONLY" || sharingAudience === "PARENT_AND_STUDENT";
    const isSensitive = category === ConductCategory.SAFEGUARDING || severity === ConductSeverity.URGENT;

    // Safeguard check
    if (isSensitive && (isParentVisible || isStudentVisible)) {
      throw new HttpError(400, "Safeguarding reports cannot be published directly to parents or students.");
    }

    const visibilityLevel = isParentVisible && isStudentVisible
      ? ConductVisibilityLevel.COMMUNITY_PUBLISHED
      : isParentVisible
      ? ConductVisibilityLevel.PARENT_APPROVED
      : isStudentVisible
      ? ConductVisibilityLevel.STUDENT_APPROVED
      : ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY;

    const report = await prisma.$transaction(async (tx) => {
      const reportNumber = await nextConductReportNumber(tx, schoolId);

      const created = await tx.conductReport.create({
        data: {
          reportNumber,
          schoolId,
          studentId,
          enrollmentId,
          reporterUserId: req.authUser!.id,
          category,
          severity,
          isPositive,
          incidentDate: new Date(incidentDate),
          location: location || null,
          title,
          description,
          actionsTakenByTeacher: actionsTakenByTeacher || null,
          status,
          requestedVisibility: visibilityLevel,
          visibilityLevel,
          isSensitive,
          isParentVisible,
          isStudentVisible,
          assignedToUserId: req.authUser!.id,
        },
      });

      await tx.conductAction.create({
        data: {
          reportId: created.id,
          actorUserId: req.authUser!.id,
          actionType: "ADMIN_REPORT_CREATED",
          newStatus: status,
          comment: `Report created by School Administration. Sharing audience: ${sharingAudience}.`,
          isInternalOnly: false,
        },
      });

      return created;
    });

    await writeAudit({
      schoolId,
      actorUserId: req.authUser!.id,
      action: "CONDUCT_ADMIN_REPORT_CREATE",
      entityType: "ConductReport",
      entityId: report.id,
      summary: `Admin created conduct record ${report.reportNumber} for ${enrollment.student.firstName} ${enrollment.student.fatherName}.`,
    });

    res.status(201).json({
      message: "Conduct report recorded successfully.",
      reportId: report.id,
      reportNumber: report.reportNumber,
    });
  } catch (error) {
    next(error);
  }
});

// List and filter reports for school admin
conductRouter.get("/school/conduct/reports", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active or unauthorized.");
    const schoolId = admin.school.id;

    const statusParam = req.query.status as string | undefined;
    const severityParam = req.query.severity as string | undefined;
    const categoryParam = req.query.category as string | undefined;
    const searchParam = String(req.query.search ?? "").trim().toLowerCase();
    const isSensitiveParam = req.query.isSensitive as string | undefined;

    const whereClause: Prisma.ConductReportWhereInput = {
      schoolId,
      ...(statusParam && statusParam !== "ALL" ? { status: statusParam as ConductStatus } : {}),
      ...(severityParam && severityParam !== "ALL" ? { severity: severityParam as ConductSeverity } : {}),
      ...(categoryParam && categoryParam !== "ALL" ? { category: categoryParam as ConductCategory } : {}),
      ...(isSensitiveParam === "true" ? { isSensitive: true } : isSensitiveParam === "false" ? { isSensitive: false } : {}),
      ...(searchParam
        ? {
            OR: [
              { reportNumber: { contains: searchParam, mode: "insensitive" } },
              { title: { contains: searchParam, mode: "insensitive" } },
              { description: { contains: searchParam, mode: "insensitive" } },
              { student: { firstName: { contains: searchParam, mode: "insensitive" } } },
              { student: { fatherName: { contains: searchParam, mode: "insensitive" } } },
              { student: { permanentId: { contains: searchParam, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [reports, counts] = await Promise.all([
      prisma.conductReport.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              fatherName: true,
              grandfatherName: true,
              permanentId: true,
              photoUrl: true,
            },
          },
          enrollment: {
            select: {
              section: { select: { name: true } },
              classGroup: { select: { level: true } },
              academicYear: { select: { name: true } },
            },
          },
          reporterUser: {
            select: { firstName: true, lastName: true },
          },
          assignedUser: {
            select: { firstName: true, lastName: true },
          },
          _count: {
            select: { actions: true, attachments: true },
          },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      }),
      prisma.conductReport.groupBy({
        by: ["status"],
        where: { schoolId },
        _count: { _all: true },
      }),
    ]);

    const stats = {
      total: counts.reduce((acc, c) => acc + c._count._all, 0),
      submitted: counts.find((c) => c.status === "SUBMITTED")?._count._all ?? 0,
      underReview: counts.find((c) => c.status === "UNDER_REVIEW")?._count._all ?? 0,
      actionRequired: counts.find((c) => c.status === "ACTION_REQUIRED")?._count._all ?? 0,
      resolved: counts.find((c) => c.status === "RESOLVED")?._count._all ?? 0,
      closed: counts.find((c) => c.status === "CLOSED")?._count._all ?? 0,
    };

    const items = reports.map((r) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      studentId: r.student.id,
      studentName: `${r.student.firstName} ${r.student.fatherName} ${r.student.grandfatherName}`,
      studentPermanentId: r.student.permanentId,
      studentPhotoUrl: r.student.photoUrl,
      classLabel: levelLabel(r.enrollment.classGroup.level),
      sectionName: r.enrollment.section.name,
      academicYear: r.enrollment.academicYear.name,
      reporterName: `${r.reporterUser.firstName} ${r.reporterUser.lastName}`,
      assignedTo: r.assignedUser ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}` : null,
      category: r.category,
      severity: r.severity,
      isPositive: r.isPositive,
      title: r.title,
      incidentDate: r.incidentDate.toISOString(),
      location: r.location,
      status: r.status,
      isSensitive: r.isSensitive,
      isParentVisible: r.isParentVisible,
      isStudentVisible: r.isStudentVisible,
      actionCount: r._count.actions,
      attachmentCount: r._count.attachments,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({ reports: items, stats });
  } catch (error) {
    next(error);
  }
});

// Single report detail for school admin
conductRouter.get("/school/conduct/reports/:id", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active or unauthorized.");

    const report = await prisma.conductReport.findFirst({
      where: {
        id: String(req.params.id),
        schoolId: admin.school.id,
      },
      include: {
        student: {
          include: {
            guardians: {
              include: {
                guardian: {
                  select: { firstName: true, lastName: true, phone: true, email: true },
                },
              },
            },
          },
        },
        enrollment: {
          include: {
            section: true,
            classGroup: true,
            academicYear: true,
          },
        },
        reporterUser: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        actions: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: {
              select: { firstName: true, lastName: true, role: true },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!report) throw new HttpError(404, "Conduct report not found.");

    // Fetch school staff members for assignment dropdown
    const staffMembers = await prisma.user.findMany({
      where: {
        schoolId: admin.school.id,
        role: { in: ["SCHOOL_ADMIN", "STAFF", "TEACHER"] },
        status: "ACTIVE",
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    });

    res.json({
      report: {
        id: report.id,
        reportNumber: report.reportNumber,
        category: report.category,
        severity: report.severity,
        isPositive: report.isPositive,
        incidentDate: report.incidentDate.toISOString(),
        location: report.location,
        title: report.title,
        description: report.description,
        actionsTakenByTeacher: report.actionsTakenByTeacher,
        status: report.status,
        requestedVisibility: report.requestedVisibility,
        visibilityLevel: report.visibilityLevel,
        isParentVisible: report.isParentVisible,
        isStudentVisible: report.isStudentVisible,
        isSensitive: report.isSensitive,
        resolutionNotes: report.resolutionNotes,
        resolvedAt: report.resolvedAt?.toISOString() ?? null,
        student: {
          id: report.student.id,
          name: `${report.student.firstName} ${report.student.fatherName} ${report.student.grandfatherName}`,
          permanentId: report.student.permanentId,
          photoUrl: report.student.photoUrl,
          guardians: report.student.guardians.map((g) => ({
            name: `${g.guardian.firstName} ${g.guardian.lastName}`,
            relationship: g.relationship,
            phone: g.guardian.phone,
            email: g.guardian.email,
          })),
        },
        enrollment: {
          classLabel: levelLabel(report.enrollment.classGroup.level),
          sectionName: report.enrollment.section.name,
          academicYear: report.enrollment.academicYear.name,
          studentNumber: report.enrollment.studentNumber,
          rollNumber: report.enrollment.rollNumber,
        },
        reporter: {
          name: `${report.reporterUser.firstName} ${report.reporterUser.lastName}`,
          email: report.reporterUser.email,
          phone: report.reporterUser.phone,
        },
        assignee: report.assignedUser
          ? {
              id: report.assignedUser.id,
              name: `${report.assignedUser.firstName} ${report.assignedUser.lastName}`,
            }
          : null,
        actions: report.actions.map((act) => ({
          id: act.id,
          actionType: act.actionType,
          previousStatus: act.previousStatus,
          newStatus: act.newStatus,
          comment: act.comment,
          isInternalOnly: act.isInternalOnly,
          actorName: `${act.actorUser.firstName} ${act.actorUser.lastName} (${act.actorUser.role})`,
          createdAt: act.createdAt.toISOString(),
        })),
        attachments: report.attachments.map((att) => ({
          id: att.id,
          title: att.title,
          originalName: att.originalName,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          isParentVisible: att.isParentVisible,
          isStudentVisible: att.isStudentVisible,
          createdAt: att.createdAt.toISOString(),
        })),
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      },
      staffOptions: staffMembers.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName} (${s.role.replace("_", " ")})`,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Update status of a report (Admin)
conductRouter.post("/school/conduct/reports/:id/status", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const report = await prisma.conductReport.findFirst({
      where: { id: String(req.params.id), schoolId: admin.school.id },
    });
    if (!report) throw new HttpError(404, "Conduct report not found.");

    const { status, comment } = parsed.data;
    const isNowResolved = status === ConductStatus.RESOLVED || status === ConductStatus.CLOSED;

    await prisma.$transaction(async (tx) => {
      await tx.conductReport.update({
        where: { id: report.id },
        data: {
          status,
          ...(isNowResolved ? { resolvedAt: new Date(), resolutionNotes: comment || report.resolutionNotes } : {}),
        },
      });

      await tx.conductAction.create({
        data: {
          reportId: report.id,
          actorUserId: req.authUser!.id,
          actionType: "STATUS_CHANGE",
          previousStatus: report.status,
          newStatus: status,
          comment: comment || `Status changed from ${report.status} to ${status}.`,
          isInternalOnly: false,
        },
      });
    });

    await writeAudit({
      schoolId: admin.school.id,
      actorUserId: req.authUser!.id,
      action: "CONDUCT_REPORT_STATUS_CHANGE",
      entityType: "ConductReport",
      entityId: report.id,
      summary: `Changed status of report ${report.reportNumber} to ${status}.`,
    });

    res.json({ message: `Report status updated to ${status}.` });
  } catch (error) {
    next(error);
  }
});

// Update sharing / visibility (Admin)
conductRouter.post("/school/conduct/reports/:id/visibility", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");

    const parsed = updateVisibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const report = await prisma.conductReport.findFirst({
      where: { id: String(req.params.id), schoolId: admin.school.id },
    });
    if (!report) throw new HttpError(404, "Conduct report not found.");

    const { isParentVisible, isStudentVisible, comment } = parsed.data;

    // Safeguard check
    if (report.isSensitive && (isParentVisible || isStudentVisible)) {
      throw new HttpError(
        400,
        "This report is marked as a SENSITIVE SAFEGUARDING concern. Safeguarding reports cannot be published directly to parents or students through standard visibility settings.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.conductReport.update({
        where: { id: report.id },
        data: {
          isParentVisible,
          isStudentVisible,
          visibilityLevel:
            isParentVisible && isStudentVisible
              ? ConductVisibilityLevel.COMMUNITY_PUBLISHED
              : isParentVisible
              ? ConductVisibilityLevel.PARENT_APPROVED
              : isStudentVisible
              ? ConductVisibilityLevel.STUDENT_APPROVED
              : ConductVisibilityLevel.STAFF_INTERNAL,
        },
      });

      await tx.conductAction.create({
        data: {
          reportId: report.id,
          actorUserId: req.authUser!.id,
          actionType: "VISIBILITY_CHANGED",
          comment:
            comment ||
            `Sharing updated: Parent visible: ${isParentVisible ? "YES" : "NO"}, Student visible: ${
              isStudentVisible ? "YES" : "NO"
            }.`,
          isInternalOnly: true,
        },
      });
    });

    await writeAudit({
      schoolId: admin.school.id,
      actorUserId: req.authUser!.id,
      action: "CONDUCT_REPORT_VISIBILITY_UPDATE",
      entityType: "ConductReport",
      entityId: report.id,
      summary: `Updated visibility for ${report.reportNumber}: Parent=${isParentVisible}, Student=${isStudentVisible}.`,
    });

    res.json({ message: "Visibility settings updated." });
  } catch (error) {
    next(error);
  }
});

// Assign report to follow-up staff
conductRouter.post("/school/conduct/reports/:id/assign", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");

    const report = await prisma.conductReport.findFirst({
      where: { id: String(req.params.id), schoolId: admin.school.id },
    });
    if (!report) throw new HttpError(404, "Conduct report not found.");

    const assignedToUserId = req.body.assignedToUserId ? String(req.body.assignedToUserId) : null;
    let assigneeName = "Unassigned";

    if (assignedToUserId) {
      const targetUser = await prisma.user.findFirst({
        where: { id: assignedToUserId, schoolId: admin.school.id },
      });
      if (!targetUser) throw new HttpError(404, "Selected assignee is not an active staff member in this school.");
      assigneeName = `${targetUser.firstName} ${targetUser.lastName}`;
    }

    await prisma.$transaction(async (tx) => {
      await tx.conductReport.update({
        where: { id: report.id },
        data: { assignedToUserId },
      });

      await tx.conductAction.create({
        data: {
          reportId: report.id,
          actorUserId: req.authUser!.id,
          actionType: "ASSIGNMENT_CHANGED",
          comment: `Case assigned to: ${assigneeName}.`,
          isInternalOnly: true,
        },
      });
    });

    res.json({ message: `Case assignment updated to ${assigneeName}.` });
  } catch (error) {
    next(error);
  }
});

// Record an administrative follow-up action / intervention note
conductRouter.post("/school/conduct/reports/:id/actions", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { school: true },
    });
    if (!admin?.school?.isActive) throw new HttpError(403, "School is not active.");

    const parsed = addActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const report = await prisma.conductReport.findFirst({
      where: { id: String(req.params.id), schoolId: admin.school.id },
    });
    if (!report) throw new HttpError(404, "Conduct report not found.");

    const { actionType, comment, isInternalOnly } = parsed.data;

    const action = await prisma.conductAction.create({
      data: {
        reportId: report.id,
        actorUserId: req.authUser!.id,
        actionType,
        comment,
        isInternalOnly,
      },
    });

    res.status(201).json({
      message: "Action record added to incident history.",
      actionId: action.id,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 3. PARENT PORTAL ENDPOINT
// ---------------------------------------------------------------------------

// List approved conduct reports for a verified child
conductRouter.get("/parent/children/:studentId/conduct", requireAuth, requireRole("PARENT"), async (req, res, next) => {
  try {
    const studentId = String(req.params.studentId);

    // Verify parent has legitimate verified guardianship of this child
    const guardian = await prisma.guardian.findFirst({
      where: {
        userId: req.authUser!.id,
        students: { some: { studentId } },
      },
      include: {
        students: {
          where: { studentId },
          include: { student: true },
        },
      },
    });

    if (!guardian || guardian.students.length === 0) {
      throw new HttpError(403, "You do not have authorized access to records for this student.");
    }

    const student = guardian.students[0].student;

    // Strict privacy query: ONLY parent-visible, NON-sensitive reports in published workflow states
    const reports = await prisma.conductReport.findMany({
      where: {
        studentId,
        isParentVisible: true,
        isSensitive: false,
        status: { in: ["UNDER_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
      },
      include: {
        enrollment: {
          select: {
            section: { select: { name: true } },
            classGroup: { select: { level: true } },
            academicYear: { select: { name: true } },
          },
        },
        actions: {
          where: { isInternalOnly: false },
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          where: { isParentVisible: true },
        },
      },
      orderBy: { incidentDate: "desc" },
    });

    const items = reports.map((r) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      category: r.category,
      severity: r.severity,
      isPositive: r.isPositive,
      title: r.title,
      incidentDate: r.incidentDate.toISOString(),
      location: r.location,
      description: r.description,
      status: r.status,
      resolutionNotes: r.resolutionNotes,
      classLabel: levelLabel(r.enrollment.classGroup.level),
      sectionName: r.enrollment.section.name,
      academicYear: r.enrollment.academicYear.name,
      timeline: r.actions.map((act) => ({
        id: act.id,
        actionType: act.actionType,
        comment: act.comment,
        createdAt: act.createdAt.toISOString(),
      })),
      attachments: r.attachments.map((att) => ({
        id: att.id,
        title: att.title,
        originalName: att.originalName,
        sizeBytes: att.sizeBytes,
      })),
    }));

    res.json({
      studentName: `${student.firstName} ${student.fatherName}`,
      reports: items,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 4. STUDENT PORTAL ENDPOINT
// ---------------------------------------------------------------------------

// List approved conduct reports / merits for the authenticated student
conductRouter.get("/student/conduct", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) throw new HttpError(403, "Student identity not verified.");

    const student = await prisma.student.findFirst({
      where: {
        OR: [
          ...(user.personKey ? [{ permanentId: user.personKey }, { secondaryPermanentId: user.personKey }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
    });

    if (!student) {
      res.json({ reports: [] });
      return;
    }

    // Strict privacy query: ONLY student-visible, NON-sensitive reports in published workflow states
    const reports = await prisma.conductReport.findMany({
      where: {
        studentId: student.id,
        isStudentVisible: true,
        isSensitive: false,
        status: { in: ["ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
      },
      include: {
        enrollment: {
          select: {
            section: { select: { name: true } },
            classGroup: { select: { level: true } },
            academicYear: { select: { name: true } },
          },
        },
        actions: {
          where: { isInternalOnly: false },
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          where: { isStudentVisible: true },
        },
      },
      orderBy: { incidentDate: "desc" },
    });

    const items = reports.map((r) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      category: r.category,
      severity: r.severity,
      isPositive: r.isPositive,
      title: r.title,
      incidentDate: r.incidentDate.toISOString(),
      description: r.description,
      status: r.status,
      resolutionNotes: r.resolutionNotes,
      classLabel: levelLabel(r.enrollment.classGroup.level),
      sectionName: r.enrollment.section.name,
      academicYear: r.enrollment.academicYear.name,
      timeline: r.actions.map((act) => ({
        id: act.id,
        actionType: act.actionType,
        comment: act.comment,
        createdAt: act.createdAt.toISOString(),
      })),
      attachments: r.attachments.map((att) => ({
        id: att.id,
        title: att.title,
        originalName: att.originalName,
        sizeBytes: att.sizeBytes,
      })),
    }));

    res.json({
      studentName: `${student.firstName} ${student.fatherName}`,
      reports: items,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 5. ATTACHMENT DOWNLOAD ENDPOINT (SERVER-SIDE ENFORCED)
// ---------------------------------------------------------------------------

conductRouter.get("/conduct/attachments/:attachmentId", requireAuth, async (req, res, next) => {
  try {
    const attachment = await prisma.conductAttachment.findUnique({
      where: { id: String(req.params.attachmentId) },
      include: {
        report: {
          include: { student: true },
        },
      },
    });

    if (!attachment) throw new HttpError(404, "Attachment not found.");

    const role = req.authUser!.role;
    const userId = req.authUser!.id;
    const report = attachment.report;

    // Check authorization based on user role
    let isAuthorized = false;

    if (role === "SUPER_ADMIN") {
      isAuthorized = true;
    } else if (role === "SCHOOL_ADMIN") {
      isAuthorized = req.authUser!.schoolId === report.schoolId;
    } else if (role === "TEACHER") {
      isAuthorized = report.reporterUserId === userId;
    } else if (role === "PARENT") {
      if (attachment.isParentVisible && report.isParentVisible && !report.isSensitive) {
        const guardian = await prisma.guardian.findFirst({
          where: { userId, students: { some: { studentId: report.studentId } } },
        });
        isAuthorized = Boolean(guardian);
      }
    } else if (role === "STUDENT") {
      if (attachment.isStudentVisible && report.isStudentVisible && !report.isSensitive) {
        const studentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (studentUser) {
          const student = await prisma.student.findFirst({
            where: {
              id: report.studentId,
              OR: [
                ...(studentUser.personKey ? [{ permanentId: studentUser.personKey }, { secondaryPermanentId: studentUser.personKey }] : []),
                ...(studentUser.phone ? [{ phone: studentUser.phone }] : []),
              ],
            },
          });
          isAuthorized = Boolean(student);
        }
      }
    }

    if (!isAuthorized) {
      throw new HttpError(403, "You are not authorized to access this attachment.");
    }

    const filePath = absoluteStoragePath(attachment.storageKey);
    try {
      await access(filePath);
    } catch {
      throw new HttpError(404, "Attachment file is missing from storage.");
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// 6. SUPER ADMIN OVERVIEW ENDPOINT
// ---------------------------------------------------------------------------

conductRouter.get("/superadmin/conduct/overview", requireAuth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const schoolIdParam = req.query.schoolId as string | undefined;

    const [schools, counts, urgentReports] = await Promise.all([
      prisma.school.findMany({
        where: schoolIdParam ? { id: schoolIdParam } : { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.conductReport.groupBy({
        by: ["schoolId", "status", "severity", "isPositive"],
        where: schoolIdParam ? { schoolId: schoolIdParam } : {},
        _count: { _all: true },
      }),
      prisma.conductReport.findMany({
        where: {
          severity: { in: [ConductSeverity.HIGH, ConductSeverity.URGENT] },
          status: { in: [ConductStatus.SUBMITTED, ConductStatus.UNDER_REVIEW, ConductStatus.ACTION_REQUIRED] },
          ...(schoolIdParam ? { schoolId: schoolIdParam } : {}),
        },
        include: {
          school: { select: { name: true, code: true } },
          student: { select: { firstName: true, fatherName: true, permanentId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    res.json({
      schools,
      counts,
      urgentReports: urgentReports.map((r) => ({
        id: r.id,
        reportNumber: r.reportNumber,
        schoolName: r.school.name,
        studentName: `${r.student.firstName} ${r.student.fatherName}`,
        category: r.category,
        severity: r.severity,
        status: r.status,
        title: r.title,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});
