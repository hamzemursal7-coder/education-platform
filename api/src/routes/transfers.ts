import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
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
      const toRollNumber = await nextValue(tx, `roll:${toSection.id}`);
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
        const toRollNumber = await nextValue(tx, `roll:${toSection.id}`);
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
      throw new HttpError(400, "Alumni are transferred from Alumni. Choose the year and section there, then Transfer alumni student.");
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
      const form1 = enrollment?.status === "ALUMNI" && enrollment.classGroup.level === "CLASS_8";
      return {
        ...row,
        permanentId: student?.permanentId ?? "",
        secondaryPermanentId: student?.secondaryPermanentId ?? null,
        name: student ? `${student.firstName} ${student.fatherName} ${student.grandfatherName}` : "",
        gender: student?.gender === "MALE" ? "Male" : student?.gender === "FEMALE" ? "Female" : "",
        fromSchool: schools.find((item) => item.id === row.fromSchoolId)?.name ?? "",
        toSchool: schools.find((item) => item.id === row.toSchoolId)?.name ?? "",
        incoming: row.toSchoolId === school.id,
        kind: form1 ? "FORM_1" : "SAME_LEVEL",
        sourceYear: enrollment?.academicYear.name ?? "",
        sourceLevel: enrollment ? levelLabel(enrollment.classGroup.level) : "",
        sourceLevelCode: enrollment?.classGroup.level ?? "",
        sourceSection: enrollment?.section.name ?? "",
        destinationYear: destination?.classGroup.academicYear.name ?? "",
        destinationLevel: destination ? levelLabel(destination.classGroup.level) : "",
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
            toAcademicYearId: body.data.toAcademicYearId,
            toSectionId: formSection.id,
          },
        });
        return enrolled;
      });
      res.json({ ...created, sectionName: formSection.name, yearName: toYear.name });
      return;
    }
    if (!body.data.toAcademicYearId || !body.data.toSectionId) {
      const waiting = await prisma.transferRequest.update({
        where: { id: request.id },
        data: {
          status: "WAITING_FOR_SECTION",
          decidedByUserId: req.authUser!.id,
          toAcademicYearId: null,
          toSectionId: null,
        },
      });
      res.json(waiting);
      return;
    }
    const source = await prisma.enrollment.findFirst({
      where: { id: request.fromEnrollmentId, status: "ACTIVE" },
      include: { academicYear: true, classGroup: true },
    });
    if (!source) throw new HttpError(409, "Source enrollment is no longer active.");
    const section = await prisma.section.findFirst({
      where: {
        id: body.data.toSectionId,
        classGroup: {
          schoolId: school.id,
          academicYearId: body.data.toAcademicYearId,
          level: source.classGroup.level,
          academicYear: { name: source.academicYear.name },
        },
      },
      include: { classGroup: true },
    });
    if (!section) {
      throw new HttpError(400, "Choose a section with the same academic year and class/form level.");
    }
    const completed = await prisma.$transaction(async (tx) => {
      const clash = await tx.enrollment.findUnique({
        where: { studentId_academicYearId: { studentId: request.studentId, academicYearId: body.data.toAcademicYearId! } },
      });
      if (clash) throw new HttpError(409, "This student already has an enrollment in the destination year.");
      const studentNumber = String(await nextValue(tx, `student-number:${school.id}`)).padStart(5, "0");
      const rollNumber = await nextValue(tx, `roll:${section.id}`);
      await tx.enrollment.update({ where: { id: source.id }, data: { status: "TRANSFERRED" } });
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: request.studentId,
          schoolId: school.id,
          academicYearId: body.data.toAcademicYearId!,
          classGroupId: section.classGroupId,
          sectionId: section.id,
          studentNumber,
          rollNumber,
          status: "ACTIVE",
        },
      });
      await tx.student.update({ where: { id: request.studentId }, data: { status: "ACTIVE" } });
      await tx.transferRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          decidedByUserId: req.authUser!.id,
          toAcademicYearId: body.data.toAcademicYearId,
          toSectionId: section.id,
        },
      });
      return { enrollment, rollNumber };
    });
    res.json(completed);
  } catch (error) {
    next(error);
  }
});
