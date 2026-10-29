import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { loadExaminations, type PublishedMark } from "../lib/examAverages.js";
import { generateTransferCertificateDocx, generateStudentTranscriptDocx, type TranscriptYearData } from "../lib/externalTransferDocx.js";
import { enrollClass8InForm1 } from "../lib/form1Enrollment.js";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

async function nextStudentNumber(tx: Prisma.TransactionClient, schoolId: string) {
  const key = `student-number:${schoolId}`;
  const floorRows = await tx.$queryRaw<Array<{ max: number }>>`
    SELECT COALESCE(MAX("studentNumber"::int), 0) AS max
    FROM "Enrollment"
    WHERE "schoolId" = ${schoolId} AND "studentNumber" ~ '^[0-9]+$'
  `;
  const floor = Number(floorRows[0]?.max ?? 0);
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, ${floor + 1})
    ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("IdSequence"."value", ${floor}) + 1
    RETURNING "value"
  `;
  return String(rows[0].value).padStart(5, "0");
}

async function nextRollNumber(tx: Prisma.TransactionClient, sectionId: string) {
  const key = `roll:${sectionId}`;
  const floorRows = await tx.$queryRaw<Array<{ max: number }>>`
    SELECT COALESCE(MAX("rollNumber"), 0) AS max
    FROM "Enrollment"
    WHERE "sectionId" = ${sectionId}
  `;
  const floor = Number(floorRows[0]?.max ?? 0);
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, ${floor + 1})
    ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("IdSequence"."value", ${floor}) + 1
    RETURNING "value"
  `;
  return Number(rows[0].value);
}

function schoolSupportsLevel(type: string, level: string) {
  if (level.startsWith("CLASS_")) return type !== "SECONDARY_ONLY";
  if (level.startsWith("FORM_")) return type !== "PRIMARY_ONLY";
  return false;
}

export const transfersRouter = Router();

transfersRouter.post("/section-moves", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({ enrollmentId: z.string(), toSectionId: z.string() }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the student enrollment and the new section.");
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: body.data.enrollmentId, schoolId: school.id, status: "ACTIVE" },
      include: { classGroup: true },
    });
    if (!enrollment) throw new HttpError(404, "Active enrollment was not found.");
    if (enrollment.sectionId === body.data.toSectionId) throw new HttpError(400, "The student is already in that section.");
    const toSection = await prisma.section.findFirst({
      where: {
        id: body.data.toSectionId,
        classGroupId: enrollment.classGroupId,
        classGroup: { schoolId: school.id, academicYearId: enrollment.academicYearId },
      },
    });
    if (!toSection) throw new HttpError(400, "Choose another section in the same class and year.");
    const moved = await prisma.$transaction(async (tx) => {
      const toRollNumber = await nextRollNumber(tx, toSection.id);
      await tx.sectionMove.create({
        data: {
          enrollmentId: enrollment.id,
          fromSectionId: enrollment.sectionId,
          toSectionId: toSection.id,
          fromRollNumber: enrollment.rollNumber,
          toRollNumber,
          movedByUserId: req.authUser!.id,
        },
      });
      return tx.enrollment.update({
        where: { id: enrollment.id },
        data: { sectionId: toSection.id, rollNumber: toRollNumber },
      });
    });
    res.json(moved);
  } catch (error) {
    next(error);
  }
});

transfersRouter.post("/section-moves/batch", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({
      enrollmentIds: z.array(z.string().min(1)).min(1).max(200),
      toSectionId: z.string().min(1),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the students and the destination section.");
    const enrollmentIds = [...new Set(body.data.enrollmentIds)];
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds }, schoolId: school.id, status: "ACTIVE" },
    });
    if (enrollments.length !== enrollmentIds.length) throw new HttpError(404, "Choose active students in this school.");
    const first = enrollments[0];
    if (enrollments.some((item) => item.sectionId !== first.sectionId || item.classGroupId !== first.classGroupId || item.academicYearId !== first.academicYearId)) {
      throw new HttpError(400, "All selected students must come from the same class and section.");
    }
    if (first.sectionId === body.data.toSectionId) throw new HttpError(400, "Choose a different section.");
    const toSection = await prisma.section.findFirst({
      where: {
        id: body.data.toSectionId,
        classGroupId: first.classGroupId,
        classGroup: { schoolId: school.id, academicYearId: first.academicYearId },
      },
    });
    if (!toSection) throw new HttpError(400, "Choose another section in the same class and year.");
    const moved = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const enrollment of enrollments) {
        const toRollNumber = await nextRollNumber(tx, toSection.id);
        await tx.sectionMove.create({
          data: {
            enrollmentId: enrollment.id,
            fromSectionId: enrollment.sectionId,
            toSectionId: toSection.id,
            fromRollNumber: enrollment.rollNumber,
            toRollNumber,
            movedByUserId: req.authUser!.id,
          },
        });
        results.push(await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { sectionId: toSection.id, rollNumber: toRollNumber },
        }));
      }
      return results;
    });
    res.json({ count: moved.length });
  } catch (error) {
    next(error);
  }
});

transfersRouter.get("/org-schools", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const level = String(req.query.level ?? "").trim();
    const schools = await prisma.school.findMany({
      where: { organizationId: school.organizationId, isActive: true, NOT: { id: school.id } },
      select: { id: true, name: true, code: true, type: true },
      orderBy: { name: "asc" },
    });
    res.json(level ? schools.filter((item) => schoolSupportsLevel(item.type, level)) : schools);
  } catch (error) {
    next(error);
  }
});

transfersRouter.get("/school-placement/:schoolId", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const target = await prisma.school.findFirst({
      where: { id: String(req.params.schoolId), organizationId: school.organizationId, isActive: true },
    });
    if (!target) throw new HttpError(404, "School was not found.");
    const years = await prisma.academicYear.findMany({
      where: { schoolId: target.id },
      orderBy: { startDate: "desc" },
      include: {
        classes: {
          include: { sections: { orderBy: { name: "asc" } } },
          orderBy: { level: "asc" },
        },
      },
    });
    res.json(years.map((year) => ({
      id: year.id,
      name: year.name,
      classes: year.classes.map((item) => ({
        id: item.id,
        label: levelLabel(item.level),
        level: item.level,
        sections: item.sections,
      })),
    })));
  } catch (error) {
    next(error);
  }
});

transfersRouter.post("/transfer-requests", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({
      enrollmentIds: z.array(z.string().min(1)).min(1).max(200),
      toSchoolId: z.string(),
      note: z.string().trim().min(3).max(500),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose students, a destination school, and enter the transfer reason.");
    const enrollmentIds = [...new Set(body.data.enrollmentIds)];
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds }, schoolId: school.id, status: "ACTIVE" },
      include: { classGroup: true, student: true, academicYear: true, section: true },
    });
    if (enrollments.length !== enrollmentIds.length) throw new HttpError(404, "Alumni are transferred from Alumni. This page is only for students who are still studying.");
    const first = enrollments[0];
    if (enrollments.some((enrollment) => enrollment.academicYearId !== first.academicYearId || enrollment.sectionId !== first.sectionId)) {
      throw new HttpError(400, "All selected students must come from the same year and section.");
    }
    if (enrollments.some((enrollment) => enrollment.student.status === "ALUMNI")) {
      throw new HttpError(400, "Alumni cannot be transferred using ordinary student transfers. Class 8 graduates must use Form 1 admission.");
    }
    const alumniCheck = await prisma.alumniRecord.findFirst({
      where: {
        studentId: { in: enrollments.map((e) => e.studentId) },
        fromLevel: "CLASS_8",
      },
    });
    if (alumniCheck) {
      throw new HttpError(400, "Alumni students cannot be transferred using ordinary student transfers. Class 8 graduates must use Form 1 admission.");
    }
    const destination = await prisma.school.findFirst({
      where: { id: body.data.toSchoolId, organizationId: school.organizationId, isActive: true },
    });
    if (!destination || destination.id === school.id) throw new HttpError(400, "Choose another school in this organization.");
    if (!schoolSupportsLevel(destination.type, first.classGroup.level)) {
      throw new HttpError(400, "The destination school does not support this student's primary/secondary level.");
    }
    const pending = await prisma.transferRequest.findMany({
      where: {
        fromEnrollmentId: { in: enrollmentIds },
        status: { in: ["PENDING", "WAITING_FOR_SECTION"] },
      },
      select: { fromEnrollmentId: true },
    });
    if (pending.length) throw new HttpError(409, "One or more selected students already have an active transfer request.");
    const created = await prisma.$transaction(
      enrollments.map((enrollment) =>
        prisma.transferRequest.create({
          data: {
            studentId: enrollment.studentId,
            fromSchoolId: school.id,
            toSchoolId: destination.id,
            fromEnrollmentId: enrollment.id,
            note: body.data.note,
            requestedByUserId: req.authUser!.id,
          },
        }),
      ),
    );
    for (const item of created) {
      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "TRANSFER_REQUEST_CREATED",
        entityType: "TransferRequest",
        entityId: item.id,
        summary: `Created internal transfer request for student to ${destination.name}.`,
      });
    }
    res.status(201).json({ count: created.length });
  } catch (error) {
    next(error);
  }
});

transfersRouter.get("/transfer-requests", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const rows = await prisma.transferRequest.findMany({
      where: { OR: [{ fromSchoolId: school.id }, { toSchoolId: school.id }] },
      orderBy: { createdAt: "desc" },
    });
    const students = await prisma.student.findMany({ where: { id: { in: rows.map((item) => item.studentId) } } });
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: rows.map((item) => item.fromEnrollmentId) } },
      include: { academicYear: true, classGroup: true, section: true },
    });
    const schools = await prisma.school.findMany({
      where: { id: { in: [...new Set(rows.flatMap((item) => [item.fromSchoolId, item.toSchoolId]))] } },
    });
    const destinationSections = await prisma.section.findMany({
      where: { id: { in: rows.flatMap((item) => item.toSectionId ? [item.toSectionId] : []) } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    res.json(rows.map((row) => {
      const student = students.find((item) => item.id === row.studentId);
      const enrollment = enrollments.find((item) => item.id === row.fromEnrollmentId);
      const destination = destinationSections.find((item) => item.id === row.toSectionId);
      const form1 = enrollment?.status === "ALUMNI" && enrollment?.classGroup?.level === "CLASS_8";
      return {
        ...row,
        permanentId: student?.permanentId ?? "",
        secondaryPermanentId: student?.secondaryPermanentId ?? null,
        name: student ? `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim() : "",
        gender: student?.gender === "MALE" ? "Male" : student?.gender === "FEMALE" ? "Female" : "",
        fromSchool: schools.find((item) => item.id === row.fromSchoolId)?.name ?? "",
        toSchool: schools.find((item) => item.id === row.toSchoolId)?.name ?? "",
        incoming: row.toSchoolId === school.id,
        kind: form1 ? "FORM_1" : enrollment?.status === "TRANSFERRED" ? "RETURN" : "SAME_LEVEL",
        sourceYear: enrollment?.academicYear?.name ?? "",
        sourceLevel: enrollment?.classGroup ? levelLabel(enrollment.classGroup.level) : "",
        sourceLevelCode: enrollment?.classGroup?.level ?? "",
        sourceSection: enrollment?.section?.name ?? "",
        destinationYear: destination?.classGroup?.academicYear?.name ?? "",
        destinationLevel: destination?.classGroup ? levelLabel(destination.classGroup.level) : "",
        destinationSection: destination?.name ?? "",
        requestedAt: row.createdAt,
        statusUpdatedAt: row.updatedAt,
      };
    }));
  } catch (error) {
    next(error);
  }
});

transfersRouter.post("/transfer-requests/:id/reject", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const reason = z.object({ reason: z.string().trim().max(500).optional() }).safeParse(req.body ?? {});
    const rejectReason = reason.success ? reason.data.reason?.trim() || null : null;
    const request = await prisma.transferRequest.findFirst({
      where: { id: String(req.params.id), toSchoolId: school.id, status: "PENDING" },
    });
    if (!request) throw new HttpError(404, "Pending transfer was not found.");
    await prisma.transferRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejectReason,
        decidedByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "TRANSFER_REQUEST_REJECTED",
      entityType: "TransferRequest",
      entityId: request.id,
      summary: `Rejected internal transfer request for student ID ${request.studentId}.`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

transfersRouter.post("/transfer-requests/:id/approve", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({
      toAcademicYearId: z.string().min(1).optional(),
      toSectionId: z.string().min(1).optional(),
    }).safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, "Choose a valid destination year and section.");
    const request = await prisma.transferRequest.findFirst({
      where: {
        id: String(req.params.id),
        toSchoolId: school.id,
        status: { in: ["PENDING", "WAITING_FOR_SECTION"] },
      },
    });
    if (!request) throw new HttpError(404, "Active transfer request was not found.");
    const alumniSource = await prisma.enrollment.findFirst({
      where: { id: request.fromEnrollmentId, status: "ALUMNI", classGroup: { level: "CLASS_8" } },
      include: { student: true, classGroup: true },
    });
    if (alumniSource) {
      if (!body.data.toAcademicYearId || !body.data.toSectionId) throw new HttpError(400, "Open the student, then choose the Form 1 year and section.");
      const [formSection, class8Year, toYear] = await Promise.all([
        prisma.section.findFirst({
          where: { id: body.data.toSectionId, classGroup: { schoolId: school.id, academicYearId: body.data.toAcademicYearId, level: "FORM_1" } },
          include: { classGroup: true },
        }),
        prisma.academicYear.findUnique({ where: { id: alumniSource.academicYearId } }),
        prisma.academicYear.findFirst({ where: { id: body.data.toAcademicYearId, schoolId: school.id } }),
      ]);
      if (!formSection) throw new HttpError(400, "Choose a Form 1 section at this school.");
      if (!class8Year || !toYear || toYear.startDate.getTime() <= class8Year.startDate.getTime()) {
        throw new HttpError(400, "Choose a Form 1 year that starts after the Class 8 year.");
      }
      const created = await prisma.$transaction(async (tx) => {
        const enrolled = await enrollClass8InForm1(tx, {
          student: alumniSource.student,
          organizationId: school.organizationId,
          destinationSchoolId: school.id,
          academicYearId: body.data.toAcademicYearId!,
          section: { id: formSection.id, classGroupId: formSection.classGroupId },
        });
        await tx.transferRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            decidedByUserId: req.authUser!.id,
            decidedAt: new Date(),
            newEnrollmentId: enrolled.enrollment.id,
            toAcademicYearId: body.data.toAcademicYearId,
            toSectionId: formSection.id,
          },
        });
        return enrolled;
      });
      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "TRANSFER_REQUEST_COMPLETED",
        entityType: "TransferRequest",
        entityId: request.id,
        summary: `Approved Form 1 progression for student ${alumniSource.student.permanentId} into Section ${formSection.name} (initiated by ${request.requestedByUserId}, approved by ${req.authUser!.id}, fromSchool=${request.fromSchoolId}, toSchool=${school.id}, fromEnrollment=${request.fromEnrollmentId}, newEnrollment=${created.enrollment.id}).`,
      });
      res.json({ ...created, sectionName: formSection.name, yearName: toYear.name });
      return;
    }
    const targetYearId = body.data.toAcademicYearId ?? request.toAcademicYearId ?? undefined;
    const targetSectionId = body.data.toSectionId ?? request.toSectionId ?? undefined;
    if (!targetYearId || !targetSectionId) {
      const waiting = await prisma.transferRequest.update({
        where: { id: request.id },
        data: {
          status: "WAITING_FOR_SECTION",
          decidedByUserId: req.authUser!.id,
          toAcademicYearId: null,
          toSectionId: null,
        },
      });
      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "TRANSFER_REQUEST_APPROVED",
        entityType: "TransferRequest",
        entityId: request.id,
        summary: `Accepted incoming student transfer for student ID ${request.studentId}, waiting for section placement.`,
      });
      res.json(waiting);
      return;
    }
    const source = await prisma.enrollment.findFirst({
      where: { id: request.fromEnrollmentId, status: { in: ["ACTIVE", "TRANSFERRED"] } },
      include: { academicYear: true, classGroup: true, student: true },
    });
    if (!source) throw new HttpError(409, "Source enrollment is no longer eligible for transfer.");
    const isReturn = source.status === "TRANSFERRED";
    const section = await prisma.section.findFirst({
      where: {
        id: targetSectionId,
        classGroup: {
          schoolId: school.id,
          academicYearId: targetYearId,
          ...(isReturn
            ? {}
            : {
              level: source.classGroup.level,
              academicYear: { name: source.academicYear.name },
            }),
        },
      },
      include: { classGroup: { include: { academicYear: true } } },
    });
    if (!section) {
      throw new HttpError(
        400,
        isReturn
          ? "Choose a valid destination academic year and section at this school."
          : "Choose a section with the same academic year and class/form level.",
      );
    }
    if (!schoolSupportsLevel(school.type, section.classGroup.level)) {
      throw new HttpError(400, "Destination school does not support this class or form level.");
    }
    const decidedAt = new Date();
    const completed = await prisma.$transaction(async (tx) => {
      const activeClash = await tx.enrollment.findFirst({
        where: {
          studentId: request.studentId,
          status: "ACTIVE",
          ...(isReturn ? {} : { id: { not: source.id } }),
        },
      });
      if (activeClash) throw new HttpError(409, "This student already has an active enrollment.");
      if (!isReturn) {
        const yearClash = await tx.enrollment.findFirst({
          where: {
            studentId: request.studentId,
            academicYearId: targetYearId,
            status: { not: "TRANSFERRED" },
          },
        });
        if (yearClash) throw new HttpError(409, "This student already has an enrollment in the destination year.");
      }
      const studentNumber = await nextStudentNumber(tx, school.id);
      const rollNumber = await nextRollNumber(tx, section.id);
      if (!isReturn) {
        await tx.enrollment.update({ where: { id: source.id }, data: { status: "TRANSFERRED" } });
      }
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: request.studentId,
          schoolId: school.id,
          academicYearId: targetYearId,
          classGroupId: section.classGroupId,
          sectionId: section.id,
          studentNumber,
          rollNumber,
          status: "ACTIVE",
        },
      });
      await tx.student.update({
        where: { id: request.studentId },
        data: {
          status: "ACTIVE",
          ...(source.schoolId !== school.id
            ? {
              previousSchoolId: source.schoolId,
              previousClass: levelLabel(source.classGroup.level),
              leavingYear: source.academicYear.name,
            }
            : {}),
        },
      });
      const portalUsers = await tx.user.findMany({
        where: {
          role: "STUDENT",
          personKey: {
            in: [
              source.student.permanentId,
              ...(source.student.secondaryPermanentId ? [source.student.secondaryPermanentId] : []),
            ],
          },
        },
      });
      for (const pu of portalUsers) {
        await tx.user.update({
          where: { id: pu.id },
          data: {
            schoolId: school.id,
            status: pu.passwordHash ? "ACTIVE" : "INVITED",
          },
        });
      }
      await tx.transferRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          decidedByUserId: req.authUser!.id,
          decidedAt,
          newEnrollmentId: enrollment.id,
          toAcademicYearId: targetYearId,
          toSectionId: section.id,
        },
      });
      return { enrollment, rollNumber };
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: isReturn ? "STUDENT_REENROLLED" : "TRANSFER_REQUEST_COMPLETED",
      entityType: "TransferRequest",
      entityId: request.id,
      summary: `${isReturn ? "Approved student return/re-enrollment" : "Completed internal transfer"} for student ${source.student.permanentId} into ${school.name} Section ${section.name} (initiatedBy=${request.requestedByUserId}, approvedBy=${req.authUser!.id}, fromSchool=${request.fromSchoolId}, toSchool=${school.id}, fromEnrollment=${source.id}, newEnrollment=${completed.enrollment.id}, reason=${request.note ?? "N/A"}).`,
    });
    res.json(completed);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      next(new HttpError(409, "A conflict occurred with student number or roll number. Please try again."));
      return;
    }
    next(error);
  }
});

// Phase 1: External Transfer Draft Endpoints

transfersRouter.post(["/external/draft", "/transfers/external/draft"], requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z
      .object({
        enrollmentId: z.string().min(1, "Enrollment ID is required."),
        destinationSchoolName: z.string().trim().max(200).optional().nullable(),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .safeParse(req.body);

    if (!body.success) {
      throw new HttpError(400, body.error.issues[0]?.message || "Invalid request payload.");
    }

    const { enrollmentId, destinationSchoolName, reason } = body.data;

    // Validate active enrollment belonging to the admin's school
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId: school.id, status: "ACTIVE" },
      include: {
        student: true,
        classGroup: true,
        section: true,
        academicYear: true,
        school: true,
      },
    });

    if (!enrollment) {
      throw new HttpError(404, "Active enrollment was not found in your school.");
    }

    // Check for conflicting pending internal transfer requests
    const activeInternalTransfer = await prisma.transferRequest.findFirst({
      where: {
        fromEnrollmentId: enrollment.id,
        status: { in: ["PENDING", "WAITING_FOR_SECTION"] },
      },
    });

    if (activeInternalTransfer) {
      throw new HttpError(
        409,
        "An internal transfer request is currently active for this student. Resolve or cancel it first."
      );
    }

    // Check for existing external transfer record for this enrollment
    const existing = await prisma.externalTransfer.findUnique({
      where: { enrollmentId: enrollment.id },
    });

    if (existing) {
      if (existing.status === "CONFIRMED") {
        throw new HttpError(400, "This enrollment has already been confirmed as transferred externally.");
      }

      // Idempotency: If pending or cancelled, update destination/reason and return existing record with original certificateNumber
      const updated = await prisma.externalTransfer.update({
        where: { id: existing.id },
        data: {
          destinationSchoolName: destinationSchoolName !== undefined ? destinationSchoolName : existing.destinationSchoolName,
          reason: reason !== undefined ? reason : existing.reason,
          status: "PENDING",
          cancelledAt: null,
          cancelReason: null,
        },
      });

      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "EXTERNAL_TRANSFER_DRAFT_UPDATED",
        entityType: "ExternalTransfer",
        entityId: updated.id,
        summary: `External transfer draft updated for student ${enrollment.student.firstName} ${enrollment.student.fatherName} (Cert #${updated.certificateNumber}).`,
      });

      return res.json({
        ...updated,
        student: enrollment.student,
        enrollment,
      });
    }

    // Create new external transfer draft in transaction to allocate sequence atomically
    const draft = await prisma.$transaction(async (tx) => {
      const seq = await nextValue(tx, `tc:${school.id}`);
      const schoolCode = school.code || "SCH";
      const certificateNumber = `TC-${schoolCode}-${String(seq).padStart(5, "0")}`;

      const created = await tx.externalTransfer.create({
        data: {
          schoolId: school.id,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          destinationSchoolName: destinationSchoolName || null,
          reason: reason || null,
          certificateNumber,
          status: "PENDING",
          initiatedByUserId: req.authUser!.id,
        },
      });

      return created;
    });

    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "EXTERNAL_TRANSFER_DRAFT_CREATED",
      entityType: "ExternalTransfer",
      entityId: draft.id,
      summary: `External transfer draft created for student ${enrollment.student.firstName} ${enrollment.student.fatherName} (Cert #${draft.certificateNumber}).`,
    });

    res.status(201).json({
      ...draft,
      student: enrollment.student,
      enrollment,
    });
  } catch (error) {
    next(error);
  }
});

transfersRouter.get(["/external/:enrollmentId", "/transfers/external/:enrollmentId"], requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const enrollmentId = String(req.params.enrollmentId);

    const draft = await prisma.externalTransfer.findFirst({
      where: {
        enrollmentId,
        schoolId: school.id,
      },
      include: {
        student: true,
        enrollment: {
          include: {
            classGroup: true,
            section: true,
            academicYear: true,
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        confirmedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!draft) {
      throw new HttpError(404, "External transfer draft was not found for this enrollment.");
    }

    res.json(draft);
  } catch (error) {
    next(error);
  }
});

transfersRouter.post(["/external/:enrollmentId/cancel", "/transfers/external/:enrollmentId/cancel"], requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const enrollmentId = String(req.params.enrollmentId);

    const body = z
      .object({
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .safeParse(req.body);

    if (!body.success) {
      throw new HttpError(400, body.error.issues[0]?.message || "Invalid cancellation request.");
    }

    const draft = await prisma.externalTransfer.findFirst({
      where: {
        enrollmentId,
        schoolId: school.id,
      },
      include: {
        student: true,
      },
    });

    if (!draft) {
      throw new HttpError(404, "External transfer draft was not found.");
    }

    if (draft.status === "CONFIRMED") {
      throw new HttpError(400, "Cannot cancel an external transfer that has already been confirmed.");
    }

    if (draft.status === "CANCELLED") {
      return res.json(draft);
    }

    const cancelled = await prisma.externalTransfer.update({
      where: { id: draft.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: body.data.reason || null,
      },
    });

    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "EXTERNAL_TRANSFER_DRAFT_CANCELLED",
      entityType: "ExternalTransfer",
      entityId: cancelled.id,
      summary: `External transfer draft cancelled for student ${draft.student.firstName} ${draft.student.fatherName} (Cert #${draft.certificateNumber}).`,
    });

    res.json(cancelled);
  } catch (error) {
    next(error);
  }
});

// Phase 2: Transfer Certificate DOCX Download
transfersRouter.get(
  ["/external/:enrollmentId/documents/tc", "/transfers/external/:enrollmentId/documents/tc"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const enrollmentId = String(req.params.enrollmentId);

      const transfer = await prisma.externalTransfer.findFirst({
        where: { enrollmentId, schoolId: school.id },
        include: {
          student: {
            include: {
              guardians: {
                include: { guardian: true },
                take: 1,
              },
            },
          },
          enrollment: {
            include: {
              academicYear: true,
              classGroup: true,
              section: true,
            },
          },
          school: true,
        },
      });

      if (!transfer) {
        throw new HttpError(404, "External transfer record was not found for this enrollment.");
      }

      const guardian = transfer.student.guardians[0];
      const fullName = `${transfer.student.firstName} ${transfer.student.fatherName} ${transfer.student.grandfatherName}`.replace(/\s+/g, " ").trim();

      const docxBuffer = await generateTransferCertificateDocx({
        certificateNumber: transfer.certificateNumber,
        issuedDate: new Date(),
        school: {
          name: school.name,
          code: school.code,
          address: school.address,
        },
        student: {
          fullName,
          permanentId: transfer.student.permanentId,
          secondaryPermanentId: transfer.student.secondaryPermanentId,
          gender: transfer.student.gender,
          dateOfBirth: transfer.student.dateOfBirth,
          nationality: "Somali",
          guardianName: guardian ? `${guardian.guardian.firstName} ${guardian.guardian.lastName}`.trim() : null,
          relationship: guardian ? guardian.relationship : null,
        },
        enrollment: {
          classLevel: transfer.enrollment.classGroup.level,
          sectionName: transfer.enrollment.section?.name,
          academicYearName: transfer.enrollment.academicYear.name,
          studentNumber: transfer.enrollment.studentNumber,
          rollNumber: transfer.enrollment.rollNumber,
          admissionDate: transfer.enrollment.createdAt,
        },
        destinationSchoolName: transfer.destinationSchoolName,
        reason: transfer.reason,
      });

      // Update tcDownloaded flag without altering student or enrollment status
      if (!transfer.tcDownloaded) {
        await prisma.externalTransfer.update({
          where: { id: transfer.id },
          data: { tcDownloaded: true },
        });
      }

      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "TRANSFER_CERTIFICATE_DOCX_DOWNLOADED",
        entityType: "ExternalTransfer",
        entityId: transfer.id,
        summary: `Transfer certificate DOCX downloaded for student ${transfer.student.firstName} ${transfer.student.fatherName} (Cert #${transfer.certificateNumber}).`,
      });

      const safeFilename = `TC_${transfer.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Length", docxBuffer.length);
      res.send(docxBuffer);
    } catch (error) {
      next(error);
    }
  },
);

// Phase 2: Student Academic Transcript DOCX Download
transfersRouter.get(
  ["/external/:enrollmentId/documents/transcript", "/transfers/external/:enrollmentId/documents/transcript"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const enrollmentId = String(req.params.enrollmentId);

      const transfer = await prisma.externalTransfer.findFirst({
        where: { enrollmentId, schoolId: school.id },
        include: {
          student: {
            include: {
              enrollments: {
                where: { schoolId: school.id },
                include: {
                  school: true,
                  academicYear: true,
                  classGroup: { include: { subjects: { include: { subject: { select: { id: true, name: true } } } } } },
                  section: { include: { subjects: { include: { subject: { select: { id: true, name: true } } } } } },
                  results: {
                    where: { state: "PUBLISHED" },
                    include: { examSubject: { include: { exam: true } } },
                  },
                },
                orderBy: { academicYear: { startDate: "asc" } },
              },
            },
          },
          school: true,
        },
      });

      if (!transfer) {
        throw new HttpError(404, "External transfer record was not found for this enrollment.");
      }

      const fullName = `${transfer.student.firstName} ${transfer.student.fatherName} ${transfer.student.grandfatherName}`.replace(/\s+/g, " ").trim();

      // Gather examinations across all enrollments of this student in the school
      const enrollments = transfer.student.enrollments;
      const allSubjectNames = new Map<string, string>();
      for (const enr of enrollments) {
        if (enr.section) {
          for (const s of enr.section.subjects) allSubjectNames.set(s.subjectId, s.subject.name);
        }
        for (const s of enr.classGroup.subjects) allSubjectNames.set(s.subjectId, s.subject.name);
      }

      const allPublishedMarks: PublishedMark[] = enrollments.flatMap((enr) =>
        enr.results.map((r) => ({
          enrollmentId: enr.id,
          examSubjectId: r.examSubjectId,
          marks: r.isAbsent ? null : r.marks,
          isAbsent: r.isAbsent,
        })),
      );

      const scopes = enrollments.map((enr) => ({
        id: enr.id,
        academicYearId: enr.academicYearId,
        classGroupId: enr.classGroupId,
        sectionId: enr.sectionId,
        sectionSubjectIds: enr.section?.subjects.map((s) => s.subjectId) ?? [],
      }));

      const examinations = await loadExaminations(prisma, scopes, allPublishedMarks, allSubjectNames);

      const yearsData: TranscriptYearData[] = enrollments.map((enr) => {
        const examSummary = examinations.get(enr.id);
        const terms = (["TERM_1", "TERM_2"] as const).map((term) => {
          const tSummary = term === "TERM_1" ? examSummary?.term1 : examSummary?.term2;
          return {
            term,
            label: tSummary?.label ?? (term === "TERM_1" ? "Term 1" : "Term 2"),
            status: tSummary?.status ?? "unavailable",
            average: tSummary?.average ?? null,
            obtained: tSummary?.obtained ?? 0,
            possible: tSummary?.possible ?? 0,
            subjects: (tSummary?.subjects ?? []).map((s) => ({
              subject: s.name,
              maxMarks: s.maxMarks,
              marks: s.marks,
              isAbsent: s.absent,
              pending: s.pending,
              percentage: s.percentage,
            })),
          };
        });

        return {
          academicYearName: enr.academicYear.name,
          classLevel: enr.classGroup.level,
          sectionName: enr.section?.name,
          status: enr.status,
          overallAverage: examSummary?.overall?.average ?? null,
          terms,
        };
      });

      const docxBuffer = await generateStudentTranscriptDocx({
        school: {
          name: school.name,
          code: school.code,
          address: school.address,
        },
        student: {
          fullName,
          permanentId: transfer.student.secondaryPermanentId ?? transfer.student.permanentId,
          gender: transfer.student.gender,
          dateOfBirth: transfer.student.dateOfBirth,
        },
        certificateNumber: transfer.certificateNumber,
        generatedDate: new Date(),
        years: yearsData,
      });

      // Update transcriptDownloaded flag without altering student or enrollment status
      if (!transfer.transcriptDownloaded) {
        await prisma.externalTransfer.update({
          where: { id: transfer.id },
          data: { transcriptDownloaded: true },
        });
      }

      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "STUDENT_TRANSCRIPT_DOCX_DOWNLOADED",
        entityType: "ExternalTransfer",
        entityId: transfer.id,
        summary: `Student academic transcript DOCX downloaded for student ${transfer.student.firstName} ${transfer.student.fatherName} (Cert #${transfer.certificateNumber}).`,
      });

      const safeFilename = `Transcript_${transfer.student.permanentId.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Length", docxBuffer.length);
      res.send(docxBuffer);
    } catch (error) {
      next(error);
    }
  },
);

// Phase 3: Final Confirmation of External Transfer
transfersRouter.post(
  ["/external/:enrollmentId/confirm", "/transfers/external/:enrollmentId/confirm"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const enrollmentId = String(req.params.enrollmentId);

      // Validate review acknowledgment body
      const body = z
        .object({
          documentsReviewed: z.literal(true, {
            errorMap: () => ({ message: "You must explicitly confirm that the Transfer Certificate and Transcript were reviewed." }),
          }),
        })
        .safeParse(req.body);

      if (!body.success) {
        throw new HttpError(400, body.error.issues[0]?.message || "Documents review acknowledgment is required.");
      }

      // Check for existing record
      const existing = await prisma.externalTransfer.findFirst({
        where: { enrollmentId, schoolId: school.id },
        include: {
          student: true,
          enrollment: true,
        },
      });

      if (!existing) {
        throw new HttpError(404, "External transfer record was not found for this enrollment.");
      }

      // Idempotency: if already confirmed, return current state without mutating
      if (existing.status === "CONFIRMED") {
        return res.json({
          message: "External transfer is already confirmed.",
          transfer: existing,
          alreadyConfirmed: true,
        });
      }

      if (existing.status === "CANCELLED") {
        throw new HttpError(400, "A cancelled external transfer cannot be confirmed. Create a new draft first.");
      }

      if (existing.status !== "PENDING") {
        throw new HttpError(400, `Cannot confirm transfer with status ${existing.status}.`);
      }

      // Validate document download indicators
      if (!existing.tcDownloaded || !existing.transcriptDownloaded) {
        throw new HttpError(
          400,
          "Both the Transfer Certificate and the Academic Transcript must be generated and downloaded before final confirmation.",
        );
      }

      // Validate enrollment and student consistency
      if (existing.enrollment.status !== "ACTIVE") {
        throw new HttpError(400, "The student enrollment is not active.");
      }

      if (existing.student.status !== "ACTIVE") {
        throw new HttpError(400, "The student record is not active.");
      }

      // Check conflicting internal transfer requests
      const conflictingInternal = await prisma.transferRequest.findFirst({
        where: {
          fromEnrollmentId: enrollmentId,
          status: { in: ["PENDING", "WAITING_FOR_SECTION"] },
        },
      });

      if (conflictingInternal) {
        throw new HttpError(409, "A pending internal transfer request exists for this student. Resolve or cancel it first.");
      }

      // Atomic transition with concurrency protection
      const confirmedAt = new Date();
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency check: conditionally update ExternalTransfer only if still PENDING
        const updatedTransferBatch = await tx.externalTransfer.updateMany({
          where: {
            id: existing.id,
            status: "PENDING",
          },
          data: {
            status: "CONFIRMED",
            confirmedByUserId: req.authUser!.id,
            confirmedAt,
          },
        });

        if (updatedTransferBatch.count === 0) {
          // Another concurrent request confirmed or modified it
          const fresh = await tx.externalTransfer.findUnique({ where: { id: existing.id } });
          if (fresh?.status === "CONFIRMED") {
            return { transfer: fresh, alreadyConfirmed: true };
          }
          throw new HttpError(409, "Transfer state was changed concurrently. Please refresh.");
        }

        // Conditionally update Enrollment status to TRANSFERRED
        const updatedEnrollmentBatch = await tx.enrollment.updateMany({
          where: {
            id: existing.enrollmentId,
            status: "ACTIVE",
          },
          data: {
            status: "TRANSFERRED",
          },
        });

        if (updatedEnrollmentBatch.count === 0) {
          throw new HttpError(409, "Enrollment was modified concurrently or is no longer active.");
        }

        // Conditionally update Student status to WITHDRAWN
        const updatedStudentBatch = await tx.student.updateMany({
          where: {
            id: existing.studentId,
            status: "ACTIVE",
          },
          data: {
            status: "WITHDRAWN",
          },
        });

        if (updatedStudentBatch.count === 0) {
          throw new HttpError(409, "Student record was modified concurrently or is no longer active.");
        }

        const confirmedTransfer = await tx.externalTransfer.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            student: true,
            enrollment: {
              include: {
                classGroup: true,
                section: true,
                academicYear: true,
              },
            },
            confirmedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        return { transfer: confirmedTransfer, alreadyConfirmed: false };
      });

      if (!result.alreadyConfirmed) {
        await writeAudit({
          schoolId: school.id,
          actorUserId: req.authUser!.id,
          action: "EXTERNAL_TRANSFER_CONFIRMED",
          entityType: "ExternalTransfer",
          entityId: result.transfer.id,
          summary: `External transfer confirmed for student ${existing.student.firstName} ${existing.student.fatherName} (Cert #${result.transfer.certificateNumber}). Student status set to WITHDRAWN, enrollment set to TRANSFERRED.`,
        });
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// Phase 3/4 Support: List External Transfers for the school
transfersRouter.get(
  ["/external", "/transfers/external"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const statusParam = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
      const skip = (page - 1) * limit;

      const where: Prisma.ExternalTransferWhereInput = {
        schoolId: school.id,
        ...(statusParam && ["PENDING", "CONFIRMED", "CANCELLED", "REVERSED"].includes(statusParam)
          ? { status: statusParam as any }
          : {}),
        ...(search
          ? {
            OR: [
              { certificateNumber: { contains: search, mode: "insensitive" } },
              { destinationSchoolName: { contains: search, mode: "insensitive" } },
              { student: { firstName: { contains: search, mode: "insensitive" } } },
              { student: { fatherName: { contains: search, mode: "insensitive" } } },
              { student: { permanentId: { contains: search, mode: "insensitive" } } },
            ],
          }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.externalTransfer.count({ where }),
        prisma.externalTransfer.findMany({
          where,
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                fatherName: true,
                grandfatherName: true,
                permanentId: true,
                gender: true,
                status: true,
              },
            },
            enrollment: {
              select: {
                id: true,
                status: true,
                rollNumber: true,
                classGroup: { select: { level: true } },
                section: { select: { name: true } },
                academicYear: { select: { name: true } },
              },
            },
            confirmedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            reversedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      res.json({
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Separate Erroneous Transfer Correction / Reversal Workflow
// (Distinct from genuine student return/re-enrollment: only for reversing an erroneous confirmed external transfer)
transfersRouter.post(
  ["/external/:enrollmentId/reverse", "/transfers/external/:enrollmentId/reverse"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const enrollmentId = String(req.params.enrollmentId);
      const body = z
        .object({
          reason: z.string().trim().min(3, "A reason is required to reverse an erroneous transfer.").max(500),
        })
        .safeParse(req.body ?? {});

      if (!body.success) {
        throw new HttpError(400, body.error.issues[0]?.message || "A valid reversal reason is required.");
      }

      const existing = await prisma.externalTransfer.findFirst({
        where: {
          enrollmentId,
          schoolId: school.id,
          student: { organizationId: school.organizationId },
        },
        include: {
          student: true,
          enrollment: true,
        },
      });

      if (!existing) {
        throw new HttpError(404, "External transfer record was not found for this enrollment.");
      }

      if (existing.status !== "CONFIRMED") {
        throw new HttpError(400, `Only a CONFIRMED external transfer can be reversed (current status: ${existing.status}).`);
      }

      // Ensure the student has not already re-enrolled or transferred into another enrollment
      const otherActiveOrLaterEnrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: existing.studentId,
          id: { not: existing.enrollmentId },
          OR: [
            { status: "ACTIVE" },
            { createdAt: { gt: existing.enrollment.createdAt } },
          ],
        },
      });

      if (otherActiveOrLaterEnrollment) {
        throw new HttpError(
          409,
          "Cannot reverse this transfer because the student already has a subsequent or active enrollment. Use the Return / Re-enroll workflow instead.",
        );
      }

      const reversedAt = new Date();
      const reversed = await prisma.$transaction(async (tx) => {
        const updatedBatch = await tx.externalTransfer.updateMany({
          where: { id: existing.id, status: "CONFIRMED" },
          data: {
            status: "REVERSED",
            reversedByUserId: req.authUser!.id,
            reversedAt,
            reversalReason: body.data.reason,
          },
        });

        if (updatedBatch.count === 0) {
          throw new HttpError(409, "External transfer status changed concurrently.");
        }

        await tx.enrollment.update({
          where: { id: existing.enrollmentId },
          data: { status: "ACTIVE" },
        });

        await tx.student.update({
          where: { id: existing.studentId },
          data: { status: "ACTIVE" },
        });

        const portalUsers = await tx.user.findMany({
          where: {
            role: "STUDENT",
            personKey: {
              in: [
                existing.student.permanentId,
                ...(existing.student.secondaryPermanentId ? [existing.student.secondaryPermanentId] : []),
              ],
            },
          },
        });
        for (const pu of portalUsers) {
          await tx.user.update({
            where: { id: pu.id },
            data: { status: pu.passwordHash ? "ACTIVE" : "INVITED" },
          });
        }

        return tx.externalTransfer.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            student: true,
            enrollment: {
              include: {
                classGroup: true,
                section: true,
                academicYear: true,
              },
            },
            confirmedByUser: { select: { id: true, firstName: true, lastName: true } },
            reversedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
        });
      });

      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "EXTERNAL_TRANSFER_REVERSED",
        entityType: "ExternalTransfer",
        entityId: reversed.id,
        summary: `Reversed erroneous external transfer (Cert #${reversed.certificateNumber}) for student ${existing.student.permanentId} (${existing.student.firstName} ${existing.student.fatherName}). Original enrollment ${existing.enrollmentId} restored to ACTIVE. Reason: ${body.data.reason}`,
      });

      res.json({
        message: "Erroneous external transfer reversed. Original enrollment restored to ACTIVE.",
        transfer: reversed,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Organization-Wide Existing Student Lookup (Find Existing Student Records across Authorized Organization)
transfersRouter.get(
  ["/org-students/search", "/transfers/lookup-students", "/students/org-lookup"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const school = await schoolOfAdmin(req.authUser!.id);
      const q = String(req.query.q ?? req.query.search ?? "").trim();
      const statusFilter = String(req.query.status ?? "").trim().toUpperCase();
      const isEligibleOnly = statusFilter === "ELIGIBLE_FOR_RETURN";

      let emailMatchedPersonKeys: string[] = [];
      if (q && q.includes("@")) {
        const matchedUsers = await prisma.user.findMany({
          where: { role: "STUDENT", email: { contains: q, mode: "insensitive" } },
          select: { personKey: true },
        });
        emailMatchedPersonKeys = matchedUsers.map((u) => u.personKey).filter(Boolean) as string[];
      }

      const where: Prisma.StudentWhereInput = {
        organizationId: school.organizationId,
        ...(statusFilter === "WITHDRAWN"
          ? { status: "WITHDRAWN" }
          : statusFilter === "ACTIVE"
            ? { status: "ACTIVE" }
            : statusFilter === "ALUMNI"
              ? { status: "ALUMNI" }
              : isEligibleOnly
                ? {
                  status: { notIn: ["ALUMNI", "ACTIVE"] },
                  alumniRecords: { none: {} },
                  enrollments: {
                    some: { status: { in: ["TRANSFERRED", "RETAINED", "PROMOTED"] } },
                    none: { status: { in: ["ACTIVE", "ALUMNI"] } },
                  },
                }
                : {}),
        ...(q
          ? {
            OR: [
              { permanentId: { contains: q, mode: "insensitive" } },
              { secondaryPermanentId: { contains: q, mode: "insensitive" } },
              { nationalId: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { firstName: { contains: q, mode: "insensitive" } },
              { fatherName: { contains: q, mode: "insensitive" } },
              { grandfatherName: { contains: q, mode: "insensitive" } },
              { transferCertificateNo: { contains: q, mode: "insensitive" } },
              { externalTransfers: { some: { certificateNumber: { contains: q, mode: "insensitive" } } } },
              { enrollments: { some: { academicYear: { name: { contains: q, mode: "insensitive" } } } } },
              { leavingYear: { contains: q, mode: "insensitive" } },
              { guardians: { some: { guardian: { email: { contains: q, mode: "insensitive" } } } } },
              ...(emailMatchedPersonKeys.length > 0
                ? [
                  { permanentId: { in: emailMatchedPersonKeys } },
                  { secondaryPermanentId: { in: emailMatchedPersonKeys } },
                ]
                : []),
            ],
          }
          : {}),
      };

      const students = await prisma.student.findMany({
        where,
        include: {
          alumniRecords: { select: { id: true, fromLevel: true, createdAt: true } },
          enrollments: {
            include: {
              school: { select: { id: true, name: true, code: true, type: true } },
              academicYear: { select: { id: true, name: true, startDate: true, isCurrent: true } },
              classGroup: { select: { id: true, level: true } },
              section: { select: { id: true, name: true } },
              externalTransfer: {
                select: {
                  id: true,
                  certificateNumber: true,
                  destinationSchoolName: true,
                  reason: true,
                  status: true,
                  confirmedAt: true,
                  reversedAt: true,
                  reversalReason: true,
                },
              },
            },
            orderBy: [{ academicYear: { startDate: "desc" } }, { createdAt: "desc" }],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      });

      const items = students
        .map((student) => {
          const activeEnrollment = student.enrollments.find((e) => e.status === "ACTIVE") ?? null;
          const previousEnrollments = student.enrollments.filter((e) => e.id !== activeEnrollment?.id);
          const isPrimaryAlumni =
            student.status === "ALUMNI" ||
            student.alumniRecords.length > 0 ||
            student.enrollments.some((e) => e.status === "ALUMNI" || e.classGroup?.level === "CLASS_8");
          const eligibleForReturn =
            !activeEnrollment && !isPrimaryAlumni && student.enrollments.length > 0 && student.status !== "ALUMNI";

          return {
            id: student.id,
            organizationId: student.organizationId,
            permanentId: student.permanentId,
            secondaryPermanentId: student.secondaryPermanentId,
            firstName: student.firstName,
            fatherName: student.fatherName,
            grandfatherName: student.grandfatherName,
            fullName: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim(),
            gender: student.gender,
            dateOfBirth: student.dateOfBirth,
            phone: student.phone,
            nationalId: student.nationalId,
            status: student.status,
            isPrimaryAlumni,
            eligibleForReturn,
            currentEnrollment: activeEnrollment
              ? {
                id: activeEnrollment.id,
                schoolId: activeEnrollment.school.id,
                schoolName: activeEnrollment.school.name,
                schoolCode: activeEnrollment.school.code,
                academicYearId: activeEnrollment.academicYear.id,
                academicYearName: activeEnrollment.academicYear.name,
                classGroupId: activeEnrollment.classGroup.id,
                level: activeEnrollment.classGroup.level,
                levelLabel: levelLabel(activeEnrollment.classGroup.level),
                sectionId: activeEnrollment.section.id,
                sectionName: activeEnrollment.section.name,
                rollNumber: activeEnrollment.rollNumber,
                studentNumber: activeEnrollment.studentNumber,
                status: activeEnrollment.status,
                admittedOn: activeEnrollment.admittedOn,
              }
              : null,
            previousEnrollments: previousEnrollments.map((enr) => ({
              id: enr.id,
              schoolId: enr.school.id,
              schoolName: enr.school.name,
              schoolCode: enr.school.code,
              academicYearId: enr.academicYear.id,
              academicYearName: enr.academicYear.name,
              classGroupId: enr.classGroup.id,
              level: enr.classGroup.level,
              levelLabel: levelLabel(enr.classGroup.level),
              sectionId: enr.section.id,
              sectionName: enr.section.name,
              rollNumber: enr.rollNumber,
              studentNumber: enr.studentNumber,
              status: enr.status,
              admittedOn: enr.admittedOn,
              externalTransfer: enr.externalTransfer,
            })),
          };
        }).filter((stu) => (isEligibleOnly ? stu.eligibleForReturn : true));

      res.json({ items });
    } catch (error) {
      next(error);
    }
  },
);

// Placement structure for any destination school within the same organization
transfersRouter.get(
  ["/org-schools/:schoolId/placement", "/transfers/school-placement/:schoolId"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const adminSchool = await schoolOfAdmin(req.authUser!.id);
      const targetSchoolId = String(req.params.schoolId);
      const targetSchool = await prisma.school.findFirst({
        where: { id: targetSchoolId, organizationId: adminSchool.organizationId, isActive: true },
      });
      if (!targetSchool) {
        throw new HttpError(404, "Destination school was not found in your organization.");
      }
      const years = await prisma.academicYear.findMany({
        where: { schoolId: targetSchool.id },
        orderBy: { startDate: "desc" },
        include: {
          classes: {
            orderBy: { level: "asc" },
            include: {
              sections: { orderBy: { name: "asc" } },
            },
          },
        },
      });
      res.json({
        school: {
          id: targetSchool.id,
          name: targetSchool.name,
          code: targetSchool.code,
          type: targetSchool.type,
        },
        years: years.map((y) => ({
          id: y.id,
          name: y.name,
          isCurrent: y.isCurrent,
          classes: y.classes.map((c) => ({
            id: c.id,
            level: c.level,
            label: levelLabel(c.level),
            sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Student Return and Re-enrollment Workflow (Same School or Any School in Same Organization)
const externalExamMarkItemSchema = z.object({
  originSchool: z.string().trim().max(100).optional(),
  subject: z.string().trim().min(1).max(100),
  marksObtained: z.number().min(0).max(1000),
  maxMarks: z.number().min(1).max(1000).default(100),
  gradeOrClass: z.string().trim().max(20).optional(),
  examYear: z.string().trim().max(20).optional(),
  isVerified: z.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
});

const reenrollSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  destinationSchoolId: z.string().min(1).optional(),
  academicYearId: z.string().min(1, "Destination academic year is required."),
  classGroupId: z.string().min(1).optional(),
  sectionId: z.string().min(1, "Destination section is required."),
  reason: z.string().trim().min(3, "Reason for return is required (at least 3 characters).").max(500),
  autoApprove: z.boolean().optional(),
  externalExamMarks: z.array(externalExamMarkItemSchema).optional(),
});

transfersRouter.post(
  ["/reenrollments", "/transfers/reenroll", "/external/reenroll"],
  requireAuth,
  requireRole("SCHOOL_ADMIN"),
  async (req, res, next) => {
    try {
      const adminSchool = await schoolOfAdmin(req.authUser!.id);
      const body = reenrollSchema.safeParse(req.body ?? {});
      if (!body.success) {
        throw new HttpError(400, body.error.issues[0]?.message || "Destination school, academic year, class, section, and reason for return are required.");
      }

      const targetSchoolId = body.data.destinationSchoolId || adminSchool.id;
      const targetSchool = await prisma.school.findFirst({
        where: { id: targetSchoolId, isActive: true },
      });

      if (!targetSchool || targetSchool.organizationId !== adminSchool.organizationId) {
        throw new HttpError(403, "Destination school must belong to your organization.");
      }

      const student = await prisma.student.findUnique({
        where: { id: body.data.studentId },
        include: {
          enrollments: {
            include: {
              school: true,
              academicYear: true,
              classGroup: true,
              section: true,
            },
            orderBy: [{ academicYear: { startDate: "desc" } }, { createdAt: "desc" }],
          },
        },
      });

      if (!student || student.organizationId !== adminSchool.organizationId) {
        throw new HttpError(403, "Student does not belong to your organization.");
      }

      const activeEnrollment = student.enrollments.find((e) => e.status === "ACTIVE");
      if (activeEnrollment) {
        throw new HttpError(409, "This student already has an active enrollment. Use an internal transfer instead of re-enrollment.");
      }

      // Alumni Rules: Class 8 graduates are alumni and must not be reactivated via ordinary return
      const hasAlumniRecord = await prisma.alumniRecord.findFirst({
        where: { studentId: student.id, fromLevel: "CLASS_8" },
      });
      const hasAlumniEnrollment = student.enrollments.some(
        (e) => e.status === "ALUMNI" && e.classGroup.level === "CLASS_8",
      );
      if (student.status === "ALUMNI" || hasAlumniRecord || hasAlumniEnrollment) {
        throw new HttpError(
          400,
          "Graduated Class 8 Alumni cannot be reactivated through the ordinary return workflow. Class 8 graduates must use Form 1 Secondary Admission if the school offers secondary education.",
        );
      }

      const lastEnrollment = student.enrollments[0];
      if (!lastEnrollment) {
        throw new HttpError(400, "No previous enrollment history found for this student.");
      }

      const conflictingRequest = await prisma.transferRequest.findFirst({
        where: {
          studentId: student.id,
          status: { in: ["PENDING", "WAITING_FOR_SECTION"] },
        },
      });

      if (conflictingRequest) {
        throw new HttpError(409, "A pending transfer or return request already exists for this student.");
      }

      const section = await prisma.section.findFirst({
        where: {
          id: body.data.sectionId,
          ...(body.data.classGroupId ? { classGroupId: body.data.classGroupId } : {}),
          classGroup: {
            schoolId: targetSchool.id,
            academicYearId: body.data.academicYearId,
          },
        },
        include: { classGroup: { include: { academicYear: true } } },
      });

      if (!section) {
        throw new HttpError(400, "Selected academic year, class, and section do not belong to the destination school.");
      }

      if (!schoolSupportsLevel(targetSchool.type, section.classGroup.level)) {
        throw new HttpError(400, "Destination school does not support this class or form level.");
      }

      // Determine whether this return should be approved immediately or queued as PENDING:
      // Only approve immediately when the admin belongs to the destination school and autoApprove !== false.
      const shouldApproveNow = targetSchool.id === adminSchool.id && body.data.autoApprove !== false;

      if (!shouldApproveNow) {
        // Initiate return request only; Student master status stays WITHDRAWN until approved!
        const pendingRequest = await prisma.transferRequest.create({
          data: {
            studentId: student.id,
            fromSchoolId: lastEnrollment.schoolId,
            toSchoolId: targetSchool.id,
            fromEnrollmentId: lastEnrollment.id,
            toAcademicYearId: body.data.academicYearId,
            toSectionId: section.id,
            status: "PENDING",
            note: body.data.reason,
            requestedByUserId: req.authUser!.id,
          },
        });

        await writeAudit({
          schoolId: adminSchool.id,
          actorUserId: req.authUser!.id,
          action: "STUDENT_RETURN_INITIATED",
          entityType: "TransferRequest",
          entityId: pendingRequest.id,
          summary: `Initiated student return request for ${student.permanentId} from ${lastEnrollment.school.name} (enrollment ${lastEnrollment.id}) to ${targetSchool.name} (${section.classGroup.academicYear.name}, ${levelLabel(section.classGroup.level)} Sec ${section.name}). Reason: ${body.data.reason}`,
        });

        res.status(201).json({
          status: "PENDING",
          request: pendingRequest,
          studentStatus: student.status,
          enrollment: null,
        });
        return;
      }

      // Atomic approval + new enrollment creation + student status activation
      const decidedAt = new Date();
      const completed = await prisma.$transaction(async (tx) => {
        const currentActive = await tx.enrollment.findFirst({
          where: { studentId: student.id, status: "ACTIVE" },
        });
        if (currentActive) {
          throw new HttpError(409, "Student already has an active enrollment.");
        }

        const studentNumber = await nextStudentNumber(tx, targetSchool.id);
        const rollNumber = await nextRollNumber(tx, section.id);

        // Create a NEW enrollment rather than overwriting historical enrollment records
        const newEnrollment = await tx.enrollment.create({
          data: {
            studentId: student.id,
            schoolId: targetSchool.id,
            academicYearId: body.data.academicYearId,
            classGroupId: section.classGroupId,
            sectionId: section.id,
            studentNumber,
            rollNumber,
            status: "ACTIVE",
          },
          include: {
            school: true,
            academicYear: true,
            classGroup: true,
            section: true,
          },
        });

        // Record any verified or unverified external examination marks obtained while away
        if (body.data.externalExamMarks && body.data.externalExamMarks.length > 0) {
          for (const mark of body.data.externalExamMarks) {
            await tx.externalExamRecord.create({
              data: {
                studentId: student.id,
                enrollmentId: newEnrollment.id,
                originSchool: mark.originSchool || null,
                subject: mark.subject,
                marksObtained: mark.marksObtained,
                maxMarks: mark.maxMarks,
                gradeOrClass: mark.gradeOrClass || null,
                examYear: mark.examYear || null,
                isVerified: Boolean(mark.isVerified),
                verifiedByUserId: mark.isVerified ? req.authUser!.id : null,
                verifiedAt: mark.isVerified ? new Date() : null,
                notes: mark.notes || null,
              },
            });
          }
        }

        // Set Student master status to ACTIVE only after enrollment creation
        const updatedStudent = await tx.student.update({
          where: { id: student.id },
          data: {
            status: "ACTIVE",
            previousSchoolId: lastEnrollment.schoolId !== targetSchool.id ? lastEnrollment.schoolId : student.previousSchoolId,
            previousClass: levelLabel(lastEnrollment.classGroup.level),
            leavingYear: lastEnrollment.academicYear.name,
          },
        });

        // Re-enable Student Portal User account if one exists
        const portalUsers = await tx.user.findMany({
          where: {
            role: "STUDENT",
            personKey: {
              in: [
                student.permanentId,
                ...(student.secondaryPermanentId ? [student.secondaryPermanentId] : []),
              ],
            },
          },
        });
        for (const pu of portalUsers) {
          await tx.user.update({
            where: { id: pu.id },
            data: {
              schoolId: targetSchool.id,
              status: pu.passwordHash ? "ACTIVE" : "INVITED",
            },
          });
        }

        const requestRecord = await tx.transferRequest.create({
          data: {
            studentId: student.id,
            fromSchoolId: lastEnrollment.schoolId,
            toSchoolId: targetSchool.id,
            fromEnrollmentId: lastEnrollment.id,
            newEnrollmentId: newEnrollment.id,
            toAcademicYearId: body.data.academicYearId,
            toSectionId: section.id,
            status: "COMPLETED",
            note: body.data.reason,
            requestedByUserId: req.authUser!.id,
            decidedByUserId: req.authUser!.id,
            decidedAt,
          },
        });

        return {
          enrollment: newEnrollment,
          student: updatedStudent,
          request: requestRecord,
          previousEnrollmentId: lastEnrollment.id,
        };
      });

      await writeAudit({
        schoolId: targetSchool.id,
        actorUserId: req.authUser!.id,
        action: "STUDENT_REENROLLED",
        entityType: "Enrollment",
        entityId: completed.enrollment.id,
        summary: `Re-enrolled returning student ${student.permanentId} (${student.firstName} ${student.fatherName}) into ${targetSchool.name} · ${section.classGroup.academicYear.name} · ${levelLabel(section.classGroup.level)} Section ${section.name} (initiatingAdmin=${req.authUser!.id}, approvingAdmin=${req.authUser!.id}, sourceSchool=${lastEnrollment.schoolId}, destinationSchool=${targetSchool.id}, previousEnrollment=${lastEnrollment.id}, newEnrollment=${completed.enrollment.id}, reason=${body.data.reason}).`,
      });

      res.status(201).json({
        status: "COMPLETED",
        enrollment: completed.enrollment,
        previousEnrollmentId: completed.previousEnrollmentId,
        request: completed.request,
        studentStatus: completed.student.status,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        next(new HttpError(409, "A conflict occurred with student number or roll number. Please try again."));
        return;
      }
      next(error);
    }
  },
);




