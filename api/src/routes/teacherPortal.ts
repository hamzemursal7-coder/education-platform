import { Router } from "express";
import { levelLabel } from "../lib/levels.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const teacherPortalRouter = Router();

teacherPortalRouter.use("/teacher", requireAuth, requireRole("TEACHER"));

type Assignment = { schoolId: string; academicYearId: string; sectionId: string; subjectId: string };

async function teacherOf(userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, isActive: true },
    include: { user: true, assignments: true, schools: true },
  });
  if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
  return teacher;
}

function assignedSchool(teacher: { assignments: Assignment[]; schools: Array<{ schoolId: string }> }, schoolId: string) {
  const linked = teacher.assignments.some((item) => item.schoolId === schoolId) || teacher.schools.some((item) => item.schoolId === schoolId);
  if (!linked) throw new HttpError(403, "You are not allowed to access this record.");
}

function termLabel(term: string) {
  return term === "TERM_2" ? "Term 2" : "Term 1";
}

function schoolTypeLabel(type: string) {
  if (type === "PRIMARY_ONLY") return "Primary";
  if (type === "SECONDARY_ONLY") return "Secondary";
  return "Combined";
}

function sheetStatus(states: string[]) {
  if (!states.length || states.every((state) => state === "EMPTY")) return "READY";
  if (states.every((state) => state === "EMPTY" || state === "DRAFT")) {
    return states.some((state) => state === "EMPTY") ? "IN_PROGRESS" : "DRAFT";
  }
  if (states.some((state) => state === "REJECTED")) return "RETURNED";
  if (states.every((state) => state === "PUBLISHED")) return "PUBLISHED";
  if (states.every((state) => state === "VERIFIED" || state === "PUBLISHED")) return "APPROVED";
  if (states.some((state) => state === "SUBMITTED") && states.every((state) => state === "SUBMITTED" || state === "VERIFIED" || state === "PUBLISHED")) return "SUBMITTED";
  return "IN_PROGRESS";
}

teacherPortalRouter.get("/teacher/me", async (req, res, next) => {
  try {
    const teacher = await teacherOf(req.authUser!.id);
    const schoolIds = [...new Set([...teacher.schools.map((item) => item.schoolId), ...teacher.assignments.map((item) => item.schoolId)])];
    const sectionIds = [...new Set(teacher.assignments.map((item) => item.sectionId))];
    const subjectIds = [...new Set(teacher.assignments.map((item) => item.subjectId))];
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds } },
      select: { classGroupId: true },
    });
    const [pendingMarks, announcements] = await Promise.all([
      prisma.subjectResult.count({
        where: {
          state: { in: ["DRAFT", "REJECTED"] },
          examSubject: { subjectId: { in: subjectIds.length ? subjectIds : ["__none__"] } },
          enrollment: { sectionId: { in: sectionIds.length ? sectionIds : ["__none__"] }, status: "ACTIVE" },
        },
      }),
      prisma.announcement.count({
        where: {
          schoolId: { in: schoolIds.length ? schoolIds : ["__none__"] },
          status: "PUBLISHED",
          audience: { in: ["ALL", "TEACHERS"] },
        },
      }),
    ]);
    res.json({
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      publicId: teacher.publicId,
      email: teacher.user.email,
      phone: teacher.phone || teacher.user.phone,
      qualification: teacher.qualification,
      status: teacher.user.status === "ACTIVE" && teacher.isActive ? "Active" : teacher.user.status === "DISABLED" || !teacher.isActive ? "Disabled" : "Invited",
      schools: schoolIds.length,
      classes: new Set(sections.map((section) => section.classGroupId)).size,
      subjects: subjectIds.length,
      pendingMarks,
      announcements,
    });
  } catch (error) {
    next(error);
  }
});

teacherPortalRouter.get("/teacher/schools", async (req, res, next) => {
  try {
    const teacher = await teacherOf(req.authUser!.id);
    const schoolIds = [...new Set([...teacher.schools.map((item) => item.schoolId), ...teacher.assignments.map((item) => item.schoolId)])];
    const schools = await prisma.school.findMany({ where: { id: { in: schoolIds } }, orderBy: { name: "asc" } });
    const sections = await prisma.section.findMany({
      where: { id: { in: teacher.assignments.map((item) => item.sectionId) } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    const subjects = await prisma.subject.findMany({
      where: { id: { in: teacher.assignments.map((item) => item.subjectId) } },
    });
    res.json(schools.map((school) => {
      const rows = teacher.assignments.filter((item) => item.schoolId === school.id);
      const schoolSections = sections.filter((section) => rows.some((item) => item.sectionId === section.id));
      const schoolSubjects = subjects.filter((subject) => rows.some((item) => item.subjectId === subject.id));
      return {
        id: school.id,
        name: school.name,
        code: school.code,
        type: schoolTypeLabel(school.type),
        active: school.isActive,
        classes: [...new Map(schoolSections.map((section) => [section.classGroupId, {
          label: levelLabel(section.classGroup.level),
          year: section.classGroup.academicYear.name,
          sections: schoolSections.filter((item) => item.classGroupId === section.classGroupId).map((item) => item.name),
        }])).values()],
        subjects: schoolSubjects.map((subject) => subject.name),
      };
    }));
  } catch (error) {
    next(error);
  }
});

teacherPortalRouter.get("/teacher/assignments", async (req, res, next) => {
  try {
    const teacher = await teacherOf(req.authUser!.id);
    const [schools, sections, subjects] = await Promise.all([
      prisma.school.findMany({ where: { id: { in: teacher.assignments.map((item) => item.schoolId) } } }),
      prisma.section.findMany({
        where: { id: { in: teacher.assignments.map((item) => item.sectionId) } },
        include: { classGroup: { include: { academicYear: true } } },
      }),
      prisma.subject.findMany({ where: { id: { in: teacher.assignments.map((item) => item.subjectId) } } }),
    ]);
    res.json(teacher.assignments.flatMap((item) => {
      const school = schools.find((row) => row.id === item.schoolId);
      const section = sections.find((row) => row.id === item.sectionId && row.classGroup.schoolId === item.schoolId && row.classGroup.academicYearId === item.academicYearId);
      const subject = subjects.find((row) => row.id === item.subjectId && row.schoolId === item.schoolId);
      if (!school || !section || !subject) return [];
      return [{
        id: item.id,
        schoolId: school.id,
        school: school.name,
        year: section.classGroup.academicYear.name,
        academicYearId: item.academicYearId,
        classLabel: levelLabel(section.classGroup.level),
        section: section.name,
        subject: subject.name,
        status: school.isActive && subject.isActive ? "Active" : "Inactive",
      }];
    }));
  } catch (error) {
    next(error);
  }
});

teacherPortalRouter.get("/teacher/years", async (req, res, next) => {
  try {
    const teacher = await teacherOf(req.authUser!.id);
    const schoolId = String(req.query.schoolId ?? "");
    assignedSchool(teacher, schoolId);
    const years = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
    });
    res.json(years.map((year) => ({ id: year.id, name: year.name, isCurrent: year.isCurrent })));
  } catch (error) {
    next(error);
  }
});

async function eligibleSheets(userId: string, schoolId: string, academicYearId?: string) {
  const teacher = await teacherOf(userId);
  assignedSchool(teacher, schoolId);
  const assignments = teacher.assignments.filter((item) => item.schoolId === schoolId && (!academicYearId || item.academicYearId === academicYearId));
  const sectionIds = [...new Set(assignments.map((item) => item.sectionId))];
  const [school, sections, subjects, exams, enrollments] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.section.findMany({
      where: { id: { in: sectionIds } },
      include: { classGroup: { include: { academicYear: true } } },
    }),
    prisma.subject.findMany({ where: { id: { in: assignments.map((item) => item.subjectId) }, schoolId } }),
    prisma.exam.findMany({
      where: {
        schoolId,
        ...(academicYearId ? { academicYearId } : {}),
        sections: { some: { sectionId: { in: sectionIds } } },
      },
      include: { subjects: true, sections: true },
    }),
    prisma.enrollment.findMany({
      where: { schoolId, status: "ACTIVE", sectionId: { in: sectionIds } },
      select: { id: true, sectionId: true },
    }),
  ]);
  if (!school) throw new HttpError(404, "School was not found.");
  const results = await prisma.subjectResult.findMany({
    where: { examSubject: { examId: { in: exams.map((exam) => exam.id) } }, enrollment: { sectionId: { in: sectionIds }, status: "ACTIVE" } },
    select: { enrollmentId: true, examSubjectId: true, state: true, marks: true, isAbsent: true },
  });
  const sheets = exams.flatMap((exam) => assignments.flatMap((assignment) => {
    const section = sections.find((row) => row.id === assignment.sectionId && row.classGroup.academicYearId === exam.academicYearId);
    const subject = subjects.find((row) => row.id === assignment.subjectId);
    if (!section || !subject) return [];
    if (!exam.sections.some((row) => row.sectionId === section.id)) return [];
    const examSubject = exam.subjects.find((row) => row.classGroupId === section.classGroupId && row.subjectId === subject.id);
    if (!examSubject) return [];
    const students = enrollments.filter((row) => row.sectionId === section.id);
    const states = students.map((student) => {
      const result = results.find((row) => row.enrollmentId === student.id && row.examSubjectId === examSubject.id);
      if (!result) return "EMPTY";
      if (result.state === "DRAFT" && result.marks == null && !result.isAbsent) return "EMPTY";
      return result.state;
    });
    return [{
      examId: exam.id,
      examSubjectId: examSubject.id,
      sectionId: section.id,
      subjectId: subject.id,
      schoolId: school.id,
      school: school.name,
      academicYearId: exam.academicYearId,
      year: section.classGroup.academicYear.name,
      term: exam.term,
      termLabel: termLabel(exam.term),
      examName: `${section.classGroup.academicYear.name} · ${termLabel(exam.term)}`,
      examType: "Term exam",
      examDate: examSubject.examDay ?? exam.examDate,
      classLabel: levelLabel(section.classGroup.level),
      section: section.name,
      subject: subject.name,
      students: students.length,
      maxMarks: examSubject.maxMarks,
      status: sheetStatus(states),
    }];
  }));
  return { school, exams, sheets };
}

teacherPortalRouter.get("/teacher/exams", async (req, res, next) => {
  try {
    const schoolId = String(req.query.schoolId ?? "");
    const academicYearId = String(req.query.academicYearId ?? "");
    const { sheets } = await eligibleSheets(req.authUser!.id, schoolId, academicYearId || undefined);
    const exams = [...new Map(sheets.map((sheet) => [sheet.examId, {
      id: sheet.examId,
      name: sheet.examName,
      type: sheet.examType,
      term: sheet.term,
      termLabel: sheet.termLabel,
      year: sheet.year,
    }])).values()];
    res.json({ exams, sheets });
  } catch (error) {
    next(error);
  }
});

teacherPortalRouter.get("/teacher/marksheets", async (req, res, next) => {
  try {
    const schoolId = String(req.query.schoolId ?? "");
    const academicYearId = String(req.query.academicYearId ?? "");
    const examId = String(req.query.examId ?? "");
    if (!academicYearId || !examId) throw new HttpError(400, "Choose the school, academic year, and exam.");
    const { sheets } = await eligibleSheets(req.authUser!.id, schoolId, academicYearId);
    res.json(sheets.filter((sheet) => sheet.examId === examId));
  } catch (error) {
    next(error);
  }
});
