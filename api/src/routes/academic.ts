import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { levelLabel, levelsForSchool } from "../lib/levels.js";
import { studentPhotoPath } from "../lib/photos.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const yearSchema = z.object({
  name: z.string().trim().min(4).max(40),
  startDate: z.string().date(),
  endDate: z.string().date(),
  isCurrent: z.boolean().optional(),
});

const subjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const classSchema = z.object({
  level: z.enum([
    "CLASS_1",
    "CLASS_2",
    "CLASS_3",
    "CLASS_4",
    "CLASS_5",
    "CLASS_6",
    "CLASS_7",
    "CLASS_8",
    "FORM_1",
    "FORM_2",
    "FORM_3",
    "FORM_4",
  ]),
  subjectIds: z.array(z.string()).default([]),
});

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(20),
  subjectIds: z.array(z.string()).default([]),
});

const sectionSubjectsSchema = z.object({
  subjectIds: z.array(z.string().min(1)).min(1),
});

async function nextSubjectCode(schoolId: string, name: string) {
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "SUB";
  const existing = await prisma.subject.findMany({ where: { schoolId }, select: { code: true } });
  const used = new Set(existing.map((row) => row.code));
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const code = `${base.slice(0, 6)}${index}`;
    if (!used.has(code)) return code;
  }
  throw new HttpError(409, "Could not create a subject code.");
}

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { school: true },
  });
  if (!user?.school || !user.school.isActive) {
    throw new HttpError(403, "You are not allowed to access this record.");
  }
  return user.school;
}

export const academicRouter = Router();
academicRouter.use("/subjects", requireAuth, requireRole("SCHOOL_ADMIN"));
academicRouter.use("/academic-years", requireAuth, requireRole("SCHOOL_ADMIN"));
academicRouter.use("/sections", requireAuth, requireRole("SCHOOL_ADMIN"));
academicRouter.use("/class-groups", requireAuth, requireRole("SCHOOL_ADMIN"));

academicRouter.get("/subjects", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const subjects = await prisma.subject.findMany({
      where: { schoolId: school.id, isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/subjects", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = subjectSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Subject name is required.");
    const code = await nextSubjectCode(school.id, body.data.name);
    const subject = await prisma.subject.create({
      data: { schoolId: school.id, name: body.data.name, code },
    });
    res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
});

academicRouter.patch("/subjects/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = subjectSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Subject name is required.");
    const subject = await prisma.subject.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!subject) throw new HttpError(404, "Subject was not found.");
    const updated = await prisma.subject.update({ where: { id: subject.id }, data: { name: body.data.name } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

academicRouter.delete("/subjects/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const subject = await prisma.subject.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!subject) throw new HttpError(404, "Subject was not found.");
    const [sections, exams, teachers] = await Promise.all([
      prisma.sectionSubject.count({ where: { subjectId: subject.id } }),
      prisma.examSubject.count({ where: { subjectId: subject.id } }),
      prisma.teacherAssignment.count({ where: { subjectId: subject.id, schoolId: school.id } }),
    ]);
    if (sections || exams || teachers) {
      throw new HttpError(409, "This subject is already in use and cannot be deleted.");
    }
    await prisma.$transaction([
      prisma.classSubject.deleteMany({ where: { subjectId: subject.id } }),
      prisma.subject.delete({ where: { id: subject.id } }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/academic-years", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const years = await prisma.academicYear.findMany({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
      include: {
        terms: true,
        classes: { include: { sections: true, subjects: true } },
      },
    });
    res.json({
      schoolType: school.type,
      levels: levelsForSchool(school.type).map((code) => ({ code, label: levelLabel(code) })),
      years,
    });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/academic-years", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = yearSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Name, start date, and end date are required.");
    const startDate = new Date(body.data.startDate);
    const endDate = new Date(body.data.endDate);
    if (endDate <= startDate) throw new HttpError(400, "The end date must be after the start date.");
    const duplicate = await prisma.academicYear.findUnique({
      where: { schoolId_name: { schoolId: school.id, name: body.data.name } },
    });
    if (duplicate) throw new HttpError(409, "This academic year already exists.");
    const year = await prisma.$transaction(async (tx) => {
      if (body.data.isCurrent) {
        await tx.academicYear.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
      }
      return tx.academicYear.create({
        data: {
          schoolId: school.id,
          name: body.data.name,
          startDate,
          endDate,
          isCurrent: Boolean(body.data.isCurrent),
          terms: { create: [{ code: "TERM_1" }, { code: "TERM_2" }] },
        },
        include: { terms: true },
      });
    });
    res.status(201).json(year);
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/academic-years/:id/current", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const year = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId: school.id } });
    if (!year) throw new HttpError(404, "Academic year was not found.");
    await prisma.$transaction([
      prisma.academicYear.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } }),
      prisma.academicYear.update({ where: { id: year.id }, data: { isCurrent: true } }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

academicRouter.patch("/academic-years/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const year = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId: school.id } });
    if (!year) throw new HttpError(404, "Academic year was not found.");
    const body = yearSchema.partial().safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Invalid academic year data.");

    const updateData: { name?: string; startDate?: Date; endDate?: Date; isCurrent?: boolean } = {};
    if (body.data.name) updateData.name = body.data.name;
    if (body.data.startDate) updateData.startDate = new Date(body.data.startDate);
    if (body.data.endDate) updateData.endDate = new Date(body.data.endDate);
    if (typeof body.data.isCurrent === "boolean") updateData.isCurrent = body.data.isCurrent;

    if (updateData.startDate && updateData.endDate && updateData.endDate <= updateData.startDate) {
      throw new HttpError(400, "The end date must be after the start date.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (updateData.isCurrent) {
        await tx.academicYear.updateMany({ where: { schoolId: school.id }, data: { isCurrent: false } });
      }
      return tx.academicYear.update({
        where: { id: year.id },
        data: updateData,
        include: { terms: true },
      });
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

academicRouter.delete("/academic-years/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, schoolId: school.id },
      include: {
        classes: {
          include: {
            sections: true,
          },
        },
      },
    });
    if (!year) throw new HttpError(404, "Academic year was not found.");

    await prisma.$transaction(async (tx) => {
      const enrollments = await tx.enrollment.findMany({
        where: { academicYearId: year.id },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);

      if (enrollmentIds.length > 0) {
        const fees = await tx.studentFee.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { id: true },
        });
        const feeIds = fees.map((f) => f.id);

        if (feeIds.length > 0) {
          await tx.payment.deleteMany({ where: { studentFeeId: { in: feeIds } } });
          await tx.studentFee.deleteMany({ where: { id: { in: feeIds } } });
        }

        await tx.attendanceRecord.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.subjectResult.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.promotionDecision.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.sectionMove.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.transferRequest.deleteMany({
          where: { OR: [{ fromEnrollmentId: { in: enrollmentIds } }, { toAcademicYearId: year.id }] },
        });
        await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
      }

      await tx.promotionBatch.deleteMany({
        where: { OR: [{ fromYearId: year.id }, { toYearId: year.id }] },
      });

      await tx.teacherAssignment.deleteMany({ where: { academicYearId: year.id } });

      const exams = await tx.exam.findMany({ where: { academicYearId: year.id }, select: { id: true } });
      const examIds = exams.map((ex) => ex.id);
      if (examIds.length > 0) {
        await tx.resultPublication.deleteMany({ where: { examId: { in: examIds } } });
        await tx.subjectResult.deleteMany({ where: { examSubject: { examId: { in: examIds } } } });
        await tx.examSubject.deleteMany({ where: { examId: { in: examIds } } });
        await tx.examSection.deleteMany({ where: { examId: { in: examIds } } });
        await tx.examClass.deleteMany({ where: { examId: { in: examIds } } });
        await tx.exam.deleteMany({ where: { id: { in: examIds } } });
      }

      const sectionIds = year.classes.flatMap((c) => c.sections.map((s) => s.id));
      if (sectionIds.length > 0) {
        await tx.sectionSubject.deleteMany({ where: { sectionId: { in: sectionIds } } });
        await tx.section.deleteMany({ where: { id: { in: sectionIds } } });
      }

      const classGroupIds = year.classes.map((c) => c.id);
      if (classGroupIds.length > 0) {
        await tx.classSubject.deleteMany({ where: { classGroupId: { in: classGroupIds } } });
        await tx.classGroup.deleteMany({ where: { id: { in: classGroupIds } } });
      }

      await tx.term.deleteMany({ where: { academicYearId: year.id } });
      await tx.academicYear.delete({ where: { id: year.id } });
    });

    res.json({ ok: true, message: `Academic year ${year.name} was deleted.` });
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/academic-years/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, schoolId: school.id },
      include: {
        terms: { orderBy: { code: "asc" } },
        classes: {
          include: {
            sections: {
              orderBy: { name: "asc" },
              include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
            },
            subjects: { include: { subject: true } },
          },
          orderBy: { level: "asc" },
        },
      },
    });
    if (!year) throw new HttpError(404, "Academic year was not found.");
    res.json({
      ...year,
      levels: levelsForSchool(school.type).map((code) => ({ code, label: levelLabel(code) })),
      classes: year.classes.map((item) => ({
        ...item,
        label: levelLabel(item.level),
        band: item.level.startsWith("CLASS_") ? "Primary" : "Secondary",
        sectionCount: item.sections.length,
        studentCount: item.sections.reduce((sum, section) => sum + section._count.enrollments, 0),
        sections: item.sections.map((section) => ({
          id: section.id,
          name: section.name,
          studentCount: section._count.enrollments,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/class-groups/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const classGroup = await prisma.classGroup.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: {
        academicYear: true,
        subjects: { include: { subject: true } },
        sections: {
          orderBy: { name: "asc" },
          include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
        },
      },
    });
    if (!classGroup) throw new HttpError(404, "Class was not found.");
    res.json({
      id: classGroup.id,
      level: classGroup.level,
      label: levelLabel(classGroup.level),
      band: classGroup.level.startsWith("CLASS_") ? "Primary" : "Secondary",
      academicYear: { id: classGroup.academicYear.id, name: classGroup.academicYear.name },
      subjects: classGroup.subjects.map((row) => row.subject),
      sections: classGroup.sections.map((section) => ({
        id: section.id,
        name: section.name,
        studentCount: section._count.enrollments,
      })),
    });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/class-groups/:id/sections", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = sectionSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter a section name.");
    const classGroup = await prisma.classGroup.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
    });
    if (!classGroup) throw new HttpError(404, "Class was not found.");
    const name = body.data.name.toUpperCase();
    const existing = await prisma.section.findUnique({
      where: { classGroupId_name: { classGroupId: classGroup.id, name } },
    });
    if (existing) throw new HttpError(409, "This section already exists.");
    const subjects = body.data.subjectIds.length
      ? await prisma.subject.findMany({
        where: { schoolId: school.id, isActive: true, id: { in: body.data.subjectIds } },
        select: { id: true },
      })
      : [];
    if (subjects.length !== new Set(body.data.subjectIds).size) {
      throw new HttpError(400, "Choose subjects created by this school.");
    }
    const section = await prisma.$transaction(async (tx) => {
      const created = await tx.section.create({
        data: {
          classGroupId: classGroup.id,
          name,
          subjects: { create: subjects.map((subject) => ({ subjectId: subject.id })) },
        },
      });
      if (subjects.length) {
        await tx.classSubject.createMany({
          data: subjects.map((subject) => ({ classGroupId: classGroup.id, subjectId: subject.id })),
          skipDuplicates: true,
        });
      }
      return created;
    });
    res.status(201).json({ id: section.id, name: section.name });
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/sections/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const section = await prisma.section.findFirst({
      where: { id: String(req.params.id), classGroup: { schoolId: school.id } },
      include: {
        subjects: { include: { subject: true } },
        classGroup: {
          include: {
            academicYear: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { rollNumber: "asc" },
          include: {
            student: {
              include: { guardians: { include: { guardian: true }, take: 1 } },
            },
          },
        },
      },
    });
    if (!section) throw new HttpError(404, "Section was not found.");
    const assignments = await prisma.teacherAssignment.findMany({
      where: { sectionId: section.id, schoolId: school.id },
      include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
    const subjects = section.subjects.map((row) => {
      const assignment = assignments.find((item) => item.subjectId === row.subjectId);
      return {
        id: row.subject.id,
        name: row.subject.name,
        code: row.subject.code,
        teacher: assignment
          ? {
              id: assignment.teacher.id,
              publicId: assignment.teacher.publicId,
              name: `${assignment.teacher.user.firstName} ${assignment.teacher.user.lastName}`,
              phone: assignment.teacher.phone,
            }
          : null,
      };
    });
    const teachers = [...new Map(
      assignments.map((item) => [
        item.teacher.id,
        {
          id: item.teacher.id,
          publicId: item.teacher.publicId,
          name: `${item.teacher.user.firstName} ${item.teacher.user.lastName}`,
          phone: item.teacher.phone,
          email: item.teacher.user.email,
          subjects: assignments
            .filter((row) => row.teacherId === item.teacherId)
            .map((row) => subjects.find((subject) => subject.id === row.subjectId)?.name)
            .filter(Boolean),
        },
      ]),
    ).values()];
    const availableSubjects = await prisma.subject.findMany({
      where: {
        schoolId: school.id,
        isActive: true,
        id: { notIn: section.subjects.map((row) => row.subjectId) },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
    res.json({
      id: section.id,
      name: section.name,
      label: `${levelLabel(section.classGroup.level)} · Section ${section.name}`,
      classLabel: levelLabel(section.classGroup.level),
      academicYear: { id: section.classGroup.academicYear.id, name: section.classGroup.academicYear.name },
      classGroupId: section.classGroupId,
      totals: {
        students: section.enrollments.length,
        teachers: teachers.length,
        subjects: subjects.length,
      },
      students: section.enrollments.map((enrollment) => {
        const guardian = enrollment.student.guardians[0]?.guardian;
        return {
          id: enrollment.student.id,
          permanentId: enrollment.student.permanentId,
          name: `${enrollment.student.firstName} ${enrollment.student.fatherName} ${enrollment.student.grandfatherName}`,
          gender: enrollment.student.gender,
          photoUrl: studentPhotoPath(enrollment.student.id, enrollment.student.photoUrl, enrollment.student.photoStorageKey),
          rollNumber: enrollment.rollNumber,
          studentNumber: enrollment.studentNumber,
          parent: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
        };
      }),
      teachers,
      subjects,
      availableSubjects,
    });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/sections/:id/subjects", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = sectionSubjectsSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose at least one subject.");
    const section = await prisma.section.findFirst({
      where: { id: String(req.params.id), classGroup: { schoolId: school.id } },
      include: { classGroup: true },
    });
    if (!section) throw new HttpError(404, "Section was not found.");
    const subjects = await prisma.subject.findMany({
      where: { schoolId: school.id, isActive: true, id: { in: body.data.subjectIds } },
      select: { id: true },
    });
    if (subjects.length !== new Set(body.data.subjectIds).size) {
      throw new HttpError(400, "Choose subjects created by this school.");
    }
    await prisma.$transaction([
      prisma.sectionSubject.createMany({
        data: subjects.map((subject) => ({ sectionId: section.id, subjectId: subject.id })),
        skipDuplicates: true,
      }),
      prisma.classSubject.createMany({
        data: subjects.map((subject) => ({ classGroupId: section.classGroupId, subjectId: subject.id })),
        skipDuplicates: true,
      }),
    ]);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

academicRouter.patch("/sections/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const section = await prisma.section.findFirst({
      where: { id: String(req.params.id), classGroup: { schoolId: school.id } },
      include: { classGroup: true, subjects: true },
    });
    if (!section) throw new HttpError(404, "Section was not found.");

    const updateSectionSchema = z.object({
      name: z.string().trim().min(1).max(20).optional(),
      subjectIds: z.array(z.string()).optional(),
    });
    const body = updateSectionSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Invalid section update payload.");

    const updated = await prisma.$transaction(async (tx) => {
      let nextName = section.name;
      if (body.data.name && body.data.name.toUpperCase() !== section.name) {
        nextName = body.data.name.toUpperCase();
        const duplicate = await tx.section.findUnique({
          where: { classGroupId_name: { classGroupId: section.classGroupId, name: nextName } },
        });
        if (duplicate) throw new HttpError(409, `Section ${nextName} already exists in this class.`);
      }

      if (body.data.subjectIds) {
        const subjects = await tx.subject.findMany({
          where: { schoolId: school.id, isActive: true, id: { in: body.data.subjectIds } },
          select: { id: true },
        });
        await tx.sectionSubject.deleteMany({ where: { sectionId: section.id } });
        if (subjects.length > 0) {
          await tx.sectionSubject.createMany({
            data: subjects.map((s) => ({ sectionId: section.id, subjectId: s.id })),
          });
          await tx.classSubject.createMany({
            data: subjects.map((s) => ({ classGroupId: section.classGroupId, subjectId: s.id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.section.update({
        where: { id: section.id },
        data: { name: nextName },
      });
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

academicRouter.delete("/sections/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const section = await prisma.section.findFirst({
      where: { id: String(req.params.id), classGroup: { schoolId: school.id } },
    });
    if (!section) throw new HttpError(404, "Section was not found.");

    await prisma.$transaction(async (tx) => {
      const enrollments = await tx.enrollment.findMany({
        where: { sectionId: section.id },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);

      if (enrollmentIds.length > 0) {
        const fees = await tx.studentFee.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { id: true },
        });
        const feeIds = fees.map((f) => f.id);

        if (feeIds.length > 0) {
          await tx.payment.deleteMany({ where: { studentFeeId: { in: feeIds } } });
          await tx.studentFee.deleteMany({ where: { id: { in: feeIds } } });
        }

        await tx.attendanceRecord.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.subjectResult.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.promotionDecision.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        await tx.sectionMove.deleteMany({
          where: { OR: [{ enrollmentId: { in: enrollmentIds } }, { fromSectionId: section.id }, { toSectionId: section.id }] },
        });
        await tx.transferRequest.deleteMany({
          where: { OR: [{ fromEnrollmentId: { in: enrollmentIds } }, { toSectionId: section.id }] },
        });
        await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
      }

      await tx.teacherAssignment.deleteMany({ where: { sectionId: section.id } });
      await tx.examSection.deleteMany({ where: { sectionId: section.id } });
      await tx.sectionSubject.deleteMany({ where: { sectionId: section.id } });
      await tx.section.delete({ where: { id: section.id } });
    });

    res.json({ ok: true, message: `Section ${section.name} was deleted.` });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/academic-years/:id/classes", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = classSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a class.");
    const allowed = levelsForSchool(school.type);
    if (!allowed.includes(body.data.level)) {
      throw new HttpError(400, "That class is not available for this school.");
    }
    const year = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId: school.id } });
    if (!year) throw new HttpError(404, "Academic year was not found.");
    const already = await prisma.classGroup.findUnique({
      where: { academicYearId_level: { academicYearId: year.id, level: body.data.level } },
    });
    if (already) throw new HttpError(409, `${levelLabel(body.data.level)} already exists for this academic year.`);
    const subjects = await prisma.subject.findMany({
      where: { schoolId: school.id, id: { in: body.data.subjectIds }, isActive: true },
    });
    if (subjects.length !== body.data.subjectIds.length) {
      throw new HttpError(400, "Choose subjects that already exist for this school.");
    }
    const created = await prisma.classGroup.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        level: body.data.level,
        subjects: { create: subjects.map((subject) => ({ subjectId: subject.id })) },
      },
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});
