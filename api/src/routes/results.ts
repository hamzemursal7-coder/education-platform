import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { loadExaminations, type PublishedMark } from "../lib/examAverages.js";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const subjectPickSchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().min(1),
  examDay: z.string().optional(),
});

const examSchema = z.object({
  academicYearId: z.string().min(1),
  term: z.enum(["TERM_1", "TERM_2"]),
  generalMax: z.union([z.literal(50), z.literal(100)]),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  passMark: z.number().int().min(0).max(100).optional(),
  sectionIds: z.array(z.string().min(1)).min(1),
  subjects: z.array(subjectPickSchema).min(1),
});

const examSubjectSchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().min(1),
  maxMarks: z.number().int().positive(),
  minMarks: z.number().int().min(0),
});

const saveSchema = z.object({
  examSubjectId: z.string().min(1),
  rows: z.array(
    z.object({
      enrollmentId: z.string(),
      marks: z.number().int().min(0).nullable(),
      isAbsent: z.boolean(),
      comment: z.string().optional(),
    }),
  ),
});

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

function parseDay(value: string, label: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${label} is not a valid date.`);
  return date;
}

function hasEnteredMarks() {
  return {
    OR: [{ marks: { not: null } }, { isAbsent: true }, { state: { not: "DRAFT" as const } }],
  };
}

async function syncExamScope(
  examId: string,
  schoolId: string,
  academicYearId: string,
  generalMax: number,
  start: Date,
  end: Date,
  sectionIds: string[],
  subjects: Array<{ classGroupId: string; subjectId: string; examDay?: string }>,
  passMark: number,
) {
  const uniqueSections = [...new Set(sectionIds)];
  const sections = await prisma.section.findMany({
    where: { id: { in: uniqueSections }, classGroup: { schoolId, academicYearId } },
    include: { classGroup: { include: { subjects: true } }, subjects: true },
  });
  if (sections.length !== uniqueSections.length) throw new HttpError(400, "Choose sections from the selected academic year.");
  const classIds = [...new Set(sections.map((section) => section.classGroupId))];
  const allowedSubjects = new Set<string>();
  for (const section of sections) {
    for (const row of section.classGroup.subjects) allowedSubjects.add(`${section.classGroupId}|${row.subjectId}`);
    for (const row of section.subjects) allowedSubjects.add(`${section.classGroupId}|${row.subjectId}`);
  }
  const uniqueSubjects = new Map<string, { classGroupId: string; subjectId: string; examDay?: string }>();
  for (const subject of subjects) {
    const key = `${subject.classGroupId}|${subject.subjectId}`;
    if (!classIds.includes(subject.classGroupId) || !allowedSubjects.has(key)) {
      throw new HttpError(400, "Choose subjects that belong to the selected classes.");
    }
    if (subject.examDay) {
      const day = parseDay(subject.examDay, "Subject day");
      if (day < start || day > end) throw new HttpError(400, "Each subject day must fall between the exam start and end.");
    }
    uniqueSubjects.set(key, subject);
  }
  if (!uniqueSubjects.size) throw new HttpError(400, "Choose at least one subject.");

  const existingSections = await prisma.examSection.findMany({ where: { examId } });
  const keepSections = new Set(uniqueSections);
  for (const row of existingSections) {
    if (keepSections.has(row.sectionId)) continue;
    const used = await prisma.subjectResult.count({
      where: { enrollment: { sectionId: row.sectionId }, examSubject: { examId }, ...hasEnteredMarks() },
    });
    if (used) throw new HttpError(400, "A section that already has marks cannot be removed.");
    await prisma.examSection.delete({ where: { examId_sectionId: { examId, sectionId: row.sectionId } } });
  }
  for (const sectionId of uniqueSections) {
    await prisma.examSection.upsert({
      where: { examId_sectionId: { examId, sectionId } },
      update: {},
      create: { examId, sectionId },
    });
  }

  const existingClasses = await prisma.examClass.findMany({ where: { examId } });
  for (const row of existingClasses) {
    if (classIds.includes(row.classGroupId)) continue;
    const used = await prisma.subjectResult.count({
      where: { examSubject: { examId, classGroupId: row.classGroupId }, ...hasEnteredMarks() },
    });
    if (used) throw new HttpError(400, "A class that already has marks cannot be removed.");
    await prisma.examSubject.deleteMany({ where: { examId, classGroupId: row.classGroupId } });
    await prisma.examClass.delete({ where: { examId_classGroupId: { examId, classGroupId: row.classGroupId } } });
  }
  for (const classGroupId of classIds) {
    await prisma.examClass.upsert({
      where: { examId_classGroupId: { examId, classGroupId } },
      update: {},
      create: { examId, classGroupId },
    });
  }

  const existingSubjects = await prisma.examSubject.findMany({ where: { examId } });
  for (const row of existingSubjects) {
    if (uniqueSubjects.has(`${row.classGroupId}|${row.subjectId}`)) continue;
    const used = await prisma.subjectResult.count({ where: { examSubjectId: row.id, ...hasEnteredMarks() } });
    if (used) throw new HttpError(400, "A subject that already has marks cannot be removed.");
    await prisma.examSubject.delete({ where: { id: row.id } });
  }
  for (const subject of uniqueSubjects.values()) {
    const examDay = subject.examDay ? parseDay(subject.examDay, "Subject day") : null;
    await prisma.examSubject.upsert({
      where: {
        examId_classGroupId_subjectId: {
          examId,
          classGroupId: subject.classGroupId,
          subjectId: subject.subjectId,
        },
      },
      update: { examDay, maxMarks: generalMax, minMarks: passMark },
      create: {
        examId,
        classGroupId: subject.classGroupId,
        subjectId: subject.subjectId,
        maxMarks: generalMax,
        minMarks: passMark,
        examDay,
      },
    });
  }
}

export const resultsRouter = Router();

resultsRouter.post("/exams", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = examSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the year, start, end, sections, and subjects.");
    const startDate = parseDay(body.data.startDate, "Start date");
    const endDate = parseDay(body.data.endDate, "End date");
    if (endDate < startDate) throw new HttpError(400, "The exam end must be on or after the start.");
    const year = await prisma.academicYear.findFirst({ where: { id: body.data.academicYearId, schoolId: school.id } });
    if (!year) throw new HttpError(404, "Academic year was not found.");
    const existing = await prisma.exam.findUnique({
      where: { academicYearId_term: { academicYearId: year.id, term: body.data.term } },
    });
    if (existing) throw new HttpError(409, "This term exam already exists. Edit it instead.");
    const exam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        term: body.data.term,
        generalMax: body.data.generalMax,
        examDate: startDate,
        endDate,
      },
    });
    const passMark = body.data.passMark ?? Math.round(body.data.generalMax / 2);
    if (passMark > body.data.generalMax) throw new HttpError(400, "The pass mark cannot be higher than the maximum.");
    await syncExamScope(exam.id, school.id, year.id, body.data.generalMax, startDate, endDate, body.data.sectionIds, body.data.subjects, passMark);
    res.status(201).json(exam);
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/exams/:id/subjects", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = examSubjectSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Subject maximum and minimum marks are required.");
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    if (body.data.maxMarks > exam.generalMax || body.data.minMarks > body.data.maxMarks) {
      throw new HttpError(400, `Marks must stay within 0 and the exam maximum of ${exam.generalMax}.`);
    }
    const onClass = await prisma.classSubject.findUnique({
      where: { classGroupId_subjectId: { classGroupId: body.data.classGroupId, subjectId: body.data.subjectId } },
    });
    if (!onClass) throw new HttpError(400, "That subject is not on the selected class.");
    const row = await prisma.examSubject.upsert({
      where: {
        examId_classGroupId_subjectId: {
          examId: exam.id,
          classGroupId: body.data.classGroupId,
          subjectId: body.data.subjectId,
        },
      },
      update: { maxMarks: body.data.maxMarks, minMarks: body.data.minMarks },
      create: { examId: exam.id, ...body.data },
    });
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/exams", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exams = await prisma.exam.findMany({
      where: { schoolId: school.id },
      include: {
        classes: { include: { classGroup: true } },
        sections: true,
        subjects: { include: { results: { select: { state: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      schoolType: school.type,
      exams: exams.map((exam) => {
      const counts = { draft: 0, submitted: 0, verified: 0, published: 0, rejected: 0 };
      for (const subject of exam.subjects) {
        for (const result of subject.results) {
          if (result.state === "DRAFT") counts.draft += 1;
          else if (result.state === "SUBMITTED") counts.submitted += 1;
          else if (result.state === "VERIFIED") counts.verified += 1;
          else if (result.state === "PUBLISHED") counts.published += 1;
          else if (result.state === "REJECTED") counts.rejected += 1;
        }
      }
      return {
        id: exam.id,
        academicYearId: exam.academicYearId,
        term: exam.term,
        startDate: exam.examDate,
        endDate: exam.endDate,
        generalMax: exam.generalMax,
        passMark: exam.subjects[0]?.minMarks ?? Math.round(exam.generalMax / 2),
        classGroupIds: exam.classes.map((row) => row.classGroupId),
        sectionIds: exam.sections.map((row) => row.sectionId),
        classes: exam.classes.map((row) => ({ id: row.classGroupId, label: levelLabel(row.classGroup.level) })),
        subjects: exam.subjects.map((row) => ({
          classGroupId: row.classGroupId,
          subjectId: row.subjectId,
          examDay: row.examDay,
        })),
        counts,
      };
    }),
    });
  } catch (error) {
    next(error);
  }
});

resultsRouter.patch("/exams/:id", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = examSchema.omit({ academicYearId: true, term: true }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the start, end, sections, and subjects.");
    const startDate = parseDay(body.data.startDate, "Start date");
    const endDate = parseDay(body.data.endDate, "End date");
    if (endDate < startDate) throw new HttpError(400, "The exam end must be on or after the start.");
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    await prisma.exam.update({
      where: { id: exam.id },
      data: { examDate: startDate, endDate, generalMax: body.data.generalMax },
    });
    const passMark = body.data.passMark ?? Math.round(body.data.generalMax / 2);
    if (passMark > body.data.generalMax) throw new HttpError(400, "The pass mark cannot be higher than the maximum.");
    await syncExamScope(exam.id, school.id, exam.academicYearId, body.data.generalMax, startDate, endDate, body.data.sectionIds, body.data.subjects, passMark);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/exams/:id/review", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await prisma.exam.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: {
        sections: true,
        classes: { include: { classGroup: { include: { sections: { orderBy: { name: "asc" } } } } } },
        subjects: { include: { results: { include: { enrollment: { include: { student: true, section: true } } } } } },
      },
    });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const subjectIds = [...new Set(exam.subjects.map((row) => row.subjectId))];
    const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    const subjectName = new Map(subjects.map((row) => [row.id, row.name]));
    const selectedSections = new Set(exam.sections.map((row) => row.sectionId));
    const sectionSubjects = await prisma.sectionSubject.findMany({
      where: { sectionId: { in: [...selectedSections] } },
      select: { sectionId: true, subjectId: true },
    });
    const teachers = await prisma.teacherAssignment.findMany({
      where: { schoolId: school.id, sectionId: { in: [...selectedSections] }, subjectId: { in: subjectIds } },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: school.id,
        academicYearId: exam.academicYearId,
        status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] },
        sectionId: { in: [...selectedSections] },
      },
      include: { student: true, section: true },
      orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }],
    });
    res.json({
      classes: exam.classes.map((row) => ({
        id: row.classGroupId,
        label: levelLabel(row.classGroup.level),
        sections: row.classGroup.sections.filter((section) => selectedSections.has(section.id)).map((section) => ({
          name: section.name,
          subjectIds: sectionSubjects.filter((item) => item.sectionId === section.id).map((item) => item.subjectId),
        })),
        subjects: exam.subjects
          .filter((subject) => subject.classGroupId === row.classGroupId)
          .map((subject) => ({
            id: subject.id,
            subjectId: subject.subjectId,
            name: subjectName.get(subject.subjectId) ?? "Subject",
            maxMarks: subject.maxMarks,
            minMarks: subject.minMarks,
            examDay: subject.examDay,
            teacher: teacherName(teachers, [...selectedSections], subject.subjectId),
            rows: enrollments
              .filter((enrollment) => enrollment.classGroupId === row.classGroupId)
              .map((enrollment) => {
                const result = subject.results.find((item) => item.enrollmentId === enrollment.id);
                const state = result?.state ?? "WAITING";
                return {
                  id: result?.id ?? null,
                  enrollmentId: enrollment.id,
                  student: `${enrollment.student.firstName} ${enrollment.student.fatherName}`,
                  permanentId: enrollment.student.permanentId,
                  section: enrollment.section.name,
                  rollNumber: enrollment.rollNumber,
                  marks: result?.marks ?? null,
                  isAbsent: result?.isAbsent ?? false,
                  comment: result?.comment ?? null,
                  state,
                  rejectReason: result?.rejectReason ?? null,
                  submittedAt: result?.submittedAt ?? null,
                  publishedAt: result?.publishedAt ?? null,
                  issue: markIssue(result, subject.minMarks, subject.maxMarks),
                };
              }),
          })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/exams/:id/admin-marks", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = saveSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Marks could not be saved.");
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const examSubject = await prisma.examSubject.findFirst({ where: { id: body.data.examSubjectId, examId: exam.id } });
    if (!examSubject) throw new HttpError(404, "This subject is not on the exam.");
    let saved = 0;
    for (const row of body.data.rows) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          id: row.enrollmentId,
          schoolId: school.id,
          academicYearId: exam.academicYearId,
          classGroupId: examSubject.classGroupId,
          status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] },
        },
      });
      if (!enrollment) continue;
      const current = await prisma.subjectResult.findUnique({
        where: { enrollmentId_examSubjectId: { enrollmentId: enrollment.id, examSubjectId: examSubject.id } },
      });
      if (!row.isAbsent && row.marks !== null && (row.marks < 0 || row.marks > examSubject.maxMarks)) {
        throw new HttpError(400, `Marks must be from 0 to ${examSubject.maxMarks}.`);
      }
      const keepPublished = current?.state === "PUBLISHED";
      await prisma.subjectResult.upsert({
        where: { enrollmentId_examSubjectId: { enrollmentId: enrollment.id, examSubjectId: examSubject.id } },
        create: {
          enrollmentId: enrollment.id,
          examSubjectId: examSubject.id,
          marks: row.isAbsent ? null : row.marks,
          isAbsent: row.isAbsent,
          state: "SUBMITTED",
          submittedAt: new Date(),
        },
        update: {
          marks: row.isAbsent ? null : row.marks,
          isAbsent: row.isAbsent,
          state: keepPublished ? "PUBLISHED" : "SUBMITTED",
          submittedAt: new Date(),
          publishedAt: keepPublished ? new Date() : current?.publishedAt,
          editAllowed: false,
        },
      });
      saved += 1;
    }
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "MARKS_ENTERED",
      entityType: "Exam",
      entityId: exam.id,
      summary: `School admin entered ${saved} mark${saved === 1 ? "" : "s"}`,
    });
    res.json({ saved });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/exams/:id/submissions", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await prisma.exam.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: {
        sections: { include: { section: { include: { classGroup: true } } } },
        subjects: true,
      },
    });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const sectionIds = exam.sections.map((row) => row.sectionId);
    const subjectIds = [...new Set(exam.subjects.map((row) => row.subjectId))];
    const [subjects, teachers, enrollments, results] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
      prisma.teacherAssignment.findMany({
        where: { schoolId: school.id, sectionId: { in: sectionIds }, subjectId: { in: subjectIds } },
        include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      prisma.enrollment.findMany({
        where: { schoolId: school.id, academicYearId: exam.academicYearId, status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] }, sectionId: { in: sectionIds } },
        select: { id: true, sectionId: true, classGroupId: true },
      }),
      prisma.subjectResult.findMany({
        where: { examSubject: { examId: exam.id }, enrollment: { sectionId: { in: sectionIds }, status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] } } },
        include: { examSubject: true, enrollment: true },
      }),
    ]);
    const subjectName = new Map(subjects.map((row) => [row.id, row.name]));
    const rows = exam.sections.map((examSection) => {
      const section = examSection.section;
      const level = section.classGroup.level;
      const students = enrollments.filter((row) => row.sectionId === section.id);
      const subjectRows = exam.subjects
        .filter((subject) => subject.classGroupId === section.classGroupId)
        .map((subject) => {
          const marks = results.filter((row) => row.examSubjectId === subject.id && row.enrollment.sectionId === section.id);
          const byStudent = new Map(marks.map((row) => [row.enrollmentId, row]));
          const studentRows = students.map((student) => byStudent.get(student.id));
          const submittedStudents = studentRows.filter((row) => row && ["SUBMITTED", "VERIFIED", "PUBLISHED", "REJECTED"].includes(row.state)).length;
          const errors = studentRows.filter((row) => row && markIssue(row, subject.minMarks, subject.maxMarks) && row.state !== "DRAFT" && row.state !== "PUBLISHED").length;
          const status = subjectBoardStatus(studentRows.map((row) => row?.state ?? "WAITING"));
          const latest = marks
            .map((row) => row.publishedAt ?? row.reviewedAt ?? row.submittedAt)
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
          const teacher = teachers.find((row) => row.sectionId === section.id && row.subjectId === subject.subjectId);
          return {
            id: subject.id,
            name: subjectName.get(subject.subjectId) ?? "Subject",
            teacher: teacher ? `${teacher.teacher.user.firstName} ${teacher.teacher.user.lastName}` : null,
            status,
            students: students.length,
            submittedStudents,
            missingStudents: Math.max(students.length - submittedStudents, 0),
            errors,
            submittedAt: latest?.toISOString() ?? null,
          };
        });
      const required = subjectRows.length;
      const submittedSubjects = subjectRows.filter((row) => row.status !== "NOT_SUBMITTED" && row.status !== "IN_PROGRESS").length;
      return {
        classGroupId: section.classGroupId,
        sectionId: section.id,
        level,
        stage: level.startsWith("FORM") ? "SECONDARY" : "PRIMARY",
        classLabel: levelLabel(level),
        section: section.name,
        requiredSubjects: required,
        submittedSubjects,
        pendingSubjects: Math.max(required - submittedSubjects, 0),
        progress: required ? Math.round((submittedSubjects / required) * 100) : 0,
        status: sectionBoardStatus(subjectRows.map((row) => row.status)),
        updatedAt: subjectRows.map((row) => row.submittedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
        subjects: subjectRows,
      };
    }).sort((a, b) => a.classLabel.localeCompare(b.classLabel) || a.section.localeCompare(b.section));
    const year = await prisma.academicYear.findUnique({ where: { id: exam.academicYearId } });
    res.json({
      schoolType: school.type,
      examId: exam.id,
      year: year?.name ?? "",
      term: exam.term,
      rows,
    });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/exams/:id/published", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const rows = await prisma.subjectResult.findMany({
      where: {
        state: "PUBLISHED",
        examSubject: { examId: exam.id, exam: { schoolId: school.id } },
        enrollment: { schoolId: school.id, status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] } },
      },
      include: { enrollment: { include: { student: true, section: true, classGroup: true } }, examSubject: true },
      orderBy: [{ enrollment: { classGroupId: "asc" } }, { enrollment: { rollNumber: "asc" } }],
    });
    const subjects = await prisma.subject.findMany({ where: { id: { in: rows.map((row) => row.examSubject.subjectId) } } });
    const names = new Map(subjects.map((row) => [row.id, row.name]));
    res.json(rows.map((row) => ({
      classLabel: levelLabel(row.enrollment.classGroup.level),
      stage: row.enrollment.classGroup.level.startsWith("FORM") ? "SECONDARY" : "PRIMARY",
      section: row.enrollment.section.name,
      student: `${row.enrollment.student.firstName} ${row.enrollment.student.fatherName}`,
      permanentId: row.enrollment.student.permanentId,
      subject: names.get(row.examSubject.subjectId) ?? "Subject",
      marks: row.isAbsent ? null : row.marks,
      isAbsent: row.isAbsent,
      maxMarks: row.examSubject.maxMarks,
      publishedAt: row.publishedAt,
    })));
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/exams/:id/accept-submitted", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const rows = await prisma.subjectResult.findMany({
      where: { examSubject: { examId: exam.id }, state: "SUBMITTED" },
      include: { examSubject: true },
    });
    const valid = rows.filter((row) => markIsValid(row, row.examSubject));
    const reviewedAt = new Date();
    if (valid.length) {
      await prisma.subjectResult.updateMany({
        where: { id: { in: valid.map((row) => row.id) }, state: "SUBMITTED" },
        data: { state: "VERIFIED", reviewedByUserId: req.authUser!.id, reviewedAt, editAllowed: false },
      });
      await writeAudit({
        schoolId: school.id,
        actorUserId: req.authUser!.id,
        action: "MARKS_APPROVE",
        entityType: "Exam",
        entityId: exam.id,
        summary: `Approved ${valid.length} submitted mark${valid.length === 1 ? "" : "s"}. ${rows.length - valid.length} incomplete mark${rows.length - valid.length === 1 ? "" : "s"} left for review.`,
      });
    }
    res.json({ accepted: valid.length, skipped: rows.length - valid.length });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/exams/:id/publish-preview", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await ownedExam(school.id, String(req.params.id));
    res.json(await publicationScope(exam.id));
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/exams/:id/publish-accepted", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const exam = await prisma.exam.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!exam) throw new HttpError(404, "Exam was not found.");
    const published = await publishApprovedMarks(school.id, exam.id, req.authUser!.id);
    res.json(published);
  } catch (error) {
    next(error);
  }
});

const enrollmentStatusLabel: Record<string, string> = {
  ACTIVE: "Active Student",
  PROMOTED: "Promoted",
  RETAINED: "Retained",
  ALUMNI: "Alumni",
  TRANSFERRED: "Transferred",
};


resultsRouter.get("/student/results", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) throw new HttpError(403, "You are not allowed to access this record.");
    const empty = { student: null, years: [], year: null, terms: [], yearAverage: null, yearSubjectCount: 0 };
    if (!user.personKey && !user.phone) {
      res.json(empty);
      return;
    }
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          ...(user.personKey ? [{ permanentId: user.personKey }, { secondaryPermanentId: user.personKey }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
      include: {
        guardians: {
          include: {
            guardian: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                nationalId: true,
              },
            },
          },
        },
        enrollments: {
          where: user.schoolId ? { schoolId: user.schoolId } : {},
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
          orderBy: { academicYear: { startDate: "desc" } },
        },
      },
    });
    if (!student) {
      res.json(empty);
      return;
    }
    const requestedYear = typeof req.query.academicYearId === "string" ? req.query.academicYearId : "";
    const enrollment = student.enrollments.find((row) => row.academicYearId === requestedYear)
      ?? student.enrollments.find((row) => row.academicYear.isCurrent)
      ?? student.enrollments[0];
    if (!enrollment) {
      res.json({
        ...empty,
        student: {
          name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim(),
          firstName: student.firstName,
          fatherName: student.fatherName,
          grandfatherName: student.grandfatherName,
          permanentId: student.secondaryPermanentId ?? student.permanentId,
          photoUrl: student.photoUrl,
          dateOfBirth: student.dateOfBirth,
          email: user.email,
          phone: student.phone ?? user.phone ?? null,
          nationalId: student.nationalId ?? null,
          gender: student.gender ?? null,
          status: student.status ?? "ACTIVE",
          rollNumber: null,
          initials: `${student.firstName[0] ?? ""}${student.grandfatherName[0] ?? student.fatherName[0] ?? ""}`.toUpperCase(),
          guardians: (student.guardians ?? []).map((g) => ({
            relationship: g.relationship,
            name: `${g.guardian.firstName} ${g.guardian.lastName}`.trim(),
            phone: g.guardian.phone,
            email: g.guardian.email,
            nationalId: g.guardian.nationalId,
          })),
        },
      });
      return;
    }
    const names = new Map<string, string>();
    for (const row of enrollment.section.subjects) names.set(row.subjectId, row.subject.name);
    for (const row of enrollment.classGroup.subjects) names.set(row.subjectId, row.subject.name);
    const publishedMarks: PublishedMark[] = enrollment.results.map((row) => ({
      enrollmentId: enrollment.id,
      examSubjectId: row.examSubjectId,
      marks: row.isAbsent ? null : row.marks,
      isAbsent: row.isAbsent,
    }));
    const [assignments, examinations] = await Promise.all([
      prisma.teacherAssignment.findMany({
        where: {
          schoolId: enrollment.schoolId,
          academicYearId: enrollment.academicYearId,
          sectionId: enrollment.sectionId,
        },
        include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      loadExaminations(prisma, [{
        id: enrollment.id,
        academicYearId: enrollment.academicYearId,
        classGroupId: enrollment.classGroupId,
        sectionId: enrollment.sectionId,
        sectionSubjectIds: enrollment.section.subjects.map((row) => row.subjectId),
      }], publishedMarks, names),
    ]);
    const examination = examinations.get(enrollment.id);
    const teachers = [...new Set(assignments.map((row) => `${row.teacher.user.firstName} ${row.teacher.user.lastName}`.trim()).filter(Boolean))];
    const terms = (["TERM_1", "TERM_2"] as const).map((term) => {
      const summary = term === "TERM_1" ? examination?.term1 : examination?.term2;
      const published = enrollment.results.filter((row) => row.examSubject.exam.term === term && row.examSubject.exam.academicYearId === enrollment.academicYearId);
      const publishedAt = published.reduce<Date | null>((latest, row) => {
        if (!row.publishedAt) return latest;
        if (!latest || row.publishedAt > latest) return row.publishedAt;
        return latest;
      }, null);
      return {
        term,
        label: summary?.label ?? (term === "TERM_1" ? "Term 1" : "Term 2"),
        examConfigured: (summary?.subjectCount ?? 0) > 0,
        published: (summary?.publishedCount ?? 0) > 0,
        publishedAt: publishedAt ? publishedAt.toISOString() : null,
        examLabel: (summary?.subjectCount ?? 0) > 0 ? "Term exam" : null,
        average: summary?.average ?? null,
        status: summary?.status ?? "unavailable",
        subjectCount: summary?.subjectCount ?? 0,
        publishedCount: summary?.publishedCount ?? 0,
        pendingCount: summary?.pendingCount ?? 0,
        obtained: summary?.obtained ?? 0,
        possible: summary?.possible ?? 0,
        subjects: (summary?.subjects ?? []).map((row) => ({
          subject: row.name,
          maxMarks: row.maxMarks,
          marks: row.marks,
          isAbsent: row.absent,
          pending: row.pending,
          percentage: row.percentage,
        })),
      };
    });
    const overall = examination?.overall;
    res.json({
      student: {
        name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim(),
        firstName: student.firstName,
        fatherName: student.fatherName,
        grandfatherName: student.grandfatherName,
        permanentId: student.secondaryPermanentId ?? student.permanentId,
        photoUrl: student.photoUrl,
        dateOfBirth: student.dateOfBirth,
        email: user.email,
        phone: student.phone ?? user.phone ?? null,
        nationalId: student.nationalId ?? null,
        gender: student.gender ?? null,
        status: student.status ?? "ACTIVE",
        rollNumber: enrollment.rollNumber,
        initials: `${student.firstName[0] ?? ""}${student.grandfatherName[0] ?? student.fatherName[0] ?? ""}`.toUpperCase(),
        guardians: (student.guardians ?? []).map((g) => ({
          relationship: g.relationship,
          name: `${g.guardian.firstName} ${g.guardian.lastName}`.trim(),
          phone: g.guardian.phone,
          email: g.guardian.email,
          nationalId: g.guardian.nationalId,
        })),
      },
      years: student.enrollments.map((row) => ({
        id: row.academicYearId,
        name: row.academicYear.name,
        isCurrent: row.academicYear.isCurrent,
      })),
      year: {
        id: enrollment.academicYearId,
        name: enrollment.academicYear.name,
        isCurrent: enrollment.academicYear.isCurrent,
        school: enrollment.school.name,
        level: levelLabel(enrollment.classGroup.level),
        section: enrollment.section.name,
        status: enrollmentStatusLabel[enrollment.status] ?? enrollment.status,
        teachers,
      },
      terms,
      yearAverage: overall?.average ?? null,
      yearStatus: overall?.status ?? "unavailable",
      yearObtained: overall?.obtained ?? 0,
      yearPossible: overall?.possible ?? 0,
      yearSubjectCount: overall?.subjectCount ?? 0,
      yearPublishedCount: overall?.publishedCount ?? 0,
      yearPendingCount: overall?.pendingCount ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/result-sheets", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const sectionId = String(req.query.sectionId ?? "");
    const subjectId = String(req.query.subjectId ?? "");
    const examId = String(req.query.examId ?? "");
    const section = await prisma.section.findFirst({ where: { id: sectionId, classGroup: { schoolId: school.id } } });
    if (!section) throw new HttpError(404, "Section was not found.");
    const examSubject = await prisma.examSubject.findFirst({
      where: { examId, subjectId, classGroupId: section.classGroupId, exam: { schoolId: school.id } },
    });
    if (!examSubject) {
      res.json([]);
      return;
    }
    const rows = await prisma.subjectResult.findMany({
      where: { examSubjectId: examSubject.id, enrollment: { sectionId } },
      include: { enrollment: { include: { student: true } } },
      orderBy: { enrollment: { rollNumber: "asc" } },
    });
    res.json(rows.map((row) => ({
      id: row.id,
      student: `${row.enrollment.student.firstName} ${row.enrollment.student.fatherName}`,
      rollNumber: row.enrollment.rollNumber,
      marks: row.marks,
      isAbsent: row.isAbsent,
      comment: row.comment,
      state: row.state,
      rejectReason: row.rejectReason,
    })));
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/result-sheets/:id/publish", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    if (String(req.params.id) === "publish") {
      next("route");
      return;
    }
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await ownedResult(school.id, String(req.params.id));
    if (row.state !== "VERIFIED") throw new HttpError(400, "Approve the mark before publishing it.");
    const examSubject = await prisma.examSubject.findUnique({ where: { id: row.examSubjectId } });
    if (!examSubject || !markIsValid(row, examSubject)) throw new HttpError(400, "This mark is incomplete and cannot be published.");
    await prisma.subjectResult.update({
      where: { id: row.id, state: "VERIFIED" },
      data: { state: "PUBLISHED", publishedByUserId: req.authUser!.id, publishedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/exam-subjects/:id/publish", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: String(req.params.id), exam: { schoolId: school.id } },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject was not found.");
    const ready = await prisma.subjectResult.findMany({
      where: { examSubjectId: examSubject.id, state: "VERIFIED" },
    });
    const validIds = ready.filter((row) => markIsValid(row, examSubject)).map((row) => row.id);
    const updated = validIds.length
      ? await prisma.subjectResult.updateMany({
        where: { id: { in: validIds }, state: "VERIFIED" },
        data: { state: "PUBLISHED", publishedByUserId: req.authUser!.id, publishedAt: new Date() },
      })
      : { count: 0 };
    res.json({ published: updated.count });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/result-sheets/:id/verify", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await ownedResult(school.id, String(req.params.id));
    if (row.state !== "SUBMITTED") throw new HttpError(400, "Only a submitted mark can be approved.");
    const examSubject = await prisma.examSubject.findUnique({ where: { id: row.examSubjectId } });
    if (!examSubject || !markIsValid(row, examSubject)) throw new HttpError(400, "This mark is incomplete and cannot be approved.");
    await prisma.subjectResult.update({
      where: { id: row.id, state: "SUBMITTED" },
      data: { state: "VERIFIED", reviewedByUserId: req.authUser!.id, reviewedAt: new Date(), editAllowed: false },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "MARKS_APPROVE",
      entityType: "SubjectResult",
      entityId: row.id,
      summary: "Approved one submitted mark.",
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/result-sheets/:id/reject", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const reason = z.object({ reason: z.string().trim().min(3) }).safeParse(req.body);
    if (!reason.success) throw new HttpError(400, "A reason is required.");
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await ownedResult(school.id, String(req.params.id));
    if (row.state !== "SUBMITTED") throw new HttpError(400, "Only a submitted mark can be rejected.");
    await prisma.$transaction(async (tx) => {
      await tx.subjectResult.update({
        where: { id: row.id },
        data: {
          state: "REJECTED",
          rejectReason: reason.data.reason,
          editAllowed: true,
          reviewedByUserId: req.authUser!.id,
          reviewedAt: new Date(),
        },
      });
      await tx.announcement.create({
        data: {
          schoolId: school.id,
          title: "Marks returned for correction",
          body: `A submitted mark was returned. Reason: ${reason.data.reason}`,
          audience: "TEACHERS",
          status: "PUBLISHED",
          publishAt: new Date(),
          createdByUserId: req.authUser!.id,
        },
      });
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "MARKS_RETURN",
      entityType: "SubjectResult",
      entityId: row.id,
      summary: `Returned a mark for correction: ${reason.data.reason}`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/result-sheets/:id/allow-edit", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await ownedResult(school.id, String(req.params.id));
    if (row.state !== "REJECTED" && row.state !== "PUBLISHED") {
      throw new HttpError(400, "Editing is allowed after a rejection.");
    }
    await prisma.subjectResult.update({ where: { id: row.id }, data: { editAllowed: true } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/result-sheets/publish", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({ sectionId: z.string(), subjectId: z.string(), examId: z.string() }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a section, subject, and exam.");
    const examSubject = await prisma.examSubject.findFirst({
      where: { examId: body.data.examId, subjectId: body.data.subjectId, exam: { schoolId: school.id } },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject was not found.");
    const ready = await prisma.subjectResult.findMany({
      where: { examSubjectId: examSubject.id, enrollment: { sectionId: body.data.sectionId, status: "ACTIVE" }, state: "VERIFIED" },
    });
    const validIds = ready.filter((row) => markIsValid(row, examSubject)).map((row) => row.id);
    const updated = validIds.length
      ? await prisma.subjectResult.updateMany({
        where: { id: { in: validIds }, state: "VERIFIED" },
        data: { state: "PUBLISHED", publishedByUserId: req.authUser!.id, publishedAt: new Date() },
      })
      : { count: 0 };
    res.json({ published: updated.count });
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/my-assignments", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const account = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    const school = account?.school;
    if (!account?.schoolId || !school || !school.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const schoolName = school.name;
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.authUser!.id, isActive: true },
      include: { assignments: { where: { schoolId: account.schoolId } } },
    });
    if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
    const sections = await prisma.section.findMany({
      where: { id: { in: teacher.assignments.map((item) => item.sectionId) }, classGroup: { schoolId: account.schoolId } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    const subjects = await prisma.subject.findMany({
      where: { id: { in: teacher.assignments.map((item) => item.subjectId) } },
    });
    const examSections = await prisma.examSection.findMany({
      where: { sectionId: { in: sections.map((section) => section.id) }, exam: { schoolId: account.schoolId } },
      include: { exam: { include: { subjects: true } } },
    });
    res.json(
      teacher.assignments.flatMap((item) => {
        const section = sections.find((row) => row.id === item.sectionId);
        const subject = subjects.find((row) => row.id === item.subjectId);
        if (!section || !subject) return [];
        return examSections.flatMap((examSection) => {
          if (examSection.sectionId !== item.sectionId) return [];
          const onExam = examSection.exam.subjects.some((row) => row.classGroupId === section.classGroupId && row.subjectId === item.subjectId);
          if (!onExam) return [];
          const termName = examSection.exam.term === "TERM_2" ? "Term 2" : "Term 1";
          return [{
            sectionId: item.sectionId,
            subjectId: item.subjectId,
            term: examSection.exam.term,
            schoolName,
            label: `${section.classGroup.academicYear.name} · ${termName} · ${levelLabel(section.classGroup.level)} · Section ${section.name} · ${subject.name}`,
          }];
        });
      }),
    );
  } catch (error) {
    next(error);
  }
});

resultsRouter.get("/my-marks", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const sheet = await teacherSheet(req.authUser!.id, String(req.query.sectionId ?? ""), String(req.query.subjectId ?? ""), String(req.query.term ?? ""));
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: sheet.sectionId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { rollNumber: "asc" },
    });
    for (const enrollment of enrollments) {
      await prisma.subjectResult.upsert({
        where: { enrollmentId_examSubjectId: { enrollmentId: enrollment.id, examSubjectId: sheet.examSubject.id } },
        update: {},
        create: { enrollmentId: enrollment.id, examSubjectId: sheet.examSubject.id },
      });
    }
    const rows = await prisma.subjectResult.findMany({
      where: { examSubjectId: sheet.examSubject.id, enrollment: { sectionId: sheet.sectionId } },
      include: { enrollment: { include: { student: true } } },
      orderBy: { enrollment: { rollNumber: "asc" } },
    });
    res.json({
      examSubjectId: sheet.examSubject.id,
      maxMarks: sheet.examSubject.maxMarks,
      minMarks: sheet.examSubject.minMarks,
      rows: rows.map((row) => ({
        enrollmentId: row.enrollmentId,
        student: `${row.enrollment.student.firstName} ${row.enrollment.student.fatherName}`,
        permanentId: row.enrollment.student.permanentId,
        rollNumber: row.enrollment.rollNumber,
        marks: row.marks,
        isAbsent: row.isAbsent,
        comment: row.comment ?? "",
        state: row.state,
        rejectReason: row.rejectReason,
        canEdit: row.state === "DRAFT" || (row.state === "REJECTED" && row.editAllowed),
      })),
    });
  } catch (error) {
    next(error);
  }
});

resultsRouter.put("/my-marks", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const body = saveSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Marks could not be saved.");
    const examSubject = await prisma.examSubject.findUnique({ where: { id: body.data.examSubjectId }, include: { exam: true } });
    if (!examSubject) throw new HttpError(404, "Exam subject was not found.");
    const sheet = await teacherSheet(req.authUser!.id, String(req.query.sectionId ?? ""), examSubject.subjectId, examSubject.exam.term);
    for (const row of body.data.rows) {
      const current = await prisma.subjectResult.findUnique({
        where: { enrollmentId_examSubjectId: { enrollmentId: row.enrollmentId, examSubjectId: examSubject.id } },
      });
      if (!current) continue;
      const enrollment = await prisma.enrollment.findFirst({
        where: { id: row.enrollmentId, sectionId: sheet.sectionId, status: "ACTIVE", schoolId: sheet.schoolId },
      });
      if (!enrollment) continue;
      const editable = current.state === "DRAFT" || (current.state === "REJECTED" && current.editAllowed);
      if (!editable) continue;
      if (!row.isAbsent && row.marks !== null && (row.marks < 0 || row.marks > examSubject.maxMarks)) {
        throw new HttpError(400, `Marks must be from 0 to ${examSubject.maxMarks}.`);
      }
      if (row.isAbsent && !row.comment?.trim()) throw new HttpError(400, "An absent student needs a comment.");
      await prisma.subjectResult.update({
        where: { id: current.id },
        data: {
          marks: row.isAbsent ? null : row.marks,
          isAbsent: row.isAbsent,
          comment: row.comment ?? null,
        },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

resultsRouter.post("/my-marks/submit", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const examSubjectId = z.object({ examSubjectId: z.string() }).safeParse(req.body);
    if (!examSubjectId.success) throw new HttpError(400, "Choose the mark sheet first.");
    const examSubject = await prisma.examSubject.findUnique({ where: { id: examSubjectId.data.examSubjectId }, include: { exam: true } });
    if (!examSubject) throw new HttpError(404, "Exam subject was not found.");
    const sheet = await teacherSheet(req.authUser!.id, String(req.query.sectionId ?? ""), examSubject.subjectId, examSubject.exam.term);
    if (sheet.examSubject.id !== examSubject.id || examSubject.exam.schoolId !== sheet.schoolId) {
      throw new HttpError(403, "You are not allowed to access this record.");
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: sheet.sectionId, schoolId: sheet.schoolId, status: "ACTIVE" },
      select: { id: true },
    });
    const rows = await prisma.subjectResult.findMany({
      where: { examSubjectId: examSubject.id, enrollmentId: { in: enrollments.map((item) => item.id) } },
    });
    const byStudent = new Map(rows.map((row) => [row.enrollmentId, row]));
    const incomplete = enrollments.some((enrollment) => {
      const row = byStudent.get(enrollment.id);
      if (!row) return true;
      if (row.state === "SUBMITTED" || row.state === "VERIFIED" || row.state === "PUBLISHED") return false;
      return !markIsValid(row, examSubject);
    });
    if (!enrollments.length || incomplete) throw new HttpError(400, "Every student needs a mark, or an absence with a comment, before you submit.");
    await prisma.subjectResult.updateMany({
      where: {
        examSubjectId: examSubject.id,
        enrollment: { sectionId: sheet.sectionId },
        OR: [{ state: "DRAFT" }, { state: "REJECTED", editAllowed: true }],
      },
      data: { state: "SUBMITTED", editAllowed: false, submittedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function subjectBoardStatus(states: string[]) {
  const submitted = states.filter((state) => ["SUBMITTED", "VERIFIED", "PUBLISHED", "REJECTED"].includes(state));
  if (!submitted.length) return "NOT_SUBMITTED";
  if (submitted.length < states.length) return "IN_PROGRESS";
  if (states.includes("SUBMITTED")) return "AWAITING";
  if (states.includes("REJECTED")) return "RETURNED";
  if (states.includes("VERIFIED")) return "APPROVED";
  return "PUBLISHED";
}

function sectionBoardStatus(statuses: string[]) {
  if (!statuses.length || statuses.every((status) => status === "NOT_SUBMITTED")) return "NOT_SUBMITTED";
  if (statuses.some((status) => status === "NOT_SUBMITTED" || status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.includes("AWAITING")) return "AWAITING";
  if (statuses.includes("RETURNED")) return "RETURNED";
  if (statuses.includes("APPROVED")) return "APPROVED";
  return "PUBLISHED";
}

function markIsValid(row: { marks: number | null; isAbsent: boolean; comment: string | null }, bounds: { minMarks: number; maxMarks: number }) {
  if (row.isAbsent) return Boolean(row.comment?.trim());
  return row.marks !== null && row.marks >= 0 && row.marks <= bounds.maxMarks;
}

function markIssue(row: { marks: number | null; isAbsent: boolean; comment: string | null; state: string } | undefined, minMarks: number, maxMarks: number) {
  if (!row || row.state === "WAITING") return "Missing mark";
  if (row.state === "PUBLISHED" || row.state === "VERIFIED") return markIsValid(row, { minMarks, maxMarks }) ? null : "Approved mark is incomplete";
  if (row.isAbsent && !row.comment?.trim()) return "Absent student needs a comment";
  if (!row.isAbsent && row.marks === null) return "Mark is missing";
  if (!row.isAbsent && row.marks !== null && (row.marks < 0 || row.marks > maxMarks)) return `Mark must be from 0 to ${maxMarks}`;
  return null;
}

function teacherName(rows: Array<{ sectionId: string; subjectId: string; teacher: { user: { firstName: string; lastName: string } } }>, sectionIds: string[], subjectId: string) {
  const match = rows.find((row) => row.subjectId === subjectId && sectionIds.includes(row.sectionId));
  return match ? `${match.teacher.user.firstName} ${match.teacher.user.lastName}` : null;
}

async function ownedExam(schoolId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { sections: true },
  });
  if (!exam) throw new HttpError(404, "Exam was not found.");
  return exam;
}

async function publicationScope(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      sections: true,
      classes: true,
      subjects: true,
    },
  });
  if (!exam) throw new HttpError(404, "Exam was not found.");
  const year = await prisma.academicYear.findUnique({ where: { id: exam.academicYearId } });
  const selected = new Set(exam.sections.map((row) => row.sectionId));
  const rows = await prisma.subjectResult.findMany({
    where: { examSubject: { examId }, enrollment: { sectionId: { in: [...selected] }, status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] } } },
    include: { examSubject: true, enrollment: true },
  });
  const ready = rows.filter((row) => row.state === "VERIFIED" && markIsValid(row, row.examSubject));
  const awaiting = rows.filter((row) => row.state === "SUBMITTED").length;
  const term = exam.term === "TERM_2" ? "Term 2" : "Term 1";
  return {
    year: year?.name ?? "",
    term,
    exam: `${year?.name ?? "Exam"} · ${term}`,
    classes: new Set(ready.map((row) => row.enrollment.classGroupId)).size,
    subjects: new Set(ready.map((row) => row.examSubjectId)).size,
    studentResults: ready.length,
    ready: ready.length,
    awaiting,
    examClasses: exam.classes.length,
    examSubjects: exam.subjects.length,
  };
}

async function publishApprovedMarks(schoolId: string, examId: string, actorUserId: string) {
  const exam = await ownedExam(schoolId, examId);
  const selected = new Set(exam.sections.map((row) => row.sectionId));
  const rows = await prisma.subjectResult.findMany({
    where: {
      state: "VERIFIED",
      examSubject: { examId: exam.id, exam: { schoolId } },
      enrollment: { sectionId: { in: [...selected] }, status: { in: ["ACTIVE", "PROMOTED", "RETAINED", "ALUMNI"] }, schoolId },
    },
    include: { examSubject: true, enrollment: true },
  });
  const ready = rows.filter((row) => markIsValid(row, row.examSubject));
  const publishedAt = new Date();
  const scopeBefore = await publicationScope(exam.id);
  const published = await prisma.$transaction(async (tx) => {
    if (!ready.length) return 0;
    const updated = await tx.subjectResult.updateMany({
      where: { id: { in: ready.map((row) => row.id) }, state: "VERIFIED" },
      data: { state: "PUBLISHED", publishedByUserId: actorUserId, publishedAt },
    });
    if (!updated.count) return 0;
    const classCount = new Set(ready.map((row) => row.enrollment.classGroupId)).size;
    const subjectCount = new Set(ready.map((row) => row.examSubjectId)).size;
    await tx.resultPublication.create({
      data: {
        examId: exam.id,
        schoolId,
        publishedByUserId: actorUserId,
        publishedCount: updated.count,
        classCount,
        subjectCount,
      },
    });
    const body = `${scopeBefore.year} · ${scopeBefore.term}: ${updated.count} approved result${updated.count === 1 ? "" : "s"} are now published.`;
    await tx.announcement.createMany({
      data: (["PARENTS", "STUDENTS"] as const).map((audience) => ({
        schoolId,
        title: "Exam results published",
        body,
        audience,
        status: "PUBLISHED" as const,
        publishAt: publishedAt,
        createdByUserId: actorUserId,
      })),
    });
    return updated.count;
  });
  if (published) {
    await writeAudit({
      schoolId,
      actorUserId,
      action: "MARKS_PUBLISH",
      entityType: "Exam",
      entityId: exam.id,
      summary: `Published ${published} approved mark${published === 1 ? "" : "s"} for ${scopeBefore.year} ${scopeBefore.term}. ${scopeBefore.awaiting} submission${scopeBefore.awaiting === 1 ? "" : "s"} still await approval.`,
    });
  }
  return {
    ...scopeBefore,
    published,
    classes: published ? new Set(ready.map((row) => row.enrollment.classGroupId)).size : 0,
    subjects: published ? new Set(ready.map((row) => row.examSubjectId)).size : 0,
    studentResults: published,
    publishedAt: published ? publishedAt.toISOString() : null,
    awaiting: scopeBefore.awaiting,
  };
}

async function ownedResult(schoolId: string, resultId: string) {
  const row = await prisma.subjectResult.findFirst({
    where: { id: resultId, examSubject: { exam: { schoolId } } },
  });
  if (!row) throw new HttpError(404, "Mark was not found.");
  return row;
}

async function teacherSheet(userId: string, sectionId: string, subjectId: string, term: string) {
  if (term !== "TERM_1" && term !== "TERM_2") throw new HttpError(400, "Choose Term 1 or Term 2.");
  const teacher = await prisma.teacher.findFirst({
    where: { userId, isActive: true, assignments: { some: { sectionId, subjectId } } },
    include: { assignments: { where: { sectionId, subjectId } } },
  });
  if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { classGroup: true } });
  if (!section) throw new HttpError(404, "Section was not found.");
  const assignment = teacher.assignments.find((item) => item.schoolId === section.classGroup.schoolId && item.academicYearId === section.classGroup.academicYearId);
  if (!assignment) throw new HttpError(403, "You are not allowed to access this record.");
  const examSubject = await prisma.examSubject.findFirst({
    where: {
      classGroupId: section.classGroupId,
      subjectId,
      exam: { term, academicYearId: section.classGroup.academicYearId, schoolId: assignment.schoolId },
    },
  });
  if (!examSubject) throw new HttpError(404, "The exam for this subject is not ready.");
  const included = await prisma.examSection.findFirst({ where: { examId: examSubject.examId, sectionId } });
  if (!included) throw new HttpError(404, "This section is not part of the exam.");
  return { sectionId, schoolId: assignment.schoolId, examSubject };
}
