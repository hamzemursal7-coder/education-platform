import { Prisma, type LevelCode } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { studentPhotoPath } from "../lib/photos.js";
import { isTerminalLevel, levelLabel, levelsForSchool, nextLevelFor, terminalLevelsForSchool } from "../lib/levels.js";
import { judgeTerm2, term2BlockReason, type MarkProgress } from "../lib/promotionRules.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
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

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

function studentName(student: { firstName: string; fatherName: string; grandfatherName: string }) {
  return `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim();
}

function historyStage(level: LevelCode) {
  return level.startsWith("CLASS_") ? "Primary" : "Secondary";
}

function historyStatus(status: string) {
  if (status === "ACTIVE") return "Enrolled";
  if (status === "TRANSFERRED") return "Transferred";
  if (status === "PROMOTED" || status === "RETAINED" || status === "ALUMNI") return "Completed";
  return status;
}

function currentStatusLabel(level: LevelCode | null, records: Array<{ fromLevel: LevelCode }>, fallback: string) {
  if (level) return `Active Student — ${historyStage(level)} ${levelLabel(level)}`;
  if (records.some((record) => record.fromLevel === "FORM_4")) return "Secondary Graduate";
  if (records.some((record) => record.fromLevel === "CLASS_8")) return "Primary Graduate";
  return fallback;
}

function recordsForViewer<T extends { schoolId: string; fromLevel: LevelCode; createdAt: Date }>(records: T[], schoolId: string) {
  return [...records].sort((a, b) => {
    const owned = Number(b.schoolId === schoolId) - Number(a.schoolId === schoolId);
    if (owned !== 0) return owned;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function averageOf(rows: Array<{ marks: number | null; isAbsent: boolean; maxMarks: number }>) {
  const scored = rows.filter((row) => !row.isAbsent && row.marks != null && row.maxMarks > 0);
  const possible = scored.reduce((sum, row) => sum + row.maxMarks, 0);
  const obtained = scored.reduce((sum, row) => sum + (row.marks ?? 0), 0);
  if (!possible) return null;
  return Math.round((obtained / possible) * 1000) / 10;
}

function yearsAreInOrder(from: { startDate: Date }, to: { startDate: Date }) {
  return from.startDate.getTime() < to.startDate.getTime();
}

async function term2Exam(db: Prisma.TransactionClient | typeof prisma, schoolId: string, academicYearId: string, classGroupId: string) {
  const [term, exam] = await Promise.all([
    db.term.findFirst({ where: { academicYearId, code: "TERM_2" }, select: { id: true } }),
    db.exam.findFirst({
      where: { schoolId, academicYearId, term: "TERM_2" },
      include: {
        classes: { select: { classGroupId: true } },
        subjects: { where: { classGroupId } },
      },
    }),
  ]);
  const forThisClass = Boolean(exam && (exam.classes.some((item) => item.classGroupId === classGroupId) || exam.subjects.length > 0));
  return {
    termConfigured: Boolean(term),
    examCreated: forThisClass,
    subjects: forThisClass ? exam?.subjects ?? [] : [],
  };
}

function resultStates(subjects: Array<{ id: string }>, results: Array<{ examSubjectId: string; state: MarkProgress }>) {
  return subjects.map((subject) => results.find((row) => row.examSubjectId === subject.id)?.state ?? "MISSING");
}

export const promotionRouter = Router();
promotionRouter.use("/promotion-preview", requireAuth, requireRole("SCHOOL_ADMIN"));
promotionRouter.use("/promotion", requireAuth, requireRole("SCHOOL_ADMIN"));
promotionRouter.use("/promotions", requireAuth, requireRole("SCHOOL_ADMIN"));
promotionRouter.use("/alumni", requireAuth, requireRole("SCHOOL_ADMIN"));

promotionRouter.get("/promotion/options", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const years = await prisma.academicYear.findMany({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
      include: { classes: { include: { sections: { orderBy: { name: "asc" } } }, orderBy: { level: "asc" } } },
    });
    const allowed = new Set(levelsForSchool(school.type));
    res.json({
      schoolName: school.name,
      schoolType: school.type,
      years: years.map((year) => ({
        id: year.id,
        name: year.name,
        startDate: year.startDate.toISOString(),
        isCurrent: year.isCurrent,
        classes: year.classes
          .filter((item) => allowed.has(item.level))
          .map((item) => ({
            id: item.id,
            level: item.level,
            label: levelLabel(item.level),
            sections: item.sections.map((section) => ({ id: section.id, name: section.name })),
          })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

promotionRouter.get("/promotion/section", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const fromYearId = String(req.query.fromYearId ?? "");
    const toYearId = String(req.query.toYearId ?? "");
    const sectionId = String(req.query.sectionId ?? "");
    if (!fromYearId) throw new HttpError(400, "Choose the academic year.");
    if (!sectionId) throw new HttpError(400, "Choose a section.");
    const [fromYear, section] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: fromYearId, schoolId: school.id } }),
      prisma.section.findFirst({
        where: { id: sectionId, classGroup: { schoolId: school.id, academicYearId: fromYearId } },
        include: { classGroup: true },
      }),
    ]);
    if (!fromYear) throw new HttpError(404, "Academic year was not found for this school.");
    if (!section) throw new HttpError(404, "Section was not found in the selected year.");
    const terminal = isTerminalLevel(section.classGroup.level);
    const requestedYear = toYearId
      ? await prisma.academicYear.findFirst({
          where: { id: toYearId, schoolId: school.id },
          include: { classes: { include: { sections: { orderBy: { name: "asc" } } } } },
        })
      : null;
    if (!terminal && toYearId && !requestedYear) throw new HttpError(404, "Academic year was not found for this school.");
    if (requestedYear && !yearsAreInOrder(fromYear, requestedYear)) throw new HttpError(400, "The destination academic year must start after the source year.");
    if (!terminal && (!requestedYear || fromYearId === toYearId)) throw new HttpError(400, "Choose the current year and a different next year.");
    const toYear = requestedYear && requestedYear.id !== fromYearId && yearsAreInOrder(fromYear, requestedYear) ? requestedYear : null;
    const allowed = new Set(levelsForSchool(school.type));
    if (!allowed.has(section.classGroup.level)) throw new HttpError(400, "That class is not part of this school.");
    const destinationClasses = toYear?.classes.filter((item) => allowed.has(item.level)) ?? [];
    const blockers: string[] = [];
    if (!terminal && !destinationClasses.length) blockers.push("The next academic year has no classes or sections yet.");
    const sectionsFor = (level: LevelCode | null) => {
      if (!level) return [];
      return destinationClasses.find((item) => item.level === level)?.sections.map((item) => ({ id: item.id, name: item.name })) ?? [];
    };
    const nextLevel = nextLevelFor(section.classGroup.level);
    const repeatSections = sectionsFor(section.classGroup.level);
    const promoteSections = sectionsFor(nextLevel);
    if (!terminal && !repeatSections.length) blockers.push(`${levelLabel(section.classGroup.level)} is not configured in ${toYear?.name ?? "the next year"}.`);
    if (!terminal && nextLevel && !promoteSections.length) blockers.push(`${levelLabel(nextLevel)} is not configured in ${toYear?.name ?? "the next year"}.`);
    if (terminal && !toYear) blockers.push(`Students below 50% repeat ${levelLabel(section.classGroup.level)} in a later year. Create that year, add ${levelLabel(section.classGroup.level)}, then choose it here. Students who pass become alumni this year.`);
    if (terminal && toYear && !repeatSections.length) blockers.push(`${levelLabel(section.classGroup.level)} is not configured in ${toYear.name}. Add it there before repeating.`);
    const examContext = await term2Exam(prisma, school.id, fromYearId, section.classGroupId);
    const enrollments = await prisma.enrollment.findMany({
      where: { schoolId: school.id, academicYearId: fromYearId, sectionId, status: "ACTIVE" },
      include: {
        student: true,
        results: {
          where: { examSubject: { exam: { term: "TERM_2", academicYearId: fromYearId, schoolId: school.id } } },
          include: { examSubject: true },
        },
      },
      orderBy: [{ rollNumber: "asc" }, { student: { firstName: "asc" } }],
    });
    const rows = enrollments.map((enrollment) => {
      const states = resultStates(examContext.subjects, enrollment.results);
      const gapReason = term2BlockReason({
        termConfigured: examContext.termConfigured,
        examCreated: examContext.examCreated,
        subjectCount: examContext.subjects.length,
        states,
      });
      const published = enrollment.results.filter((row) => row.state === "PUBLISHED");
      const judgement = gapReason
        ? { status: "PENDING" as const, reason: gapReason, average: null }
        : judgeTerm2({
            examSubjectCount: examContext.subjects.length,
            terminal: isTerminalLevel(section.classGroup.level),
            results: published.map((row) => ({
              marks: row.marks,
              isAbsent: row.isAbsent,
              maxMarks: row.examSubject.maxMarks,
              minMarks: row.examSubject.minMarks,
            })),
          });
      const terminal = isTerminalLevel(section.classGroup.level);
      let recommended: "PROMOTE" | "RETAIN" | "ALUMNI" | null = null;
      let destinationLevel: LevelCode | null = null;
      let destinationSections = repeatSections;
      let blocked = judgement.status === "PENDING";
      let blockReason = judgement.status === "PENDING" ? judgement.reason : null;
      if (judgement.status === "PASS") {
        recommended = "PROMOTE";
        destinationLevel = nextLevel;
        destinationSections = promoteSections;
        if (!promoteSections.length) {
          blocked = true;
          blockReason = nextLevel ? `${levelLabel(nextLevel)} is not configured in ${toYear?.name ?? "the next year"}.` : "The next class is not configured.";
        }
      } else if (judgement.status === "FAIL") {
        recommended = "RETAIN";
        destinationLevel = section.classGroup.level;
        destinationSections = repeatSections;
        if (!repeatSections.length) {
          blocked = true;
          const levelName = levelLabel(section.classGroup.level);
          blockReason = !toYear
            ? `The average is below 50%, so this student repeats ${levelName}. Choose a later year that already has ${levelName}.`
            : `${levelName} is not configured in ${toYear.name}. Add it there before repeating.`;
        }
      } else if (judgement.status === "GRADUATION") {
        recommended = "ALUMNI";
        destinationLevel = null;
        destinationSections = [];
      } else if (judgement.status === "REVIEW") {
        destinationLevel = terminal ? null : nextLevel;
        destinationSections = terminal ? repeatSections : promoteSections;
      }
      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        permanentId: enrollment.student.permanentId,
        name: studentName(enrollment.student),
        gender: enrollment.student.gender === "MALE" ? "Male" : "Female",
        level: section.classGroup.level,
        levelLabel: levelLabel(section.classGroup.level),
        section: section.name,
        term2Average: judgement.average,
        status: judgement.status,
        recommended,
        blocked,
        blockReason,
        remarks: judgement.reason,
        destinationLevel,
        destinationLabel: destinationLevel ? levelLabel(destinationLevel) : terminal && judgement.status === "GRADUATION" ? "Alumni" : null,
        promoteLabel: nextLevel ? levelLabel(nextLevel) : null,
        repeatLabel: levelLabel(section.classGroup.level),
        promoteSections,
        repeatSections,
        destinationSections,
      };
    });
    res.json({
      ready: blockers.length === 0,
      blockers,
      scope: {
        schoolName: school.name,
        fromYear: fromYear.name,
        toYear: toYear?.name ?? fromYear.name,
        level: section.classGroup.level,
        levelLabel: levelLabel(section.classGroup.level),
        section: section.name,
      },
      counts: {
        total: rows.length,
        promote: rows.filter((row) => row.recommended === "PROMOTE" && !row.blocked).length,
        repeat: rows.filter((row) => row.recommended === "RETAIN" && !row.blocked).length,
        alumni: rows.filter((row) => row.recommended === "ALUMNI" && !row.blocked).length,
        pending: rows.filter((row) => row.blocked || row.status === "REVIEW").length,
      },
      rows,
    });
  } catch (error) {
    next(error);
  }
});

const runSchema = z.object({
  fromYearId: z.string().min(1),
  toYearId: z.string().min(1).optional(),
  sectionId: z.string().min(1),
  decisions: z.array(z.object({
    enrollmentId: z.string().min(1),
    action: z.enum(["PROMOTE", "RETAIN", "ALUMNI"]),
    targetSectionId: z.string().optional(),
  })).min(1),
});

promotionRouter.post("/promotions", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = runSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the section and at least one student.");
    const alumniOnly = body.data.decisions.every((row) => row.action === "ALUMNI");
    if (!alumniOnly && (!body.data.toYearId || body.data.fromYearId === body.data.toYearId)) throw new HttpError(400, "Choose two different academic years.");
    if (new Set(body.data.decisions.map((row) => row.enrollmentId)).size !== body.data.decisions.length) {
      throw new HttpError(400, "A student was selected more than once.");
    }
    const result = await prisma.$transaction(async (tx) => {
      const [fromYear, toYear, sourceSection] = await Promise.all([
        tx.academicYear.findFirst({ where: { id: body.data.fromYearId, schoolId: school.id } }),
        tx.academicYear.findFirst({ where: { id: body.data.toYearId ?? "none", schoolId: school.id }, include: { classes: { include: { sections: true } } } }),
        tx.section.findFirst({ where: { id: body.data.sectionId, classGroup: { schoolId: school.id, academicYearId: body.data.fromYearId } }, include: { classGroup: true } }),
      ]);
      if (!fromYear) throw new HttpError(404, "Academic year was not found for this school.");
      if (!sourceSection) throw new HttpError(404, "Section was not found in the selected year.");
      const terminal = isTerminalLevel(sourceSection.classGroup.level);
      if (!alumniOnly || !terminal) {
        if (!toYear) throw new HttpError(404, "Academic year was not found for this school.");
        if (!yearsAreInOrder(fromYear, toYear)) throw new HttpError(400, "The destination academic year must start after the source year.");
        if (!toYear.classes.length) throw new HttpError(400, "Prepare the next academic year before promoting this section.");
      }
      const examContext = await term2Exam(tx, school.id, fromYear.id, sourceSection.classGroupId);
      let promoted = 0;
      let repeated = 0;
      let alumni = 0;
      const stored: Prisma.PromotionDecisionCreateManyInput[] = [];
      const batch = await tx.promotionBatch.create({
        data: {
          schoolId: school.id,
          fromYearId: fromYear.id,
          toYearId: toYear?.id ?? fromYear.id,
          sectionId: sourceSection.id,
          actorUserId: req.authUser!.id,
          promoted: 0,
          repeated: 0,
          alumni: 0,
        },
      });
      for (const decision of body.data.decisions) {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: decision.enrollmentId, schoolId: school.id, academicYearId: fromYear.id, sectionId: sourceSection.id },
          include: {
            student: true,
            results: {
              where: { examSubject: { exam: { term: "TERM_2", academicYearId: fromYear.id, schoolId: school.id } } },
              include: { examSubject: true },
            },
          },
        });
        if (!enrollment) throw new HttpError(404, "That student is not a member of the selected section.");
        const already = await tx.promotionDecision.findUnique({ where: { enrollmentId: enrollment.id } });
        if (already || enrollment.status !== "ACTIVE") throw new HttpError(409, `${enrollment.student.permanentId} has already been processed.`);
        const states = resultStates(examContext.subjects, enrollment.results);
        const blockReason = term2BlockReason({
          termConfigured: examContext.termConfigured,
          examCreated: examContext.examCreated,
          subjectCount: examContext.subjects.length,
          states,
        });
        const judgement = blockReason
          ? { status: "PENDING" as const, reason: blockReason, average: null }
          : judgeTerm2({
              examSubjectCount: examContext.subjects.length,
              terminal: isTerminalLevel(sourceSection.classGroup.level),
              results: enrollment.results.filter((row) => row.state === "PUBLISHED").map((row) => ({
                marks: row.marks,
                isAbsent: row.isAbsent,
                maxMarks: row.examSubject.maxMarks,
                minMarks: row.examSubject.minMarks,
              })),
            });
        if (judgement.status === "PENDING") throw new HttpError(400, `${enrollment.student.permanentId}: ${judgement.reason}`);
        if (decision.action === "PROMOTE" && (judgement.status === "FAIL" || judgement.status === "GRADUATION" || isTerminalLevel(sourceSection.classGroup.level))) {
          throw new HttpError(400, `${enrollment.student.permanentId} cannot be promoted to the next class from this result.`);
        }
        if (decision.action === "ALUMNI" && !isTerminalLevel(sourceSection.classGroup.level)) {
          throw new HttpError(400, "Only Class 8 and Form 4 can be recorded as alumni.");
        }
        if (decision.action === "ALUMNI" && judgement.status === "FAIL") {
          throw new HttpError(400, `${enrollment.student.permanentId} is below the pass mark and cannot be recorded as alumni.`);
        }
        if (decision.action === "ALUMNI") {
          await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "ALUMNI" } });
          await tx.student.update({ where: { id: enrollment.studentId }, data: { status: "ALUMNI" } });
          await tx.alumniRecord.create({
            data: {
              studentId: enrollment.studentId,
              schoolId: school.id,
              academicYearId: enrollment.academicYearId,
              fromLevel: sourceSection.classGroup.level,
              reason: sourceSection.classGroup.level === "FORM_4" ? "Form 4 completion" : "Class 8 completion",
            },
          });
          stored.push({
            batchId: batch.id,
            enrollmentId: enrollment.id,
            studentId: enrollment.studentId,
            outcome: "ALUMNI",
            fromLevel: sourceSection.classGroup.level,
            fromSectionName: sourceSection.name,
            term2Average: judgement.average,
            remarks: judgement.reason,
          });
          alumni += 1;
          continue;
        }
        if (!toYear) throw new HttpError(400, "Choose the next academic year.");
        const targetLevel: LevelCode = decision.action === "PROMOTE" ? (nextLevelFor(sourceSection.classGroup.level) as LevelCode) : sourceSection.classGroup.level;
        if (!decision.targetSectionId) throw new HttpError(400, `Choose a destination section for ${enrollment.student.permanentId}.`);
        const target = await tx.section.findFirst({
          where: { id: decision.targetSectionId, classGroup: { schoolId: school.id, academicYearId: toYear.id, level: targetLevel } },
        });
        if (!target) throw new HttpError(400, `The destination section for ${enrollment.student.permanentId} is not in ${levelLabel(targetLevel)}.`);
        const existing = await tx.enrollment.findUnique({
          where: { studentId_academicYearId: { studentId: enrollment.studentId, academicYearId: toYear.id } },
        });
        if (existing) throw new HttpError(409, `${enrollment.student.permanentId} already has an enrollment in ${toYear.name}.`);
        const studentNumber = await nextStudentNumber(tx, school.id);
        const rollNumber = await nextValue(tx, `roll:${target.id}`);
        await tx.enrollment.create({
          data: {
            studentId: enrollment.studentId,
            schoolId: school.id,
            academicYearId: toYear.id,
            classGroupId: target.classGroupId,
            sectionId: target.id,
            studentNumber,
            rollNumber,
            status: "ACTIVE",
          },
        });
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { status: decision.action === "PROMOTE" ? "PROMOTED" : "RETAINED" },
        });
        stored.push({
          batchId: batch.id,
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          outcome: decision.action === "PROMOTE" ? "PROMOTED" : "REPEATED",
          fromLevel: sourceSection.classGroup.level,
          fromSectionName: sourceSection.name,
          toLevel: targetLevel,
          toSectionId: target.id,
          toSectionName: target.name,
          term2Average: judgement.average,
          remarks: judgement.reason,
        });
        if (decision.action === "PROMOTE") promoted += 1;
        else repeated += 1;
      }
      if (stored.length) await tx.promotionDecision.createMany({ data: stored });
      await tx.promotionBatch.update({ where: { id: batch.id }, data: { promoted, repeated, alumni } });
      return { promoted, repeated, alumni, batchId: batch.id };
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "PROMOTION_RUN",
      entityType: "PromotionBatch",
      entityId: result.batchId,
      summary: `Promoted ${result.promoted}, repeated ${result.repeated}, alumni ${result.alumni}.`,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

promotionRouter.get("/promotions/history", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const decisions = await prisma.promotionDecision.findMany({
      where: { batch: { schoolId: school.id } },
      include: { batch: true },
      orderBy: { batch: { createdAt: "desc" } },
    });
    const [students, years, actors] = await Promise.all([
      prisma.student.findMany({ where: { id: { in: decisions.map((row) => row.studentId) } }, select: { id: true, permanentId: true, firstName: true, fatherName: true, grandfatherName: true } }),
      prisma.academicYear.findMany({ where: { id: { in: [...new Set(decisions.flatMap((row) => [row.batch.fromYearId, row.batch.toYearId]))] } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(decisions.map((row) => row.batch.actorUserId))] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const studentById = new Map(students.map((row) => [row.id, row]));
    const yearName = new Map(years.map((row) => [row.id, row.name]));
    const actorName = new Map(actors.map((row) => [row.id, `${row.firstName} ${row.lastName}`]));
    const query = String(req.query.q ?? "").trim().toLowerCase();
    const rows = decisions.map((row) => {
      const student = studentById.get(row.studentId);
      return {
        id: row.id,
        permanentId: student?.permanentId ?? "",
        name: student ? studentName(student) : "Student",
        fromYear: yearName.get(row.batch.fromYearId) ?? "",
        fromClass: `${levelLabel(row.fromLevel)} ${row.fromSectionName}`,
        toYear: yearName.get(row.batch.toYearId) ?? "",
        toClass: row.outcome === "ALUMNI" ? "Alumni" : row.toLevel ? `${levelLabel(row.toLevel)} ${row.toSectionName ?? ""}`.trim() : "",
        outcome: row.outcome === "PROMOTED" ? "Promoted" : row.outcome === "REPEATED" ? "Repeated" : "Alumni",
        status: "Completed",
        processedBy: actorName.get(row.batch.actorUserId) ?? "School admin",
        processedAt: row.batch.createdAt,
      };
    }).filter((row) => !query || `${row.name} ${row.permanentId} ${row.outcome}`.toLowerCase().includes(query));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

promotionRouter.get("/alumni", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const rows = await prisma.alumniRecord.findMany({
      where: {
        schoolId: school.id,
        fromLevel: { in: terminalLevelsForSchool(school.type) },
      },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });
    const [schools, years] = await Promise.all([
      prisma.school.findMany({ where: { organizationId: school.organizationId }, select: { id: true, name: true } }),
      prisma.academicYear.findMany({ where: { id: { in: rows.map((row) => row.academicYearId) } }, select: { id: true, name: true } }),
    ]);
    const schoolName = new Map(schools.map((item) => [item.id, item.name]));
    const yearName = new Map(years.map((item) => [item.id, item.name]));
    const studentIds = [...new Set(rows.map((row) => row.studentId))];
    const yearIdsForMarks = [...new Set(rows.map((row) => row.academicYearId))];
    const [enrollments, later, requests] = await Promise.all([
      prisma.enrollment.findMany({
        where: { studentId: { in: studentIds }, academicYearId: { in: yearIdsForMarks } },
        include: {
          section: true,
          classGroup: true,
          results: { where: { state: "PUBLISHED" }, include: { examSubject: { include: { exam: true } } } },
        },
      }),
      prisma.enrollment.findMany({
        where: { studentId: { in: studentIds }, status: "ACTIVE" },
        include: { school: true, classGroup: true, academicYear: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transferRequest.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const query = String(req.query.q ?? "").trim().toLowerCase();
    const stage = String(req.query.stage ?? "");
    res.json(rows.map((row) => {
      const enrollment = enrollments.find((item) => item.studentId === row.studentId && item.schoolId === row.schoolId && item.academicYearId === row.academicYearId && item.classGroup.level === row.fromLevel);
      const published = enrollment?.results.filter((item) => item.examSubject.exam.academicYearId === row.academicYearId) ?? [];
      const termRows = (term: "TERM_1" | "TERM_2") => published.filter((item) => item.examSubject.exam.term === term).map((item) => ({
        marks: item.marks,
        isAbsent: item.isAbsent,
        maxMarks: item.examSubject.maxMarks,
      }));
      const next = later.find((item) => item.studentId === row.studentId && item.schoolId !== row.schoolId) ?? later.find((item) => item.studentId === row.studentId);
      const continuedHere = Boolean(next && next.schoolId === row.schoolId);
      const request = requests.find((item) => item.studentId === row.studentId);
      const movedAway = Boolean(next && !continuedHere);
      const transferStatus = movedAway || request?.status === "COMPLETED"
        ? "Transferred"
        : request?.status === "PENDING" || request?.status === "WAITING_FOR_SECTION"
          ? "Pending"
          : request?.status === "REJECTED"
            ? "Rejected"
            : "Not transferred";
      const transferSchool = movedAway
        ? next?.school.name ?? null
        : request
          ? schoolName.get(request.toSchoolId) ?? null
          : null;
      return {
        id: row.id,
        studentId: row.studentId,
        permanentId: row.student.permanentId,
        secondaryPermanentId: next?.schoolId === school.id ? row.student.secondaryPermanentId : null,
        firstName: row.student.firstName,
        fatherName: row.student.fatherName,
        grandfatherName: row.student.grandfatherName,
        phone: row.student.phone,
        dateOfBirth: row.student.dateOfBirth,
        photoUrl: studentPhotoPath(row.student.id, row.student.photoUrl, row.student.photoStorageKey),
        rollNumber: enrollment?.rollNumber ?? null,
        name: studentName(row.student),
        gender: row.student.gender === "MALE" ? "Male" : "Female",
        schoolName: schoolName.get(row.schoolId) ?? school.name,
        stage: row.fromLevel.startsWith("CLASS_") ? "Primary" : "Secondary",
        fromLevel: levelLabel(row.fromLevel),
        sectionName: enrollment?.section.name ?? "—",
        yearName: yearName.get(row.academicYearId) ?? "",
        term1Average: averageOf(termRows("TERM_1")),
        term2Average: averageOf(termRows("TERM_2")),
        combinedAverage: averageOf([...termRows("TERM_1"), ...termRows("TERM_2")]),
        status: next ? (continuedHere ? "Continuing here" : "Transferred") : transferStatus === "Pending" ? "Pending transfer" : "Not continued",
        transferStatus,
        transferSchool,
        transferDate: movedAway ? next?.createdAt ?? null : request?.updatedAt ?? request?.createdAt ?? null,
        transferReason: request?.rejectReason ?? null,
        reason: row.reason,
        completedAt: row.createdAt,
        nextStage: next && !continuedHere ? next.school.name : next ? `${next.school.name} · ${levelLabel(next.classGroup.level)} · ${next.academicYear.name}` : transferSchool,
      };
    }).filter((row) => (!query || `${row.name} ${row.permanentId} ${row.schoolName}`.toLowerCase().includes(query)) && (!stage || row.stage === stage)));
  } catch (error) {
    next(error);
  }
});

promotionRouter.get("/alumni/:studentId", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const studentId = String(req.params.studentId);
    const [ownsAlumni, enrolledHere, transferHere] = await Promise.all([
      prisma.alumniRecord.findFirst({ where: { studentId, schoolId: school.id }, select: { id: true } }),
      prisma.enrollment.findFirst({ where: { studentId, schoolId: school.id }, select: { id: true } }),
      prisma.transferRequest.findFirst({ where: { studentId, OR: [{ fromSchoolId: school.id }, { toSchoolId: school.id }] }, select: { id: true } }),
    ]);
    if (!ownsAlumni && !enrolledHere && !transferHere) throw new HttpError(404, "Alumni record was not found.");
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: school.organizationId,
      },
      include: {
        guardians: { include: { guardian: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true, email: true } } } },
        alumniRecords: { orderBy: { createdAt: "asc" } },
        enrollments: { include: { school: true, academicYear: true, classGroup: true, section: true, fees: true } },
      },
    });
    if (!student) throw new HttpError(404, "Alumni record was not found.");
    const orgSchools = await prisma.school.findMany({ where: { organizationId: school.organizationId }, select: { id: true, name: true } });
    const schoolName = new Map(orgSchools.map((item) => [item.id, item.name]));
    const orgSchoolIds = new Set(orgSchools.map((item) => item.id));
    const seen = new Set<string>();
    const history = student.enrollments
      .filter((row) => {
        if (!orgSchoolIds.has(row.schoolId) || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .sort((a, b) => a.academicYear.startDate.getTime() - b.academicYear.startDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    const current = [...history].reverse().find((row) => row.status === "ACTIVE") ?? null;
    const enrollmentIds = history.map((row) => row.id);
    const yearIds = [...new Set([...student.alumniRecords.map((row) => row.academicYearId), ...history.map((row) => row.academicYearId)])];
    const [years, attendanceGroups, published, documents, transferRequests] = await Promise.all([
      prisma.academicYear.findMany({ where: { id: { in: yearIds } }, select: { id: true, name: true, startDate: true } }),
      enrollmentIds.length
        ? prisma.attendanceRecord.groupBy({ by: ["enrollmentId", "status"], where: { enrollmentId: { in: enrollmentIds } }, _count: { _all: true } })
        : Promise.resolve([]),
      enrollmentIds.length
        ? prisma.subjectResult.findMany({
          where: { enrollmentId: { in: enrollmentIds }, state: "PUBLISHED", examSubject: { exam: { schoolId: { in: [...orgSchoolIds] } } } },
          select: { marks: true, isAbsent: true, enrollmentId: true, examSubject: { select: { maxMarks: true, subjectId: true, exam: { select: { term: true, academicYearId: true } } } } },
        })
        : Promise.resolve([]),
      prisma.studentDocument.findMany({
        where: { studentId: student.id, schoolId: school.id, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, title: true, status: true, createdAt: true },
      }),
      prisma.transferRequest.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } }),
    ]);
    const yearName = new Map(years.map((row) => [row.id, row.name]));
    const yearStart = new Map(years.map((row) => [row.id, row.startDate.getTime()]));
    const latestRequest = transferRequests[0] ?? null;
    const ownsCurrent = current?.schoolId === school.id;
    const sentAway = Boolean((current && current.schoolId !== school.id) || (latestRequest && latestRequest.fromSchoolId === school.id && latestRequest.toSchoolId !== school.id && !ownsCurrent));
    const incoming = Boolean(latestRequest && latestRequest.toSchoolId === school.id && (latestRequest.status === "PENDING" || latestRequest.status === "WAITING_FOR_SECTION"));
    const viewer = ownsCurrent && current && current.schoolId !== student.alumniRecords[0]?.schoolId
      ? "destination"
      : incoming
        ? "destination"
        : sentAway
          ? "source"
          : "home";
    const caseStatus = latestRequest && (latestRequest.status === "PENDING" || latestRequest.status === "WAITING_FOR_SECTION") && (latestRequest.fromSchoolId === school.id || latestRequest.toSchoolId === school.id)
      ? "In the queue"
      : latestRequest?.status === "REJECTED" && !ownsCurrent
        ? "Rejected"
        : current && current.schoolId !== school.id
          ? "Enrolled"
          : viewer === "destination" && ownsCurrent
            ? "Enrolled"
            : ownsCurrent
              ? "Continued here"
              : "Still alumni";
    const destinationSchoolName = current && current.schoolId !== school.id
      ? current.school.name
      : latestRequest
        ? schoolName.get(viewer === "destination" ? latestRequest.fromSchoolId : latestRequest.toSchoolId) ?? ""
        : "";
    const continuation = viewer === "destination" && ownsCurrent && current
      ? `Added to section ${current.section.name}`
      : current && current.schoolId !== school.id
        ? `Transferred to ${current.school.name}`
        : ownsCurrent && current
          ? `Continued at this school · ${levelLabel(current.classGroup.level)}`
          : latestRequest && (latestRequest.status === "PENDING" || latestRequest.status === "WAITING_FOR_SECTION")
            ? `In the queue for ${schoolName.get(latestRequest.toSchoolId) ?? "another school"}`
            : latestRequest?.status === "REJECTED"
              ? `Rejected by ${schoolName.get(latestRequest.toSchoolId) ?? "the other school"}`
              : "Still alumni";
    const orderedRecords = recordsForViewer(student.alumniRecords, school.id);
    const ownedRecords = orderedRecords.filter((row) => row.schoolId === school.id && terminalLevelsForSchool(school.type).includes(row.fromLevel));
    const completion = ownedRecords[0] ?? orderedRecords[0] ?? null;
    const completionRoll = completion
      ? [...history].reverse().find((row) => row.schoolId === completion.schoolId && row.classGroup.level === completion.fromLevel)?.rollNumber ?? null
      : null;
    const attendanceByEnrollment = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const group of attendanceGroups) {
      const bucket = attendanceByEnrollment.get(group.enrollmentId) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      const count = group._count._all;
      if (group.status === "PRESENT") bucket.present += count;
      else if (group.status === "ABSENT") bucket.absent += count;
      else if (group.status === "LATE") bucket.late += count;
      else if (group.status === "EXCUSED") bucket.excused += count;
      bucket.total += count;
      attendanceByEnrollment.set(group.enrollmentId, bucket);
    }
    const subjects = published.length
      ? await prisma.subject.findMany({ where: { id: { in: [...new Set(published.map((row) => row.examSubject.subjectId))] } }, select: { id: true, name: true } })
      : [];
    const subjectName = new Map(subjects.map((row) => [row.id, row.name]));
    const enrollmentYear = new Map(history.map((row) => [row.id, row.academicYearId]));
    res.json({
      studentId: student.id,
      permanentId: student.permanentId,
      secondaryPermanentId: viewer === "source" ? null : student.secondaryPermanentId,
      viewer,
      caseStatus,
      continuation,
      name: studentName(student),
      firstName: student.firstName,
      fatherName: student.fatherName,
      grandfatherName: student.grandfatherName,
      phone: student.phone,
      nationalId: student.nationalId,
      dateOfBirth: student.dateOfBirth,
      photoUrl: studentPhotoPath(student.id, student.photoUrl, student.photoStorageKey),
      startedAt: history[0]?.admittedOn ?? null,
      rollNumber: viewer === "destination" && ownsCurrent && current ? current.rollNumber : completionRoll,
      gender: student.gender === "MALE" ? "Male" : "Female",
      status: student.status,
      guardians: student.guardians.map((link) => ({
        relationship: link.relationship,
        id: link.guardian.id,
        publicId: link.guardian.publicId,
        name: `${link.guardian.firstName} ${link.guardian.lastName}`,
        phone: link.guardian.phone,
        email: link.guardian.email,
      })),
      attendance: [...attendanceByEnrollment.values()].reduce((sum, row) => ({
        present: sum.present + row.present,
        absent: sum.absent + row.absent,
        late: sum.late + row.late,
        excused: sum.excused + row.excused,
        total: sum.total + row.total,
      }), { present: 0, absent: 0, late: 0, excused: 0, total: 0 }),
      fees: {
        count: history.reduce((sum, row) => sum + row.fees.length, 0),
        amount: history.reduce((sum, row) => sum + row.fees.reduce((feeSum, fee) => feeSum + fee.amount, 0), 0),
        paid: history.reduce((sum, row) => sum + row.fees.reduce((feeSum, fee) => feeSum + fee.paidAmount, 0), 0),
        balance: history.reduce((sum, row) => sum + row.fees.reduce((feeSum, fee) => feeSum + Math.max(fee.amount - fee.paidAmount, 0), 0), 0),
      },
      transfer: transferRequests[0] ? {
        status: transferRequests[0].status,
        school: schoolName.get(transferRequests[0].toSchoolId) ?? "",
        date: transferRequests[0].updatedAt,
        reason: transferRequests[0].rejectReason,
      } : null,
      currentStatus: currentStatusLabel(current?.classGroup.level ?? null, ownedRecords.length ? ownedRecords : orderedRecords, student.status),
      current: current ? {
        schoolName: viewer === "source" ? destinationSchoolName || current.school.name : current.school.name,
        stage: historyStage(current.classGroup.level),
        level: levelLabel(current.classGroup.level),
        section: viewer === "source" ? "" : current.section.name,
        yearName: current.academicYear.name,
      } : latestRequest && viewer === "source" ? {
        schoolName: destinationSchoolName,
        stage: "",
        level: "",
        section: "",
        yearName: "",
      } : null,
      records: orderedRecords.map((row) => ({
        id: row.id,
        schoolName: schoolName.get(row.schoolId) ?? "",
        stage: historyStage(row.fromLevel),
        fromLevel: levelLabel(row.fromLevel),
        yearName: yearName.get(row.academicYearId) ?? "",
        yearStart: years.find((item) => item.id === row.academicYearId)?.startDate.toISOString() ?? "",
        reason: row.reason,
        completedAt: row.createdAt,
        graduated: row.fromLevel === "CLASS_8" || row.fromLevel === "FORM_4",
        owned: row.schoolId === school.id,
      })),
      history: history.map((row, index) => {
        const next = history[index + 1];
        const alumniDate = student.alumniRecords.find((record) => record.academicYearId === row.academicYearId)?.createdAt ?? null;
        const open = row.schoolId === school.id || viewer !== "source";
        return {
          id: row.id,
          yearName: row.academicYear.name,
          schoolName: row.school.name,
          sameSchool: row.schoolId === school.id,
          open,
          stage: historyStage(row.classGroup.level),
          level: open ? levelLabel(row.classGroup.level) : "",
          section: open ? row.section.name : "",
          status: !open ? caseStatus : historyStatus(row.status),
          startedOn: open ? row.admittedOn : null,
          completedOn: open ? alumniDate ?? (row.status !== "ACTIVE" && next ? next.admittedOn : null) : null,
          attendance: open ? attendanceByEnrollment.get(row.id) ?? null : null,
        };
      }),
      results: published.filter((row) => {
        if (viewer !== "source") return true;
        return history.find((item) => item.id === row.enrollmentId)?.schoolId === school.id;
      }).map((row) => {
        const academicYearId = row.examSubject.exam.academicYearId ?? enrollmentYear.get(row.enrollmentId) ?? "";
        return {
          yearName: yearName.get(academicYearId) ?? "",
          yearStart: yearStart.get(academicYearId) ?? 0,
          term: row.examSubject.exam.term === "TERM_1" ? "Term 1" : "Term 2",
          subject: subjectName.get(row.examSubject.subjectId) ?? "Subject",
          marks: row.isAbsent ? null : row.marks,
          maxMarks: row.examSubject.maxMarks,
          absent: row.isAbsent,
        };
      }).sort((a, b) => a.yearStart - b.yearStart || a.term.localeCompare(b.term) || a.subject.localeCompare(b.subject))
        .map(({ yearStart: _yearStart, ...row }) => row),
      documents: documents.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

promotionRouter.get("/alumni-form-1-options", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const schools = await prisma.school.findMany({
      where: { organizationId: school.organizationId, isActive: true, type: { in: ["SECONDARY_ONLY", "PRIMARY_AND_SECONDARY"] } },
      include: { academicYears: { include: { classes: { where: { level: "FORM_1" }, include: { sections: { orderBy: { name: "asc" } } } } }, orderBy: { startDate: "asc" } } },
      orderBy: { name: "asc" },
    });
    res.json(schools.map((item) => ({
      id: item.id,
      name: item.name,
      sameSchool: item.id === school.id,
      years: item.academicYears.filter((year) => year.classes.some((group) => group.sections.length)).map((year) => ({
        id: year.id,
        name: year.name,
        startDate: year.startDate.toISOString().slice(0, 10),
        sections: year.classes.flatMap((group) => group.sections.map((section) => ({ id: section.id, name: section.name }))),
      })),
    })).filter((item) => item.years.length));
  } catch (error) {
    next(error);
  }
});

promotionRouter.post("/alumni/:studentId/enroll-form-1", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = z.object({
      toSchoolId: z.string().min(1),
      academicYearId: z.string().optional(),
      sectionId: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose the school that should receive this student.");
    const destination = await prisma.school.findFirst({
      where: { id: body.data.toSchoolId, organizationId: school.organizationId, isActive: true, type: { in: ["SECONDARY_ONLY", "PRIMARY_AND_SECONDARY"] } },
    });
    if (!destination) throw new HttpError(400, "Choose a school that has a secondary division.");
    const student = await prisma.student.findFirst({
      where: { id: String(req.params.studentId), organizationId: school.organizationId, status: "ALUMNI" },
      include: { alumniRecords: { where: { fromLevel: "CLASS_8", schoolId: school.id }, take: 1 } },
    });
    if (!student?.alumniRecords.length) throw new HttpError(400, "Only a completed Class 8 student can be enrolled in Form 1 as a separate step.");
    let sectionId: string | null = null;
    let academicYearId: string | null = null;
    if (body.data.sectionId || body.data.academicYearId) {
      if (!body.data.sectionId || !body.data.academicYearId) throw new HttpError(400, "Choose both the Form 1 year and section, or leave both for the other school.");
      const section = await prisma.section.findFirst({
        where: { id: body.data.sectionId, classGroup: { schoolId: destination.id, academicYearId: body.data.academicYearId, level: "FORM_1" } },
      });
      if (!section) throw new HttpError(400, "Choose a Form 1 section that exists in that academic year.");
      const [fromYear, toYear] = await Promise.all([
        prisma.academicYear.findUnique({ where: { id: student.alumniRecords[0].academicYearId } }),
        prisma.academicYear.findFirst({ where: { id: body.data.academicYearId, schoolId: destination.id } }),
      ]);
      if (!fromYear || !toYear || toYear.startDate.getTime() <= fromYear.startDate.getTime()) {
        throw new HttpError(400, "Choose a Form 1 year that starts after the Class 8 year.");
      }
      sectionId = section.id;
      academicYearId = body.data.academicYearId;
    }
    const source = await prisma.enrollment.findFirst({
      where: { studentId: student.id, schoolId: school.id, status: "ALUMNI", classGroup: { level: "CLASS_8" } },
    });
    if (!source) throw new HttpError(400, "The Class 8 enrollment was not found.");
    const active = await prisma.enrollment.findFirst({ where: { studentId: student.id, status: "ACTIVE" } });
    if (active) throw new HttpError(409, "This student already has an active enrollment.");
    const pending = await prisma.transferRequest.findFirst({
      where: { studentId: student.id, status: { in: ["PENDING", "WAITING_FOR_SECTION"] } },
    });
    if (pending) throw new HttpError(409, "This student already has a transfer request waiting for the other school.");
    const request = await prisma.transferRequest.create({
      data: {
        studentId: student.id,
        fromSchoolId: school.id,
        toSchoolId: destination.id,
        fromEnrollmentId: source.id,
        toAcademicYearId: academicYearId,
        toSectionId: sectionId,
        note: "Form 1 continuation",
        requestedByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "ALUMNI_FORM_1_REQUEST",
      entityType: "TransferRequest",
      entityId: request.id,
      summary: `Asked ${destination.name} to accept ${student.permanentId} into Form 1. A new secondary ID and roll are created only after that school accepts.`,
    });
    res.status(201).json({ id: request.id, status: request.status, school: destination.name });
  } catch (error) {
    next(error);
  }
});
