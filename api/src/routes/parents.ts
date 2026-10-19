import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { absoluteStoragePath } from "../lib/files.js";
import { assertPhotoSize, detectImage, guardianPhotoPath, storeGuardianPhoto, studentPhotoPath } from "../lib/photos.js";
import { loadExaminations, type PublishedMark } from "../lib/examAverages.js";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { issueSetPasswordLink } from "../lib/accountLink.js";
import { newRefreshToken } from "../lib/tokens.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const parentsRouter = Router();

const parentPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const createParentSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().date().optional().or(z.literal("")),
  nationalId: z.string().trim().max(50).optional().or(z.literal("")),
});

const updateParentSchema = createParentSchema.partial().refine((value) => Object.keys(value).length > 0);

function parentVisibleAtSchool(schoolId: string) {
  return {
    OR: [
      { registeredSchoolId: schoolId },
      { registeredSchoolId: null, students: { none: {} } },
      { students: { some: { student: { enrollments: { some: { schoolId } } } } } },
    ],
  };
}

async function nextParentNumber(tx: Prisma.TransactionClient, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${`guardian:${organizationId}`}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

parentsRouter.post("/parents", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to create a parent.");
    const body = createParentSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Parent first name and last name are required.");
    const created = await prisma.$transaction(async (tx) => {
      const sequence = await nextParentNumber(tx, admin.school!.organizationId);
      return tx.guardian.create({
        data: {
          organizationId: admin.school!.organizationId,
          registeredSchoolId: admin.school!.id,
          publicId: `PAR-${String(sequence).padStart(5, "0")}`,
          firstName: body.data.firstName,
          lastName: body.data.lastName,
          phone: body.data.phone?.trim() || "",
          email: body.data.email || null,
          dateOfBirth: body.data.dateOfBirth ? new Date(body.data.dateOfBirth) : null,
          nationalId: body.data.nationalId?.trim() || null,
        },
      });
    });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      next(new HttpError(409, "That email or national ID is already registered."));
      return;
    }
    next(error);
  }
});

parentsRouter.get("/parents/:id/photo", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const guardian = await prisma.guardian.findFirst({
      where: { id: String(req.params.id), organizationId: admin.school.organizationId, ...parentVisibleAtSchool(admin.school.id) },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    if (guardian.photoUrl) {
      res.redirect(guardian.photoUrl);
      return;
    }
    if (!guardian.photoStorageKey || !guardian.photoMimeType) throw new HttpError(404, "No photo uploaded.");
    const absolute = absoluteStoragePath(guardian.photoStorageKey);
    await access(absolute);
    res.setHeader("Content-Type", guardian.photoMimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(absolute).pipe(res);
  } catch (error) {
    next(error);
  }
});

parentsRouter.post("/parents/:id/photo", requireAuth, requireRole("SCHOOL_ADMIN"), parentPhotoUpload.single("file"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to update this parent.");
    if (!req.file?.buffer) throw new HttpError(400, "Choose a JPEG, PNG, or WEBP photo.");
    if (req.file.size > 2 * 1024 * 1024) throw new HttpError(400, "Photo must be 2 MB or smaller.");
    assertPhotoSize(req.file.size);
    const detected = detectImage(req.file.buffer);
    if (!detected) throw new HttpError(400, "Only JPEG, PNG, and WEBP photos are allowed.");
    const guardian = await prisma.guardian.findFirst({
      where: { id: String(req.params.id), organizationId: admin.school.organizationId, ...parentVisibleAtSchool(admin.school.id) },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    const stored = await storeGuardianPhoto(admin.school.id, guardian.id, req.file.buffer, detected.extension);
    const updated = await prisma.guardian.update({
      where: { id: guardian.id },
      data: {
        photoUrl: stored.photoUrl,
        photoPublicId: stored.photoPublicId,
        photoStorageKey: stored.photoStorageKey,
        photoMimeType: detected.mimeType,
      },
    });
    res.json({ ok: true, photoUrl: guardianPhotoPath(updated.id, updated.photoUrl, updated.photoStorageKey) });
  } catch (error) {
    next(error);
  }
});

parentsRouter.get("/parents", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const school = admin.school;
    const guardians = await prisma.guardian.findMany({
      where: {
        organizationId: school.organizationId,
        ...parentVisibleAtSchool(school.id),
      },
      include: {
        user: { select: { email: true, status: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                permanentId: true,
                secondaryPermanentId: true,
                firstName: true,
                fatherName: true,
                grandfatherName: true,
                photoUrl: true,
                photoStorageKey: true,
                enrollments: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  include: { classGroup: true, section: true, school: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    res.json(
      guardians.map((guardian) => ({
        id: guardian.id,
        publicId: guardian.publicId,
        name: `${guardian.firstName} ${guardian.lastName}`,
        phone: guardian.phone,
        email: guardian.email ?? guardian.user?.email ?? null,
        portalStatus: guardian.user?.status ?? "NONE",
        childrenCount: guardian.students.length,
        children: guardian.students.map((link) => {
          const enrollment = link.student.enrollments[0];
          return {
            id: link.student.id,
            permanentId: link.student.secondaryPermanentId ?? link.student.permanentId,
            name: `${link.student.firstName} ${link.student.fatherName} ${link.student.grandfatherName}`,
            relationship: link.relationship,
            school: enrollment?.school.name ?? "No enrollment yet",
            level: enrollment ? levelLabel(enrollment.classGroup.level) : "",
            section: enrollment?.section.name ?? "",
          };
        }),
      })),
    );
  } catch (error) {
    next(error);
  }
});

parentsRouter.get("/parents/:id", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const school = admin.school;
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        ...parentVisibleAtSchool(school.id),
      },
      include: {
        user: { select: { email: true, status: true } },
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    school: { select: { id: true, name: true } },
                    academicYear: true,
                    classGroup: true,
                    section: true,
                    fees: {
                      include: { payments: { where: { voidedAt: null } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    const children = guardian.students
      .map((link) => {
        const enrollment = link.student.enrollments[0];
        const invoiced = enrollment?.fees.reduce((sum, fee) => sum + fee.amount, 0) ?? 0;
        const paid = enrollment?.fees.reduce((sum, fee) => sum + fee.paidAmount, 0) ?? 0;
        return {
          id: link.student.id,
          permanentId: link.student.secondaryPermanentId ?? link.student.permanentId,
          name: `${link.student.firstName} ${link.student.fatherName} ${link.student.grandfatherName}`,
          photoUrl: studentPhotoPath(link.student.id, link.student.photoUrl, link.student.photoStorageKey),
          gender: link.student.gender,
          status: link.student.status,
          relationship: link.relationship,
          school: enrollment?.school.name ?? "No enrollment yet",
          year: enrollment?.academicYear.name ?? "",
          level: enrollment ? levelLabel(enrollment.classGroup.level) : "",
          section: enrollment?.section.name ?? "",
          rollNumber: enrollment?.rollNumber ?? 0,
          invoiced,
          paid,
          balance: Math.max(0, invoiced - paid),
        };
      });
    res.json({
      id: guardian.id,
      publicId: guardian.publicId,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      name: `${guardian.firstName} ${guardian.lastName}`,
      phone: guardian.phone,
      email: guardian.email ?? guardian.user?.email ?? null,
      dateOfBirth: guardian.dateOfBirth,
      nationalId: guardian.nationalId,
      photoUrl: guardianPhotoPath(guardian.id, guardian.photoUrl, guardian.photoStorageKey),
      portalStatus: guardian.user?.status ?? "NONE",
      createdAt: guardian.createdAt,
      childrenCount: children.length,
      finances: {
        invoiced: children.reduce((sum, child) => sum + child.invoiced, 0),
        paid: children.reduce((sum, child) => sum + child.paid, 0),
        balance: children.reduce((sum, child) => sum + child.balance, 0),
      },
      children,
    });
  } catch (error) {
    next(error);
  }
});

parentsRouter.patch("/parents/:id", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to update this parent.");
    const body = updateParentSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter valid parent details.");
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: admin.school.organizationId,
        students: { some: { student: { enrollments: { some: { schoolId: admin.school.id } } } } },
      },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    const { dateOfBirth, email, nationalId, ...rest } = body.data;
    const updated = await prisma.guardian.update({
      where: { id: guardian.id },
      data: {
        ...rest,
        ...(email !== undefined ? { email: email === "" ? null : email } : {}),
        ...(nationalId !== undefined ? { nationalId: nationalId === "" ? null : nationalId } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
      },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

parentsRouter.post("/guardians/:id/invite", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school) throw new HttpError(403, "You are not allowed to access this record.");
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: admin.school.organizationId,
        ...parentVisibleAtSchool(admin.school.id),
      },
    });
    if (!guardian) throw new HttpError(404, "Guardian was not found.");
    if (guardian.userId) {
      const setPasswordPath = await issueSetPasswordLink(guardian.userId);
      res.json({ id: guardian.id, publicId: guardian.publicId, setPasswordPath });
      return;
    }
    const email = z.string().email().safeParse(req.body?.email ?? guardian.email);
    if (!email.success) throw new HttpError(400, "A parent email is required for the portal.");
    const existing = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() } });
    if (existing) throw new HttpError(409, "This email is already used by another account.");
    const invite = newRefreshToken();
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.data.toLowerCase(),
          role: "PARENT",
          status: "INVITED",
          firstName: guardian.firstName,
          lastName: guardian.lastName,
          isDemo: false,
        },
      });
      await tx.inviteToken.create({
        data: {
          userId: user.id,
          tokenHash: invite.tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return tx.guardian.update({
        where: { id: guardian.id },
        data: { userId: user.id, email: email.data.toLowerCase() },
      });
    });
    res.status(201).json({
      id: created.id,
      publicId: created.publicId,
      setPasswordPath: `/set-password?token=${invite.token}`,
    });
  } catch (error) {
    next(error);
  }
});

parentsRouter.post("/parents/:id/access", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school) throw new HttpError(403, "You are not allowed to access this record.");
    const guardian = await prisma.guardian.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: admin.school.organizationId,
        ...parentVisibleAtSchool(admin.school.id),
      },
      include: { user: { select: { id: true, passwordHash: true } } },
    });
    if (!guardian?.userId) throw new HttpError(409, "Invite this parent before resetting a password.");
    const setPasswordPath = await issueSetPasswordLink(guardian.userId);
    res.json({ kind: guardian.user?.passwordHash ? "reset" : "invite", setPasswordPath });
  } catch (error) {
    next(error);
  }
});

parentsRouter.get("/student-search", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const students = await prisma.student.findMany({
      where: {
        organizationId: admin.school.organizationId,
        enrollments: { some: { schoolId: admin.school.id } },
        OR: [
          { permanentId: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { fatherName: { contains: q, mode: "insensitive" } },
          { grandfatherName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { nationalId: { contains: q, mode: "insensitive" } },
          { enrollments: { some: { schoolId: admin.school.id, studentNumber: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: 8,
      include: {
        enrollments: {
          where: { schoolId: admin.school.id },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { school: { select: { name: true } }, classGroup: true, section: true },
        },
      },
    });
    res.json(students.map((student) => {
      const enrollment = student.enrollments[0];
      return {
        id: student.id,
        permanentId: student.permanentId,
        name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
        status: student.status,
        school: enrollment?.school.name ?? admin.school!.name,
        level: enrollment ? levelLabel(enrollment.classGroup.level) : "",
        section: enrollment?.section.name ?? "",
        studentNumber: enrollment?.studentNumber ?? "",
        photoUrl: studentPhotoPath(student.id, student.photoUrl, student.photoStorageKey),
      };
    }));
  } catch (error) {
    next(error);
  }
});

parentsRouter.post("/parents/:id/children", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const body = z.object({
      studentId: z.string().min(1),
      relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN"]),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a student and a relationship.");
    const guardian = await prisma.guardian.findFirst({
      where: { id: String(req.params.id), organizationId: admin.school.organizationId, ...parentVisibleAtSchool(admin.school.id) },
    });
    if (!guardian) throw new HttpError(404, "Parent was not found.");
    const student = await prisma.student.findFirst({
      where: {
        id: body.data.studentId,
        organizationId: admin.school.organizationId,
        enrollments: { some: { schoolId: admin.school.id } },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found at this school.");
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

parentsRouter.get("/parent/children", requireAuth, requireRole("PARENT"), async (req, res, next) => {
  try {
    const guardian = await prisma.guardian.findFirst({
      where: { userId: req.authUser!.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    school: true,
                    academicYear: true,
                    section: true,
                    classGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian) throw new HttpError(403, "You are not allowed to access this record.");
    res.json(
      guardian.students.map((link) => {
        const current = link.student.enrollments.find((item) => item.status === "ACTIVE") ?? link.student.enrollments[0];
        return {
          id: link.student.id,
          permanentId: link.student.secondaryPermanentId ?? link.student.permanentId,
          name: `${link.student.firstName} ${link.student.fatherName} ${link.student.grandfatherName}`,
          photoUrl: link.student.photoUrl,
          dateOfBirth: link.student.dateOfBirth,
          relationship: link.relationship,
          status: link.student.status,
          school: current?.school.name ?? "",
          year: current?.academicYear.name ?? "",
          level: current ? levelLabel(current.classGroup.level) : "",
          section: current?.section.name ?? "",
          rollNumber: current?.rollNumber ?? null,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

parentsRouter.get("/parent/children/:studentId/fees", requireAuth, requireRole("PARENT"), async (req, res, next) => {
  try {
    const guardian = await prisma.guardian.findFirst({
      where: {
        userId: req.authUser!.id,
        students: { some: { studentId: String(req.params.studentId) } },
      },
    });
    if (!guardian) throw new HttpError(403, "You are not allowed to access this record.");
    const fees = await prisma.studentFee.findMany({
      where: { enrollment: { studentId: String(req.params.studentId) } },
      include: {
        enrollment: { include: { academicYear: true, school: true } },
        payments: { where: { voidedAt: null }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(fees.map((fee) => ({
      id: fee.id,
      title: fee.title,
      type: fee.type,
      amount: fee.amount,
      paidAmount: fee.paidAmount,
      balance: Math.max(fee.amount - fee.paidAmount, 0),
      status: fee.status,
      year: fee.enrollment.academicYear.name,
      school: fee.enrollment.school.name,
      payments: fee.payments.map((payment) => ({
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })),
    })));
  } catch (error) {
    next(error);
  }
});

parentsRouter.get("/parent/children/:studentId", requireAuth, requireRole("PARENT"), async (req, res, next) => {
  try {
    const guardian = await prisma.guardian.findFirst({
      where: {
        userId: req.authUser!.id,
        students: { some: { studentId: String(req.params.studentId) } },
      },
    });
    if (!guardian) throw new HttpError(403, "You are not allowed to access this record.");
    const student = await prisma.student.findUnique({
      where: { id: String(req.params.studentId) },
      include: {
        enrollments: {
          orderBy: { createdAt: "desc" },
          include: {
            school: true,
            academicYear: true,
            section: { include: { subjects: { include: { subject: true } } } },
            classGroup: { include: { subjects: { include: { subject: true } } } },
            attendance: { orderBy: { date: "desc" }, take: 20 },
            results: {
              where: { state: "PUBLISHED" },
              include: { examSubject: { include: { exam: true, } } },
            },
          },
        },
      },
    });
    if (!student) throw new HttpError(404, "Student was not found.");
    const names = new Map<string, string>();
    for (const enrollment of student.enrollments) {
      for (const row of enrollment.section.subjects) names.set(row.subjectId, row.subject.name);
      for (const row of enrollment.classGroup.subjects) names.set(row.subjectId, row.subject.name);
    }
    const published: PublishedMark[] = student.enrollments.flatMap((enrollment) => enrollment.results.map((result) => ({
      enrollmentId: enrollment.id,
      examSubjectId: result.examSubjectId,
      marks: result.isAbsent ? null : result.marks,
      isAbsent: result.isAbsent,
    })));
    const examinations = await loadExaminations(prisma, student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      academicYearId: enrollment.academicYearId,
      classGroupId: enrollment.classGroupId,
      sectionId: enrollment.sectionId,
      sectionSubjectIds: enrollment.section.subjects.map((row) => row.subjectId),
    })), published, names);
    res.json({
      id: student.id,
      permanentId: student.secondaryPermanentId ?? student.permanentId,
      name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
      photoUrl: student.photoUrl,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      nationalId: student.nationalId,
      status: student.status,
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        school: enrollment.school.name,
        year: enrollment.academicYear.name,
        level: levelLabel(enrollment.classGroup.level),
        section: enrollment.section.name,
        rollNumber: enrollment.rollNumber,
        examination: examinations.get(enrollment.id) ?? null,
        attendance: enrollment.attendance.map((row) => ({
          date: row.date,
          session: row.session,
          status: row.status,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});
