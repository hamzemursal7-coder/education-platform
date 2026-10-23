import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { issueSetPasswordLink, syncLoginEmail } from "../lib/accountLink.js";
import { writeAudit } from "../lib/audit.js";
import { absoluteStoragePath } from "../lib/files.js";
import { loadExaminations, type PublishedMark } from "../lib/examAverages.js";
import { importStudentRows } from "../lib/studentImport.js";
import { readStudentSheet, writeStudentWorkbook } from "../lib/studentSheet.js";
import { levelLabel } from "../lib/levels.js";
import { assertPhotoSize, detectImage, guardianPhotoPath, storeStudentPhoto, studentPhotoPath } from "../lib/photos.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const guardianInput = z.object({
  id: z.string().optional(),
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN"]).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  nationalId: z.string().trim().optional().or(z.literal("")),
});

const studentSchema = z.object({
  firstName: z.string().trim().min(2),
  fatherName: z.string().trim().min(2),
  grandfatherName: z.string().trim().min(2),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.string().date(),
  phone: z.string().trim().optional().or(z.literal("")),
  nationalId: z.string().trim().optional().or(z.literal("")),
  academicYearId: z.string().min(1),
  sectionId: z.string().min(1),
  guardian: guardianInput.optional().nullable(),
  previousSchoolId: z.string().trim().optional().or(z.literal("")),
  previousClass: z.string().trim().max(40).optional().or(z.literal("")),
  leavingYear: z.string().trim().max(20).optional().or(z.literal("")),
  transferCertificateNo: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const relationshipSchema = z.object({
  relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN"]),
});

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
  const rows = await tx.enrollment.findMany({ where: { schoolId }, select: { studentNumber: true } });
  const highest = rows.reduce((max, row) => (/^\d+$/.test(row.studentNumber) ? Math.max(max, Number(row.studentNumber)) : max), 0);
  return String(highest + 1).padStart(5, "0");
}

async function nextRollNumber(tx: Prisma.TransactionClient, sectionId: string) {
  const highest = await tx.enrollment.aggregate({ where: { sectionId }, _max: { rollNumber: true } });
  return (highest._max.rollNumber ?? 0) + 1;
}

export const studentsRouter = Router();
studentsRouter.use("/students", requireAuth, requireRole("SCHOOL_ADMIN"));
studentsRouter.use("/placement", requireAuth, requireRole("SCHOOL_ADMIN"));
studentsRouter.use("/guardians", requireAuth, requireRole("SCHOOL_ADMIN"));
studentsRouter.use("/previous-schools", requireAuth, requireRole("SCHOOL_ADMIN"));

studentsRouter.get("/previous-schools", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const schools = await prisma.school.findMany({
      where: { organizationId: school.organizationId, NOT: { id: school.id } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    res.json(schools);
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/placement", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const years = await prisma.academicYear.findMany({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
      include: {
        classes: {
          include: {
            sections: { orderBy: { name: "asc" }, include: { subjects: { include: { subject: true } } } },
            subjects: { include: { subject: true } },
          },
          orderBy: { level: "asc" },
        },
      },
    });
    res.json(
      years.map((year) => ({
        id: year.id,
        name: year.name,
        isCurrent: year.isCurrent,
        classes: year.classes.map((item) => ({
          id: item.id,
          level: item.level,
          label: levelLabel(item.level),
          sections: item.sections.map((section) => ({
            id: section.id,
            name: section.name,
            subjects: section.subjects.map((row) => ({ id: row.subject.id, name: row.subject.name, code: row.subject.code })),
          })),
          subjects: item.subjects.map((row) => ({ id: row.subject.id, name: row.subject.name, code: row.subject.code })),
        })),
      })),
    );
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/guardians", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const guardians = await prisma.guardian.findMany({
      where: {
        organizationId: school.organizationId,
        OR: [
          { publicId: { contains: q, mode: "insensitive" } },
          { nationalId: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { user: { select: { status: true, email: true } } },
      take: 8,
    });
    res.json(guardians.map((guardian) => ({
      id: guardian.id,
      publicId: guardian.publicId,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      phone: guardian.phone,
      email: guardian.email ?? guardian.user?.email ?? null,
      portalStatus: guardian.user?.status ?? "NONE",
      photoUrl: guardianPhotoPath(guardian.id, guardian.photoUrl, guardian.photoStorageKey),
    })));
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/students", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const academicYearId = String(req.query.academicYearId ?? "").trim() || undefined;
    const sectionId = String(req.query.sectionId ?? "").trim() || undefined;
    const statusQuery = String(req.query.status ?? "").trim();
    const enrollmentFilter: Prisma.EnrollmentWhereInput = {
      schoolId: school.id,
      ...(academicYearId ? { academicYearId } : {}),
      ...(sectionId ? { sectionId } : {}),
      status: statusQuery === "ACTIVE"
        ? "ACTIVE"
        : academicYearId
          ? { in: ["ACTIVE", "TRANSFERRED", "RETAINED"] }
          : { in: ["ACTIVE", "TRANSFERRED"] },
    };
    const students = await prisma.student.findMany({
      where: { enrollments: { some: enrollmentFilter } },
      orderBy: { createdAt: "desc" },
      include: {
        guardians: { include: { guardian: true }, take: 1 },
        enrollments: {
          where: enrollmentFilter,
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            academicYear: true,
            classGroup: true,
            section: { include: { subjects: { include: { subject: true } } } },
            fees: { select: { amount: true, paidAmount: true, status: true } },
          },
        },
      },
    });
    const repeated = academicYearId && students.length
      ? await prisma.promotionDecision.findMany({
          where: {
            studentId: { in: students.map((student) => student.id) },
            outcome: "REPEATED",
            batch: { schoolId: school.id, toYearId: academicYearId },
          },
          select: { studentId: true, toLevel: true },
        })
      : [];
    const repeatedIntoYear = new Set(repeated.map((row) => `${row.studentId}:${row.toLevel ?? ""}`));
    const rows = students.map((student) => {
      const enrollment = student.enrollments[0];
      const fees = enrollment?.fees ?? [];
      const feeTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);
      const feePaid = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
      const feeBalance = Math.max(0, feeTotal - feePaid);
      const guardian = student.guardians[0]?.guardian;
      const levelCode = enrollment?.classGroup.level ?? "";
      const listStatus = student.status === "WITHDRAWN" || student.status === "ON_LEAVE"
        ? "INACTIVE"
        : enrollment?.status === "TRANSFERRED"
          ? "TRANSFERRED"
          : enrollment?.status === "RETAINED" || repeatedIntoYear.has(`${student.id}:${levelCode}`)
            ? "RETAINED"
            : "ACTIVE";
      return {
        id: student.id,
        permanentId: student.permanentId,
        name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        status: student.status,
        enrollmentId: enrollment?.id ?? null,
        academicYearId: enrollment?.academicYearId ?? null,
        classGroupId: enrollment?.classGroupId ?? null,
        sectionId: enrollment?.sectionId ?? null,
        studentNumber: enrollment?.studentNumber ?? null,
        photoUrl: studentPhotoPath(student.id, student.photoUrl, student.photoStorageKey),
        level: enrollment ? levelLabel(enrollment.classGroup.level) : "",
        levelCode,
        section: enrollment?.section.name ?? "",
        year: enrollment?.academicYear.name ?? "",
        rollNumber: enrollment?.rollNumber ?? null,
        enrollmentStatus: enrollment?.status ?? "ACTIVE",
        listStatus,
        parent: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
        parentEmail: guardian?.email ?? null,
        parentPhone: guardian?.phone ?? null,
        feeTotal,
        feePaid,
        feeBalance,
        feeStatus: feeBalance <= 0 && feeTotal > 0 ? "PAID" : feePaid > 0 ? "PARTIAL" : fees.length ? "UNPAID" : "NONE",
      };
    });
    res.json({
      total: rows.length,
      male: rows.filter((row) => row.gender === "MALE").length,
      female: rows.filter((row) => row.gender === "FEMALE").length,
      students: rows,
    });
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/students/export", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const academicYearId = String(req.query.academicYearId ?? "").trim();
    if (!academicYearId) throw new HttpError(400, "Choose an academic year before exporting.");
    const classGroupId = String(req.query.classGroupId ?? "").trim();
    const sectionId = String(req.query.sectionId ?? "").trim();
    const enrollmentWhere: Prisma.EnrollmentWhereInput = {
      schoolId: school.id,
      academicYearId,
      ...(classGroupId ? { classGroupId } : {}),
      ...(sectionId ? { sectionId } : {}),
      status: { in: ["ACTIVE", "TRANSFERRED", "RETAINED"] },
    };
    const students = await prisma.student.findMany({
      where: { enrollments: { some: enrollmentWhere } },
      orderBy: [{ firstName: "asc" }, { fatherName: "asc" }],
      include: {
        previousSchool: { select: { name: true } },
        guardians: { include: { guardian: true }, take: 1 },
        enrollments: {
          where: enrollmentWhere,
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { academicYear: true, classGroup: true, section: true },
        },
      },
    });
    const buffer = await writeStudentWorkbook(students.map((student) => {
      const enrollment = student.enrollments[0];
      const guardian = student.guardians[0]?.guardian;
      return {
        studentId: student.secondaryPermanentId ?? student.permanentId,
        rollNumber: enrollment?.rollNumber ?? "",
        firstName: student.firstName,
        fatherName: student.fatherName,
        grandfatherName: student.grandfatherName,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
        phone: student.phone ?? "",
        nationalId: student.nationalId ?? "",
        academicYear: enrollment?.academicYear.name ?? "",
        className: enrollment ? levelLabel(enrollment.classGroup.level) : "",
        section: enrollment?.section.name ?? "",
        status: enrollment?.status ?? student.status,
        parentName: guardian ? `${guardian.firstName} ${guardian.lastName}` : "",
        parentPhone: guardian?.phone ?? "",
        parentEmail: guardian?.email ?? "",
        previousSchool: student.previousSchool?.name ?? "",
        previousClass: student.previousClass ?? "",
        leavingYear: student.leavingYear ?? "",
        transferCertificate: student.transferCertificateNo ?? "",
      };
    }), await placementGuide(school.id));
    sendWorkbook(res, buffer, "students.xlsx");
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/students/import-template", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const buffer = await writeStudentWorkbook([], await placementGuide(school.id));
    sendWorkbook(res, buffer, "student-import-template.xlsx");
  } catch (error) {
    next(error);
  }
});

studentsRouter.post("/students/import", sheetUpload.single("file"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    if (!req.file) throw new HttpError(400, "Choose an Excel or CSV file.");
    const filename = req.file.originalname || "students.xlsx";
    if (!/\.(xlsx|csv)$/i.test(filename)) throw new HttpError(400, "Upload an Excel (.xlsx) or CSV file.");
    let rows;
    try {
      rows = await readStudentSheet(req.file.buffer, filename);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not read this file. Use the template.");
    }
    if (!rows.length) throw new HttpError(400, "The file has no students to import.");
    const result = await importStudentRows(school, rows, String(req.body?.academicYearId ?? ""));
    if (result.created) {
      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "STUDENT_IMPORT",
        entityType: "Student",
        summary: `Imported ${result.accepted} students. ${result.rejected} rows were rejected.`,
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

function sendWorkbook(res: import("express").Response, buffer: Buffer, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function placementGuide(schoolId: string) {
  const years = await prisma.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    include: { classes: { include: { sections: { orderBy: { name: "asc" } } } } },
  });
  return years.flatMap((year) => year.classes.flatMap((group) => group.sections.map((section) => ({
    year: year.name,
    className: levelLabel(group.level),
    section: section.name,
  }))));
}

function yearOutcome(status: string) {
  if (status === "RETAINED") return { code: "RETAINED", label: "Retained", detail: "The Term 2 average was below 50%, so this student repeated this class." };
  if (status === "PROMOTED") return { code: "PASSED", label: "Passed", detail: "This student passed and moved to the next class." };
  if (status === "ALUMNI") return { code: "PASSED", label: "Passed", detail: "This student passed and completed this class." };
  if (status === "TRANSFERRED") return { code: "TRANSFERRED", label: "Transferred", detail: "This student left this class for another school." };
  return { code: "ACTIVE", label: "Active", detail: "This is the year the student is in now." };
}

function publicExamination(exam: { term1: { average: number | null; status: string; obtained: number; possible: number; subjects: Array<{ name: string; marks: number | null; maxMarks: number; pending: boolean; absent: boolean }> }; term2: { average: number | null; status: string; obtained: number; possible: number; subjects: Array<{ name: string; marks: number | null; maxMarks: number; pending: boolean; absent: boolean }> }; overall: { average: number | null; status: string; obtained: number; possible: number } } | undefined) {
  if (!exam) return null;
  const term = (row: typeof exam.term1) => ({
    average: row.average,
    status: row.status,
    obtained: row.obtained,
    possible: row.possible,
    subjects: row.subjects.map((subject) => ({
      name: subject.name,
      marks: subject.marks,
      maxMarks: subject.maxMarks,
      pending: subject.pending,
      absent: subject.absent,
    })),
  });
  return {
    term1: term(exam.term1),
    term2: term(exam.term2),
    overall: {
      average: exam.overall.average,
      status: exam.overall.status,
      obtained: exam.overall.obtained,
      possible: exam.overall.possible,
    },
  };
}

studentsRouter.get("/students/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        OR: [
          { enrollments: { some: { schoolId: school.id } } },
          { alumniRecords: { some: { schoolId: school.id } } },
        ],
      },
      include: {
        guardians: { include: { guardian: { include: { user: { select: { email: true, status: true } } } } } },
        previousSchool: { select: { id: true, name: true, code: true } },
        alumniRecords: { where: { schoolId: school.id }, orderBy: { createdAt: "desc" } },
        enrollments: {
          where: { schoolId: school.id },
          include: {
            school: { select: { name: true } },
            academicYear: true,
            section: { include: { subjects: { include: { subject: true } } } },
            attendance: { orderBy: [{ date: "desc" }, { session: "asc" }], take: 60 },
            fees: {
              include: { payments: { where: { voidedAt: null }, orderBy: { createdAt: "desc" } } },
              orderBy: { createdAt: "desc" },
            },
            classGroup: { include: { subjects: { include: { subject: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const enrollmentIds = student.enrollments.map((item) => item.id);
    const [published, assignments, transfers, sectionMoves] = await Promise.all([
      prisma.subjectResult.findMany({
        where: { enrollmentId: { in: enrollmentIds }, state: "PUBLISHED" },
        include: { examSubject: { include: { exam: true } } },
      }),
      prisma.teacherAssignment.findMany({
        where: { schoolId: school.id, sectionId: { in: student.enrollments.map((item) => item.sectionId) } },
        include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      prisma.transferRequest.findMany({
        where: { studentId: student.id, OR: [{ fromSchoolId: school.id }, { toSchoolId: school.id }] },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sectionMove.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const historySchoolIds = [
      ...new Set([
        ...student.alumniRecords.map((row) => row.schoolId),
        ...student.enrollments.map((row) => row.schoolId),
      ]),
    ];
    const historySchoolRows = historySchoolIds.length
      ? await prisma.school.findMany({ where: { id: { in: historySchoolIds } }, select: { id: true, name: true } })
      : [];
    const historySchools = new Map(historySchoolRows.map((row) => [row.id, row.name]));
    const attendanceAll = student.enrollments.flatMap((item) => item.attendance);
    const present = attendanceAll.filter((item) => item.status === "PRESENT").length;
    const absent = attendanceAll.filter((item) => item.status === "ABSENT").length;
    const late = attendanceAll.filter((item) => item.status === "LATE").length;
    const excused = attendanceAll.filter((item) => item.status === "EXCUSED").length;
    const attendanceTotal = attendanceAll.length;
    const fees = student.enrollments.flatMap((enrollment) =>
      enrollment.fees.map((fee) => ({
        id: fee.id,
        title: fee.title,
        type: fee.type,
        amount: fee.amount,
        paidAmount: fee.paidAmount,
        balance: Math.max(fee.amount - fee.paidAmount, 0),
        status: fee.status,
        year: enrollment.academicYear.name,
        payments: fee.payments.map((payment) => ({
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          createdAt: payment.createdAt,
        })),
      })),
    );
    const active = student.enrollments.find((item) => item.status === "ACTIVE") ?? student.enrollments[0];
    const activeElsewhere = await prisma.enrollment.findFirst({
      where: { studentId: student.id, status: "ACTIVE", schoolId: { not: school.id } },
      select: { id: true },
    });
    const withMarks = student.enrollments.find((item) => published.some((mark) => mark.enrollmentId === item.id && !mark.isAbsent && mark.marks != null));
    const scored = (active && published.some((mark) => mark.enrollmentId === active.id && !mark.isAbsent && mark.marks != null)) ? active : (withMarks ?? active);
    const names = new Map<string, string>();
    for (const enrollment of student.enrollments) {
      for (const row of enrollment.section.subjects) names.set(row.subjectId, row.subject.name);
      for (const row of enrollment.classGroup.subjects) names.set(row.subjectId, row.subject.name);
    }
    const publishedMarks: PublishedMark[] = published.map((item) => ({
      enrollmentId: item.enrollmentId,
      examSubjectId: item.examSubjectId,
      marks: item.isAbsent ? null : item.marks,
      isAbsent: item.isAbsent,
    }));
    const examinations = await loadExaminations(prisma, student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      academicYearId: enrollment.academicYearId,
      classGroupId: enrollment.classGroupId,
      sectionId: enrollment.sectionId,
      sectionSubjectIds: enrollment.section.subjects.map((row) => row.subjectId),
    })), publishedMarks, names);
    const examination = scored ? examinations.get(scored.id) : undefined;
    const scoredOutcome = scored ? yearOutcome(scored.status) : null;
    const placementSections = active
      ? await prisma.section.findMany({
        where: { classGroup: { academicYearId: active.academicYearId, schoolId: school.id } },
        include: { classGroup: true },
        orderBy: { name: "asc" },
      })
      : [];
    const timeline = [
      ...student.enrollments.map((enrollment) => ({
        at: enrollment.admittedOn,
        type: "ENROLLMENT",
        label: `Enrolled ${enrollment.school.name} · ${enrollment.academicYear.name} · ${levelLabel(enrollment.classGroup.level)} ${enrollment.section.name} · ${enrollment.status}`,
      })),
      ...sectionMoves.map((move) => ({
        at: move.createdAt,
        type: "SECTION_MOVE",
        label: `Section move · roll ${move.fromRollNumber} → ${move.toRollNumber}`,
      })),
      ...transfers.map((transfer) => ({
        at: transfer.createdAt,
        type: "TRANSFER",
        label: `Transfer ${transfer.status}`,
      })),
      ...student.alumniRecords.map((row) => ({
        at: row.createdAt,
        type: "ALUMNI",
        label: `Alumni · ${levelLabel(row.fromLevel)} · ${row.reason}`,
      })),
      ...fees.flatMap((fee) =>
        fee.payments.map((payment) => ({
          at: payment.createdAt,
          type: "PAYMENT",
          label: `Payment ${payment.receiptNumber} · ${payment.amount} · ${fee.title}`,
        })),
      ),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const portalUser = await prisma.user.findFirst({
      where: { role: "STUDENT", personKey: student.permanentId },
      select: { id: true, email: true, status: true, passwordHash: true },
    });

    res.json({
      id: student.id,
      permanentId: student.permanentId,
      secondaryPermanentId: activeElsewhere ? null : student.secondaryPermanentId,
      firstName: student.firstName,
      fatherName: student.fatherName,
      grandfatherName: student.grandfatherName,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      phone: student.phone,
      nationalId: student.nationalId,
      previousSchool: student.previousSchool,
      previousClass: student.previousClass,
      leavingYear: student.leavingYear,
      transferCertificateNo: student.transferCertificateNo,
      staffNotes: student.staffNotes,
      status: student.status,
      school: { id: school.id, name: school.name },
      portalStatus: portalUser?.status ?? "NONE",
      hasLogin: Boolean(portalUser?.passwordHash),
      email: portalUser?.email ?? null,
      photoUrl: studentPhotoPath(student.id, student.photoUrl, student.photoStorageKey),
      guardians: student.guardians.map((link) => ({
        relationship: link.relationship,
        guardian: {
          id: link.guardian.id,
          publicId: link.guardian.publicId,
          firstName: link.guardian.firstName,
          lastName: link.guardian.lastName,
          phone: link.guardian.phone,
          email: link.guardian.email,
          nationalId: link.guardian.nationalId,
          dateOfBirth: link.guardian.dateOfBirth,
          photoUrl: guardianPhotoPath(link.guardian.id, link.guardian.photoUrl, link.guardian.photoStorageKey),
          user: link.guardian.user,
        },
      })),
      alumniRecords: student.alumniRecords.map((row) => ({
        fromLevel: levelLabel(row.fromLevel),
        schoolName: historySchools.get(row.schoolId) ?? "",
        reason: row.reason,
        createdAt: row.createdAt,
      })),
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        status: transfer.status,
        note: transfer.note,
        createdAt: transfer.createdAt,
      })),
      fees,
      attendanceStats: {
        present,
        absent,
        late,
        excused,
        total: attendanceTotal,
        rate: attendanceTotal ? Math.round((present / attendanceTotal) * 100) : null,
      },
      averages: {
        term1: examination?.term1.average ?? null,
        term2: examination?.term2.average ?? null,
        combined: examination?.overall.average ?? null,
        term1Status: examination?.term1.status ?? "unavailable",
        term2Status: examination?.term2.status ?? "unavailable",
        combinedStatus: examination?.overall.status ?? "unavailable",
        year: scored?.academicYear.name ?? null,
        level: scored ? levelLabel(scored.classGroup.level) : null,
        section: scored?.section.name ?? null,
        outcome: scoredOutcome?.label ?? null,
      },
      placement: active ? {
        enrollmentId: active.id,
        year: active.academicYear.name,
        sectionId: active.sectionId,
        sections: placementSections.map((section) => ({
          id: section.id,
          label: `${levelLabel(section.classGroup.level)} · Section ${section.name}`,
        })),
      } : null,
      timeline,
      enrollments: [...student.enrollments]
        .sort((left, right) => right.academicYear.startDate.getTime() - left.academicYear.startDate.getTime() || right.createdAt.getTime() - left.createdAt.getTime())
        .map((enrollment) => ({
        id: enrollment.id,
        schoolName: enrollment.school.name,
        status: enrollment.status,
        outcome: yearOutcome(enrollment.status),
        examination: publicExamination(examinations.get(enrollment.id)),
        studentNumber: enrollment.studentNumber,
        rollNumber: enrollment.rollNumber,
        admittedOn: enrollment.admittedOn,
        academicYear: enrollment.academicYear,
        section: enrollment.section,
        level: levelLabel(enrollment.classGroup.level),
        attendance: enrollment.attendance,
        subjects: enrollment.section.subjects.map((row) => {
          const assignment = assignments.find(
            (item) => item.sectionId === enrollment.sectionId && item.subjectId === row.subjectId,
          );
          const marks = published.filter(
            (item) => item.enrollmentId === enrollment.id && item.examSubject.subjectId === row.subjectId,
          );
          return {
            id: row.subject.id,
            name: row.subject.name,
            teacher: assignment
              ? `${assignment.teacher.publicId} ${assignment.teacher.user.firstName} ${assignment.teacher.user.lastName}`
              : null,
            terms: (["TERM_1", "TERM_2"] as const).map((term) => {
              const mark = marks.find((item) => item.examSubject.exam.term === term);
              if (!mark) return { term, result: "Not published yet" };
              if (mark.isAbsent) return { term, result: `Absent: ${mark.comment ?? ""}` };
              return { term, result: String(mark.marks) };
            }),
            result: (() => {
              const mark = marks[0];
              if (!mark) return "Not published yet";
              if (mark.isAbsent) return `Absent: ${mark.comment ?? ""}`;
              return String(mark.marks);
            })(),
          };
        }),
      })),
    });
  } catch (error) {
    next(error);
  }
});

studentsRouter.post("/students/:id/placement", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({ sectionId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a class and section.");
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: String(req.params.id), schoolId: school.id, status: "ACTIVE" },
      include: { classGroup: true, section: true, student: true },
    });
    if (!enrollment) throw new HttpError(404, "This student has no active enrollment to correct.");
    const section = await prisma.section.findFirst({
      where: { id: body.data.sectionId, classGroup: { schoolId: school.id, academicYearId: enrollment.academicYearId } },
      include: { classGroup: true },
    });
    if (!section) throw new HttpError(400, "Choose a class in this student's current academic year. Create the class and section first.");
    if (section.id === enrollment.sectionId) {
      res.json({ ok: true });
      return;
    }
    const rolls = await prisma.enrollment.findMany({ where: { sectionId: section.id }, select: { rollNumber: true } });
    const rollNumber = Math.max(0, ...rolls.map((row) => row.rollNumber)) + 1;
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { classGroupId: section.classGroupId, sectionId: section.id, rollNumber },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "PLACEMENT_CORRECTED",
      entityType: "Enrollment",
      entityId: enrollment.id,
      summary: `${enrollment.student.permanentId} moved from ${levelLabel(enrollment.classGroup.level)} ${enrollment.section.name} to ${levelLabel(section.classGroup.level)} ${section.name}`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

studentsRouter.get("/students/:id/photo", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        enrollments: { some: { schoolId: school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    if (student.photoUrl) {
      res.redirect(student.photoUrl);
      return;
    }
    if (!student.photoStorageKey || !student.photoMimeType) throw new HttpError(404, "No photo uploaded.");
    const absolute = absoluteStoragePath(student.photoStorageKey);
    await access(absolute);
    res.setHeader("Content-Type", student.photoMimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(absolute).pipe(res);
  } catch (error) {
    next(error);
  }
});

studentsRouter.post("/students/:id/photo", photoUpload.single("file"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    if (!req.file?.buffer) throw new HttpError(400, "Choose a JPEG, PNG, or WEBP photo.");
    assertPhotoSize(req.file.size);
    const detected = detectImage(req.file.buffer);
    if (!detected) throw new HttpError(400, "Only JPEG, PNG, and WEBP photos are allowed.");
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        enrollments: { some: { schoolId: school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const stored = await storeStudentPhoto(school.id, student.id, req.file.buffer, detected.extension);
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        photoUrl: stored.photoUrl,
        photoPublicId: stored.photoPublicId,
        photoStorageKey: stored.photoStorageKey,
        photoMimeType: detected.mimeType,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "STUDENT_PHOTO_UPLOAD",
      entityType: "Student",
      entityId: student.id,
      summary: `Updated photo for ${student.permanentId}`,
    });
    res.json({
      ok: true,
      photoUrl: studentPhotoPath(updated.id, updated.photoUrl, updated.photoStorageKey),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("5 MB")) {
      next(new HttpError(400, error.message));
      return;
    }
    next(error);
  }
});

studentsRouter.post("/students/:studentId/guardians", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({
      guardianId: z.string().min(1),
      relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN"]),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a parent and a relationship.");
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.studentId),
        organizationId: school.organizationId,
        enrollments: { some: { schoolId: school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const guardian = await prisma.guardian.findFirst({
      where: { id: body.data.guardianId, organizationId: school.organizationId },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
      update: { relationship: body.data.relationship },
      create: { studentId: student.id, guardianId: guardian.id, relationship: body.data.relationship },
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

studentsRouter.patch("/students/:studentId/guardians/:guardianId", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = relationshipSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose Father, Mother, or Guardian.");
    const link = await prisma.studentGuardian.findFirst({
      where: {
        studentId: String(req.params.studentId),
        guardianId: String(req.params.guardianId),
        student: {
          organizationId: school.organizationId,
          enrollments: { some: { schoolId: school.id } },
        },
      },
    });
    if (!link) throw new HttpError(404, "Student guardian relationship was not found.");
    const updated = await prisma.studentGuardian.update({
      where: {
        studentId_guardianId: {
          studentId: link.studentId,
          guardianId: link.guardianId,
        },
      },
      data: { relationship: body.data.relationship },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

studentsRouter.delete("/students/:studentId/guardians/:guardianId", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const link = await prisma.studentGuardian.findFirst({
      where: {
        studentId: String(req.params.studentId),
        guardianId: String(req.params.guardianId),
        student: {
          organizationId: school.organizationId,
          enrollments: { some: { schoolId: school.id } },
        },
      },
    });
    if (!link) throw new HttpError(404, "Student guardian relationship was not found.");
    await prisma.studentGuardian.delete({
      where: { studentId_guardianId: { studentId: link.studentId, guardianId: link.guardianId } },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

const studentUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  fatherName: z.string().trim().min(2).max(80),
  grandfatherName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  nationalId: z.string().trim().max(50).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.string().date(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  previousClass: z.string().trim().max(40).optional().or(z.literal("")),
  leavingYear: z.string().trim().max(20).optional().or(z.literal("")),
  transferCertificateNo: z.string().trim().max(40).optional().or(z.literal("")),
  previousSchoolId: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});

studentsRouter.patch("/students/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = studentUpdateSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter the student's name, gender, and date of birth.");
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        enrollments: { some: { schoolId: school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const studentNira = body.data.nationalId || null;
    if (studentNira && studentNira !== student.nationalId) {
      const taken = await prisma.student.findUnique({ where: { nationalId: studentNira } });
      if (taken) throw new HttpError(409, "This student NIRA is already registered. NIRA is optional, so leave it empty.");
    }
    let previousSchoolId: string | null = null;
    if (body.data.previousSchoolId) {
      const previousSchool = await prisma.school.findFirst({
        where: { id: body.data.previousSchoolId, organizationId: school.organizationId, NOT: { id: school.id } },
      });
      if (!previousSchool) throw new HttpError(400, "Choose a previous school from the list, or leave it empty.");
      previousSchoolId = previousSchool.id;
    }
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        firstName: body.data.firstName,
        fatherName: body.data.fatherName,
        grandfatherName: body.data.grandfatherName,
        gender: body.data.gender,
        dateOfBirth: new Date(body.data.dateOfBirth),
        phone: body.data.phone || null,
        nationalId: studentNira,
        staffNotes: body.data.notes || null,
        previousClass: body.data.previousClass || null,
        leavingYear: body.data.leavingYear || null,
        transferCertificateNo: body.data.transferCertificateNo || null,
        previousSchoolId,
      },
    });
    const portal = await prisma.user.findFirst({
      where: { role: "STUDENT", personKey: student.permanentId },
      select: { id: true },
    });
    if (body.data.email) {
      if (!portal) throw new HttpError(400, "Invite the student before setting a login email.");
      await syncLoginEmail(portal.id, body.data.email);
    } else if (portal && body.data.email === "") {
      throw new HttpError(400, "This student signs in with an email. Enter the new login email.");
    }
    res.json({ id: updated.id, permanentId: updated.permanentId });
  } catch (error) {
    next(error);
  }
});

studentsRouter.post("/students/:id/access", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const student = await prisma.student.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        enrollments: { some: { schoolId: school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const existing = await prisma.user.findFirst({
      where: { role: "STUDENT", personKey: student.permanentId },
    });
    if (existing) {
      const requested = z.string().email().safeParse(req.body?.email);
      if (requested.success) await syncLoginEmail(existing.id, requested.data);
      const setPasswordPath = await issueSetPasswordLink(existing.id);
      res.json({ kind: existing.passwordHash ? "reset" : "invite", setPasswordPath });
      return;
    }
    const email = z.string().email().safeParse(req.body?.email);
    if (!email.success) throw new HttpError(400, "A student email is required for the portal.");
    const taken = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() } });
    if (taken) throw new HttpError(409, "This email is already used by another account.");
    const user = await prisma.user.create({
      data: {
        email: email.data.toLowerCase(),
        role: "STUDENT",
        status: "INVITED",
        firstName: student.firstName,
        lastName: student.fatherName,
        schoolId: school.id,
        personKey: student.permanentId,
        isDemo: false,
      },
    });
    const setPasswordPath = await issueSetPasswordLink(user.id);
    res.status(201).json({ kind: "invite", setPasswordPath });
  } catch (error) {
    next(error);
  }
});

studentsRouter.post("/students", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = studentSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Check the student name, dates, and class.");
    const section = await prisma.section.findFirst({
      where: {
        id: body.data.sectionId,
        classGroup: { academicYearId: body.data.academicYearId, schoolId: school.id },
      },
      include: { classGroup: true },
    });
    if (!section) throw new HttpError(400, "Choose a section from the selected academic year.");
    const studentNira = body.data.nationalId || null;
    if (studentNira) {
      const taken = await prisma.student.findUnique({ where: { nationalId: studentNira } });
      if (taken) throw new HttpError(409, "This student NIRA is already registered. NIRA is optional, so leave it empty.");
    }
    let previousSchoolId: string | null = null;
    if (body.data.previousSchoolId) {
      const previousSchool = await prisma.school.findFirst({
        where: { id: body.data.previousSchoolId, organizationId: school.organizationId, NOT: { id: school.id } },
      });
      if (!previousSchool) throw new HttpError(400, "Choose a previous school from the list, or leave it empty.");
      previousSchoolId = previousSchool.id;
    }
    const band = section.classGroup.level.startsWith("CLASS_") ? "P" : "S";
    const yearMark = String(new Date().getFullYear()).slice(2);
    const created = await prisma.$transaction(async (tx) => {
      const sequence = await nextValue(tx, `student:${school.organizationId}:${yearMark}:${band}`);
      const permanentId = `STU-${yearMark}-${band}-${String(sequence).padStart(6, "0")}`;
      const studentNumber = await nextStudentNumber(tx, school.id);
      const rollNumber = await nextRollNumber(tx, section.id);
      const student = await tx.student.create({
        data: {
          organizationId: school.organizationId,
          permanentId,
          firstName: body.data.firstName,
          fatherName: body.data.fatherName,
          grandfatherName: body.data.grandfatherName,
          gender: body.data.gender,
          dateOfBirth: new Date(body.data.dateOfBirth),
          phone: body.data.phone || null,
          nationalId: studentNira,
          previousSchoolId,
          previousClass: previousSchoolId ? body.data.previousClass || null : null,
          leavingYear: previousSchoolId ? body.data.leavingYear || null : null,
          transferCertificateNo: previousSchoolId ? body.data.transferCertificateNo || null : null,
          staffNotes: body.data.notes || null,
        },
      });
      await tx.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          academicYearId: body.data.academicYearId,
          classGroupId: section.classGroupId,
          sectionId: section.id,
          studentNumber,
          rollNumber,
        },
      });
      const guardianInputData = body.data.guardian;
      const hasGuardian =
        guardianInputData &&
        (guardianInputData.id ||
          (guardianInputData.firstName && guardianInputData.lastName));
      if (hasGuardian && guardianInputData) {
        const guardian = await resolveGuardian(tx, school.organizationId, {
          ...guardianInputData,
          relationship: guardianInputData.relationship || "GUARDIAN",
        });
        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: guardianInputData.relationship || "GUARDIAN",
          },
        });
      }
      return student;
    });
    res.status(201).json({ id: created.id, permanentId: created.permanentId });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : String(error.meta?.target ?? "");
      if (target.toLowerCase().includes("nationalid")) {
        next(new HttpError(409, "This NIRA is already registered. NIRA is optional, so leave it empty."));
        return;
      }
      next(new HttpError(409, "Could not save the student. Try again."));
      return;
    }
    next(error);
  }
});

async function resolveGuardian(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: z.infer<typeof guardianInput>,
) {
  if (input.id) {
    const existing = await tx.guardian.findFirst({ where: { id: input.id, organizationId } });
    if (!existing) throw new HttpError(404, "Guardian was not found.");
    return existing;
  }
  if (input.nationalId) {
    const byNira = await tx.guardian.findFirst({ where: { nationalId: input.nationalId } });
    if (byNira) {
      if (byNira.organizationId !== organizationId) {
        throw new HttpError(409, "This parent NIRA is already registered. NIRA is optional, so leave it empty or search for the parent.");
      }
      return byNira;
    }
  }
  if (!input.firstName || !input.lastName) {
    throw new HttpError(400, "Parent first name and last name are needed only when you add a parent. You can skip the parent.");
  }
  const sequence = await nextValue(tx, `guardian:${organizationId}`);
  return tx.guardian.create({
    data: {
      organizationId,
      publicId: `PAR-${String(sequence).padStart(5, "0")}`,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone?.trim() || "",
      email: input.email || null,
      nationalId: input.nationalId || null,
    },
  });
}
