import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { issueSetPasswordLink } from "../lib/accountLink.js";
import { newRefreshToken } from "../lib/tokens.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const teacherSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(5),
  qualification: z.string().trim().min(2).max(120),
  assignment: z.object({
    sectionId: z.string().min(1),
    subjectIds: z.array(z.string().min(1)).min(1),
  }).optional(),
});

const assignmentSchema = z.object({
  teacherId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  subjectIds: z.array(z.string().min(1)).optional(),
}).refine((value) => Boolean(value.subjectId) || Boolean(value.subjectIds?.length), {
  message: "Choose a subject assigned to this section.",
});

const updateTeacherSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30),
  qualification: z.string().trim().min(2).max(120).nullable(),
  dateOfBirth: z.string().date().nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  nationalId: z.string().trim().max(40).nullable().optional(),
});

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

function teacherAtSchool(schoolId: string) {
  return {
    OR: [
      { schools: { some: { schoolId } } },
      { assignments: { some: { schoolId } } },
      { user: { schoolId } },
    ],
  };
}

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

export const teachersRouter = Router();
teachersRouter.use("/teachers", requireAuth, requireRole("SCHOOL_ADMIN"));
teachersRouter.use("/teacher-assignments", requireAuth, requireRole("SCHOOL_ADMIN"));
teachersRouter.use("/teacher-placement", requireAuth, requireRole("SCHOOL_ADMIN"));

teachersRouter.get("/teacher-placement", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const years = await prisma.academicYear.findMany({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
      include: {
        classes: {
          orderBy: { level: "asc" },
          include: {
            subjects: { include: { subject: true } },
            sections: {
              orderBy: { name: "asc" },
              include: {
                _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
                subjects: { include: { subject: true } },
              },
            },
          },
        },
      },
    });
    const sectionIds = years.flatMap((year) => year.classes.flatMap((item) => item.sections.map((section) => section.id)));
    const assignments = await prisma.teacherAssignment.findMany({
      where: { schoolId: school.id, sectionId: { in: sectionIds } },
      select: { sectionId: true, subjectId: true },
    });
    res.json(
      years.map((year) => ({
        id: year.id,
        name: year.name,
        isCurrent: year.isCurrent,
        classes: year.classes.map((item) => ({
          id: item.id,
          label: levelLabel(item.level),
          band: item.level.startsWith("CLASS_") ? "Primary" : "Secondary",
          subjects: item.subjects
            .filter((row) => row.subject.isActive)
            .map((row) => ({ id: row.subject.id, name: row.subject.name, code: row.subject.code })),
          sections: item.sections.map((section) => ({
            id: section.id,
            name: section.name,
            studentCount: section._count.enrollments,
            subjects: section.subjects
              .filter((row) => row.subject.isActive)
              .map((row) => ({ id: row.subject.id, name: row.subject.name, code: row.subject.code })),
            assignedSubjectIds: assignments
              .filter((assignment) => assignment.sectionId === section.id)
              .map((assignment) => assignment.subjectId),
          })),
        })),
      })),
    );
  } catch (error) {
    next(error);
  }
});

teachersRouter.get("/teachers", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const teachers = await prisma.teacher.findMany({
      where: {
        organizationId: school.organizationId,
        ...teacherAtSchool(school.id),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true, schoolId: true } },
        assignments: { where: { schoolId: school.id } },
        schools: { include: { school: { select: { id: true, name: true } } } },
      },
      orderBy: { publicId: "asc" },
    });
    const sectionIds = teachers.flatMap((teacher) => teacher.assignments.map((item) => item.sectionId));
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    const subjects = await prisma.subject.findMany({
      where: { id: { in: teachers.flatMap((teacher) => teacher.assignments.map((item) => item.subjectId)) } },
    });
    res.json(
      teachers.map((teacher) => ({
        id: teacher.id,
        publicId: teacher.publicId,
        phone: teacher.phone,
        qualification: teacher.qualification,
        name: `${teacher.user.firstName} ${teacher.user.lastName}`,
        firstName: teacher.user.firstName,
        lastName: teacher.user.lastName,
        email: teacher.user.email,
        status: teacher.user.status,
        isActive: teacher.isActive,
        schools: teacher.schools.map((link) => ({ id: link.school.id, name: link.school.name })),
        assignmentCount: teacher.assignments.length,
        assignments: teacher.assignments.map((item) => {
          const section = sections.find((row) => row.id === item.sectionId);
          const subject = subjects.find((row) => row.id === item.subjectId);
          return {
            id: item.id,
            year: section?.classGroup.academicYear.name ?? "",
            level: section ? levelLabel(section.classGroup.level) : "",
            section: section?.name ?? "",
            subject: subject?.name ?? "",
          };
        }),
      })),
    );
  } catch (error) {
    next(error);
  }
});

teachersRouter.get("/teachers/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: school.organizationId,
        ...teacherAtSchool(school.id),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true, passwordHash: true } },
        assignments: { where: { schoolId: school.id }, orderBy: { createdAt: "desc" } },
        schools: { include: { school: { select: { id: true, name: true } } } },
      },
    });
    if (!teacher) throw new HttpError(404, "Teacher was not found.");

    const sectionIds = teacher.assignments.map((assignment) => assignment.sectionId);
    const subjectIds = teacher.assignments.map((assignment) => assignment.subjectId);
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, classGroup: { schoolId: school.id } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId: school.id },
    });
    const classGroupIds = sections.map((section) => section.classGroupId);
    const examSubjects = await prisma.examSubject.findMany({
      where: {
        classGroupId: { in: classGroupIds },
        subjectId: { in: subjectIds },
        exam: { schoolId: school.id },
      },
      include: {
        exam: true,
        results: {
          where: { enrollment: { sectionId: { in: sectionIds } } },
          select: { state: true, enrollment: { select: { sectionId: true } } },
        },
      },
    });

    res.json({
      id: teacher.id,
      publicId: teacher.publicId,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      email: teacher.user.email,
      phone: teacher.phone,
      qualification: teacher.qualification,
      status: teacher.user.status,
      hasLogin: Boolean(teacher.user.passwordHash),
      isActive: teacher.isActive,
      schools: teacher.schools.map((link) => ({ id: link.school.id, name: link.school.name })),
      createdAt: teacher.createdAt,
      nationalId: teacher.nationalId,
      address: teacher.address,
      dateOfBirth: teacher.dateOfBirth,
      assignments: teacher.assignments.map((assignment) => {
        const section = sections.find((item) => item.id === assignment.sectionId);
        const subject = subjects.find((item) => item.id === assignment.subjectId);
        const termStatus = (term: "TERM_1" | "TERM_2") => {
          const examSubject = examSubjects.find(
            (item) =>
              item.classGroupId === section?.classGroupId &&
              item.subjectId === assignment.subjectId &&
              item.exam.term === term,
          );
          return examSubject?.results.some(
            (result) => result.enrollment.sectionId === assignment.sectionId && result.state === "PUBLISHED",
          )
            ? "PUBLISHED"
            : "NOT_PUBLISHED";
        };
        return {
          id: assignment.id,
          sectionId: assignment.sectionId,
          classGroupId: section?.classGroupId ?? "",
          academicYearId: assignment.academicYearId,
          year: section?.classGroup.academicYear.name ?? "",
          school: school.name,
          isCurrentYear: section?.classGroup.academicYear.isCurrent ?? false,
          level: section ? levelLabel(section.classGroup.level) : "",
          section: section?.name ?? "",
          subject: subject?.name ?? "",
          status: "ACTIVE",
          term1: termStatus("TERM_1"),
          term2: termStatus("TERM_2"),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

teachersRouter.patch("/teachers/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = updateTeacherSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter valid teacher details.");
    const teacher = await prisma.teacher.findFirst({
      where: { id: String(req.params.id), organizationId: school.organizationId, ...teacherAtSchool(school.id) },
    });
    if (!teacher) throw new HttpError(404, "Teacher was not found.");
    const nationalId = body.data.nationalId?.trim() || null;
    if (nationalId) {
      const taken = await prisma.teacher.findFirst({ where: { nationalId, NOT: { id: teacher.id } }, select: { id: true } });
      if (taken) throw new HttpError(409, "This NIRA is already registered.");
    }
    const [, updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: teacher.userId },
        data: { firstName: body.data.firstName, lastName: body.data.lastName },
      }),
      prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          phone: body.data.phone,
          qualification: body.data.qualification,
          dateOfBirth: body.data.dateOfBirth === undefined ? undefined : body.data.dateOfBirth ? new Date(body.data.dateOfBirth) : null,
          address: body.data.address === undefined ? undefined : body.data.address || null,
          nationalId: body.data.nationalId === undefined ? undefined : nationalId,
        },
      }),
    ]);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

teachersRouter.post("/teachers", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = teacherSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Teacher name, email, and phone are required.");
    const email = body.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, include: { teacher: true } });
    if (existing?.teacher) {
      if (existing.teacher.organizationId !== school.organizationId) {
        throw new HttpError(409, "This email already belongs to a teacher outside this organization.");
      }
      await prisma.teacherSchool.upsert({
        where: { teacherId_schoolId: { teacherId: existing.teacher.id, schoolId: school.id } },
        update: {},
        create: { teacherId: existing.teacher.id, schoolId: school.id },
      });
      res.status(200).json({ id: existing.teacher.id, publicId: existing.teacher.publicId, linked: true });
      return;
    }
    if (existing) throw new HttpError(409, "This email is already used by another account.");
    let assignmentSection: Prisma.SectionGetPayload<{
      include: { classGroup: true; subjects: true };
    }> | null = null;
    if (body.data.assignment) {
      assignmentSection = await prisma.section.findFirst({
        where: { id: body.data.assignment.sectionId, classGroup: { schoolId: school.id } },
        include: { classGroup: true, subjects: true },
      });
      if (!assignmentSection) throw new HttpError(400, "Choose a section from this school.");
      const allowedSubjectIds = new Set(assignmentSection.subjects.map((row) => row.subjectId));
      if (body.data.assignment.subjectIds.some((subjectId) => !allowedSubjectIds.has(subjectId))) {
        throw new HttpError(400, "Choose subjects assigned to the selected section.");
      }
      const alreadyAssigned = await prisma.teacherAssignment.findFirst({
        where: {
          sectionId: assignmentSection.id,
          subjectId: { in: body.data.assignment.subjectIds },
        },
      });
      if (alreadyAssigned) throw new HttpError(409, "One of these subjects already has a teacher in this section.");
    }
    const invite = newRefreshToken();
    const teacher = await prisma.$transaction(async (tx) => {
      const sequence = await nextValue(tx, `teacher:${school.organizationId}`);
      const user = await tx.user.create({
        data: {
          email,
          role: "TEACHER",
          status: "INVITED",
          firstName: body.data.firstName,
          lastName: body.data.lastName,
          schoolId: school.id,
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
      const created = await tx.teacher.create({
        data: {
          organizationId: school.organizationId,
          userId: user.id,
          publicId: `TCH-${String(sequence).padStart(5, "0")}`,
          phone: body.data.phone,
          qualification: body.data.qualification,
          schools: { create: { schoolId: school.id } },
        },
      });
      if (body.data.assignment && assignmentSection) {
        await tx.teacherAssignment.createMany({
          data: body.data.assignment.subjectIds.map((subjectId) => ({
            teacherId: created.id,
            schoolId: school.id,
            academicYearId: assignmentSection!.classGroup.academicYearId,
            sectionId: assignmentSection!.id,
            subjectId,
          })),
        });
      }
      return created;
    });
    res.status(201).json({
      id: teacher.id,
      publicId: teacher.publicId,
      setPasswordPath: `/set-password/${invite.token}`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      next(new HttpError(409, "One of these subjects already has a teacher in this section."));
      return;
    }
    next(error);
  }
});

teachersRouter.post("/teacher-assignments", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = assignmentSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a teacher, section, and subject.");
    const teacher = await prisma.teacher.findFirst({
      where: { id: body.data.teacherId, organizationId: school.organizationId, isActive: true },
    });
    if (!teacher) throw new HttpError(404, "Teacher was not found.");
    const section = await prisma.section.findFirst({
      where: { id: body.data.sectionId, classGroup: { schoolId: school.id } },
      include: { classGroup: true, subjects: true },
    });
    if (!section) throw new HttpError(400, "Choose a section from this school.");
    const subjectIds = [...new Set(body.data.subjectIds ?? (body.data.subjectId ? [body.data.subjectId] : []))];
    const allowed = new Set(section.subjects.map((row) => row.subjectId));
    if (subjectIds.some((subjectId) => !allowed.has(subjectId))) {
      throw new HttpError(400, "Choose subjects assigned to this section.");
    }
    const assignment = await prisma.$transaction(async (tx) => {
      await tx.teacherSchool.upsert({
        where: { teacherId_schoolId: { teacherId: teacher.id, schoolId: school.id } },
        update: {},
        create: { teacherId: teacher.id, schoolId: school.id },
      });
      return tx.teacherAssignment.createMany({
        data: subjectIds.map((subjectId) => ({
          teacherId: teacher.id,
          schoolId: school.id,
          academicYearId: section.classGroup.academicYearId,
          sectionId: section.id,
          subjectId,
        })),
      });
    });
    res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      next(new HttpError(409, "This section already has a teacher for that subject."));
      return;
    }
    next(error);
  }
});

teachersRouter.delete("/teacher-assignments/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
    });
    if (!assignment) throw new HttpError(404, "Assignment was not found.");
    await prisma.teacherAssignment.delete({ where: { id: assignment.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

teachersRouter.post("/teachers/:id/access", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const teacher = await prisma.teacher.findFirst({
      where: { id: String(req.params.id), organizationId: school.organizationId, ...teacherAtSchool(school.id) },
      include: { user: { select: { id: true, passwordHash: true } } },
    });
    if (!teacher) throw new HttpError(404, "Teacher was not found.");
    const setPasswordPath = await issueSetPasswordLink(teacher.user.id);
    res.json({ kind: teacher.user.passwordHash ? "reset" : "invite", setPasswordPath });
  } catch (error) {
    next(error);
  }
});
