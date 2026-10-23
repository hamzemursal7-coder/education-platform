import { Router } from "express";
import { z } from "zod";
import { levelLabel } from "../lib/levels.js";
import { studentPhotoPath } from "../lib/photos.js";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const saveSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string().date(),
  session: z.enum(["MORNING", "AFTERNOON"]),
  rows: z.array(z.object({
    enrollmentId: z.string(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  })),
});

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isSchoolHoliday(date: Date) {
  const weekday = date.getUTCDay();
  return weekday === 4 || weekday === 5 || weekday === 6;
}

export const attendanceRouter = Router();

attendanceRouter.get("/attendance/options", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role === "SCHOOL_ADMIN") {
      const admin = await prisma.user.findUnique({ where: { id: user.id }, include: { school: true } });
      if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
      const year = await prisma.academicYear.findFirst({ where: { schoolId: admin.school.id, isCurrent: true } });
      if (!year) {
        res.json({ schools: [] });
        return;
      }
      const years = await prisma.academicYear.findMany({
        where: { schoolId: admin.school.id },
        include: {
          classes: {
            include: { sections: { include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } } },
            orderBy: { level: "asc" },
          },
        },
        orderBy: { startDate: "desc" },
      });
      const classes = years.find((item) => item.id === year.id)?.classes ?? [];
      const mapClasses = (items: typeof classes) => items.map((item) => ({
        id: item.id,
        label: levelLabel(item.level),
        sections: item.sections.map((section) => ({ id: section.id, name: section.name, students: section._count.enrollments })),
      }));
      res.json({
        schools: [{
          id: admin.school.id,
          name: admin.school.name,
          year: { id: year.id, name: year.name },
          classes: mapClasses(classes),
          years: years.map((item) => ({
            id: item.id,
            name: item.name,
            isCurrent: item.isCurrent,
            classes: mapClasses(item.classes),
          })),
        }],
      });
      return;
    }
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, isActive: true },
      include: { assignments: true, schools: { include: { school: true } } },
    });
    if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
    const sectionIds = [...new Set(teacher.assignments.map((item) => item.sectionId))];
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, classGroup: { academicYear: { isCurrent: true } } },
      include: { classGroup: { include: { academicYear: { include: { school: true } } } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    });
    const schools = new Map<string, { id: string; name: string; year: { id: string; name: string }; classes: Map<string, { id: string; label: string; sections: Array<{ id: string; name: string; students: number }> }> }>();
    for (const section of sections) {
      const year = section.classGroup.academicYear;
      const school = year.school;
      const entry = schools.get(school.id) ?? { id: school.id, name: school.name, year: { id: year.id, name: year.name }, classes: new Map() };
      const classEntry = entry.classes.get(section.classGroup.id) ?? { id: section.classGroup.id, label: levelLabel(section.classGroup.level), sections: [] };
      classEntry.sections.push({ id: section.id, name: section.name, students: section._count.enrollments });
      entry.classes.set(section.classGroup.id, classEntry);
      schools.set(school.id, entry);
    }
    res.json({
      schools: [...schools.values()].map((school) => ({ ...school, classes: [...school.classes.values()] })),
    });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/my-sections", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.authUser!.id, isActive: true },
      include: { assignments: true },
    });
    if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
    const sectionIds = [...new Set(teacher.assignments.map((item) => item.sectionId))];
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds } },
      include: { classGroup: { include: { academicYear: true } } },
    });
    res.json(sections.map((section) => ({
      id: section.id,
      label: `${section.classGroup.academicYear.name} ${levelLabel(section.classGroup.level)} ${section.name}`,
    })));
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/attendance/day-status", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const sectionId = String(req.query.sectionId ?? "");
    const date = String(req.query.date ?? "");
    if (!sectionId || !z.string().date().safeParse(date).success) {
      throw new HttpError(400, "Choose a class section and a date.");
    }
    const section = await assertSectionAccess(req.authUser!.id, req.authUser!.role, sectionId);
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId, status: "ACTIVE" },
      select: { id: true },
    });
    const records = enrollments.length
      ? await prisma.attendanceRecord.findMany({
          where: { enrollmentId: { in: enrollments.map((item) => item.id) }, date: day(date) },
          select: { session: true, enrollmentId: true },
        })
      : [];
    const morningIds = new Set(records.filter((item) => item.session === "MORNING").map((item) => item.enrollmentId));
    const afternoonIds = new Set(records.filter((item) => item.session === "AFTERNOON").map((item) => item.enrollmentId));
    const total = enrollments.length;
    res.json({
      year: section.classGroup.academicYear.name,
      level: levelLabel(section.classGroup.level),
      section: section.name,
      currentYear: section.classGroup.academicYear.isCurrent,
      students: total,
      morning: {
        recorded: total > 0 && morningIds.size > 0,
        complete: total > 0 && morningIds.size === total,
        marked: morningIds.size,
      },
      afternoon: {
        recorded: total > 0 && afternoonIds.size > 0,
        complete: total > 0 && afternoonIds.size === total,
        marked: afternoonIds.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/attendance/monthly-absences", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const month = String(req.query.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Choose a month and year.");
    const academicYearId = String(req.query.academicYearId ?? "");
    const classId = String(req.query.classId ?? "");
    const sectionId = String(req.query.sectionId ?? "");
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    if (!academicYearId || !classId || !sectionId) {
      res.json({ month, year: null, classes: [], students: [] });
      return;
    }
    const year = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId: admin.school.id } });
    if (!year) throw new HttpError(403, "You are not allowed to access this record.");
    const classes = await prisma.classGroup.findMany({
      where: {
        schoolId: admin.school.id,
        academicYearId: year.id,
        id: classId,
        sections: { some: { id: sectionId } },
      },
      include: { sections: { where: { id: sectionId } } },
      orderBy: { level: "asc" },
    });
    const sectionIds = classes.flatMap((item) => item.sections.map((section) => section.id));
    const enrollments = sectionIds.length
      ? await prisma.enrollment.findMany({
          where: { schoolId: admin.school.id, academicYearId: year.id, sectionId: { in: sectionIds } },
          include: { student: true, classGroup: true, section: true },
        })
      : [];
    const records = enrollments.length
      ? await prisma.attendanceRecord.findMany({
          where: {
            enrollmentId: { in: enrollments.map((item) => item.id) },
            date: { gte: start, lt: end },
          },
          orderBy: [{ date: "asc" }, { session: "asc" }],
        })
      : [];
    const byClass = classes.map((group) => {
      const sectionRows = group.sections.map((section) => {
        const sectionEnrollments = enrollments.filter((item) => item.sectionId === section.id);
        const ids = new Set(sectionEnrollments.map((item) => item.id));
        const mine = records.filter((item) => ids.has(item.enrollmentId));
        const dayMap = new Map<string, { date: string; session: string; absent: number; late: number; excused: number }>();
        for (const record of mine) {
          if (isSchoolHoliday(record.date)) continue;
          const key = `${record.date.toISOString().slice(0, 10)}:${record.session}`;
          const row = dayMap.get(key) ?? {
            date: record.date.toISOString().slice(0, 10),
            session: record.session,
            absent: 0,
            late: 0,
            excused: 0,
          };
          if (record.status === "ABSENT") row.absent += 1;
          if (record.status === "LATE") row.late += 1;
          if (record.status === "EXCUSED") row.excused += 1;
          dayMap.set(key, row);
        }
        return {
          sectionId: section.id,
          section: section.name,
          students: sectionEnrollments.length,
          days: [...dayMap.values()],
        };
      });
      return {
        classId: group.id,
        label: levelLabel(group.level),
        sections: sectionRows,
      };
    });
    const people = enrollments
      .map((enrollment) => {
        const mine = records.filter((item) => item.enrollmentId === enrollment.id);
        return {
          enrollmentId: enrollment.id,
          sectionId: enrollment.sectionId,
          permanentId: enrollment.student.permanentId,
          rollNumber: enrollment.rollNumber,
          name: `${enrollment.student.firstName} ${enrollment.student.fatherName} ${enrollment.student.grandfatherName}`,
          level: levelLabel(enrollment.classGroup.level),
          section: enrollment.section.name,
          days: mine.filter((item) => !isSchoolHoliday(item.date)).map((item) => ({
            date: item.date.toISOString().slice(0, 10),
            session: item.session,
            status: item.status,
            note: item.note ?? "",
          })),
        };
      })
      .filter((row) => !q || `${row.name} ${row.permanentId} ${row.rollNumber}`.toLowerCase().includes(q));
    res.json({
      month,
      year: year ? { id: year.id, name: year.name } : null,
      classes: byClass,
      students: people,
    });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/attendance-sheet", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const sectionId = String(req.query.sectionId ?? "");
    const date = String(req.query.date ?? "");
    const session = String(req.query.session ?? "");
    if (!z.string().date().safeParse(date).success) {
      throw new HttpError(400, "Choose a date.");
    }
    if (session && session !== "MORNING" && session !== "AFTERNOON") {
      throw new HttpError(400, "Choose Morning or Afternoon.");
    }
    const section = await assertSectionAccess(req.authUser!.id, req.authUser!.role, sectionId);
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { rollNumber: "asc" },
    });
    const records = await prisma.attendanceRecord.findMany({
      where: { enrollmentId: { in: enrollments.map((item) => item.id) }, date: day(date) },
    });
    const recorded = (value: "MORNING" | "AFTERNOON") => records.some((item) => item.session === value);
    res.json({
      year: section.classGroup.academicYear.name,
      level: levelLabel(section.classGroup.level),
      section: section.name,
      currentYear: section.classGroup.academicYear.isCurrent,
      students: enrollments.length,
      morningRecorded: recorded("MORNING"),
      afternoonRecorded: recorded("AFTERNOON"),
      rows: enrollments.map((enrollment, index) => {
        const record = records.find((item) => item.enrollmentId === enrollment.id && item.session === session);
        return {
          enrollmentId: enrollment.id,
          number: index + 1,
          rollNumber: enrollment.rollNumber,
          permanentId: enrollment.student.permanentId,
          photoUrl: studentPhotoPath(enrollment.student.id, enrollment.student.photoUrl, enrollment.student.photoStorageKey),
          student: `${enrollment.student.firstName} ${enrollment.student.fatherName}`,
          status: record?.status ?? null,
          note: record?.note ?? "",
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/attendance-month", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const sectionId = String(req.query.sectionId ?? "");
    const month = String(req.query.month ?? "");
    const enrollmentId = String(req.query.enrollmentId ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Choose a month.");
    await assertSectionAccess(req.authUser!.id, req.authUser!.role, sectionId);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId, status: "ACTIVE", ...(enrollmentId ? { id: enrollmentId } : {}) },
      include: { student: true },
      orderBy: { rollNumber: "asc" },
    });
    const records = await prisma.attendanceRecord.findMany({
      where: { enrollmentId: { in: enrollments.map((item) => item.id) }, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
    res.json(enrollments.map((enrollment) => {
      const mine = records.filter((item) => item.enrollmentId === enrollment.id);
      const count = (status: string) => mine.filter((item) => item.status === status).length;
      return {
        enrollmentId: enrollment.id,
        permanentId: enrollment.student.permanentId,
        rollNumber: enrollment.rollNumber,
        student: `${enrollment.student.firstName} ${enrollment.student.fatherName}`,
        present: count("PRESENT"),
        absent: count("ABSENT"),
        late: count("LATE"),
        excused: count("EXCUSED"),
        days: mine.map((item) => ({
          date: item.date.toISOString().slice(0, 10),
          session: item.session,
          status: item.status,
          note: item.note ?? "",
        })),
      };
    }));
  } catch (error) {
    next(error);
  }
});

attendanceRouter.put("/attendance-sheet", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const body = saveSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Attendance could not be saved.");
    const section = await assertSectionAccess(req.authUser!.id, req.authUser!.role, body.data.sectionId);
    if (!section.classGroup.academicYear.isCurrent) {
      throw new HttpError(400, "Attendance can only be taken for the current academic year.");
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: body.data.sectionId, status: "ACTIVE" },
      select: { id: true },
    });
    const allowed = new Set(enrollments.map((item) => item.id));
    await prisma.$transaction(
      body.data.rows
        .filter((row) => allowed.has(row.enrollmentId))
        .map((row) => prisma.attendanceRecord.upsert({
          where: {
            enrollmentId_date_session: {
              enrollmentId: row.enrollmentId,
              date: day(body.data.date),
              session: body.data.session,
            },
          },
          update: { status: row.status, note: row.note?.trim() || null, markedByUserId: req.authUser!.id },
          create: {
            enrollmentId: row.enrollmentId,
            date: day(body.data.date),
            session: body.data.session,
            status: row.status,
            note: row.note?.trim() || null,
            markedByUserId: req.authUser!.id,
          },
        })),
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

async function assertSectionAccess(userId: string, role: string, sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { classGroup: { include: { academicYear: true } } },
  });
  if (!section) throw new HttpError(404, "Section was not found.");
  if (role === "SCHOOL_ADMIN") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.schoolId !== section.classGroup.schoolId) throw new HttpError(403, "You are not allowed to access this record.");
    return section;
  }
  const teacher = await prisma.teacher.findFirst({
    where: { userId, isActive: true, assignments: { some: { sectionId } } },
  });
  if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
  return section;
}

function reasonBucket(note: string | null) {
  const text = note?.trim() || "";
  if (/medic/i.test(text)) return "Medical";
  if (/family/i.test(text)) return "Family Event";
  if (/official/i.test(text)) return "Official Work";
  return text || "Other";
}

attendanceRouter.get("/attendance/dashboard", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const schoolId = admin.school.id;
    const years = await prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: "desc" } });
    const yearId = String(req.query.academicYearId ?? "") || years.find((item) => item.isCurrent)?.id || years[0]?.id || "";
    const classId = String(req.query.classId ?? "");
    const sectionId = String(req.query.sectionId ?? "");
    const month = String(req.query.month ?? "");
    let from = String(req.query.from ?? "");
    let to = String(req.query.to ?? "");
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      from = `${month}-01`;
      const end = new Date(`${month}-01T00:00:00.000Z`);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
      to = end.toISOString().slice(0, 10);
    }
    if (!from || !to) {
      const now = new Date();
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    }
    const classes = yearId
      ? await prisma.classGroup.findMany({
        where: { academicYearId: yearId, schoolId },
        include: { sections: true },
        orderBy: { level: "asc" },
      })
      : [];
    const sectionIds = sectionId
      ? [sectionId]
      : classes.filter((item) => !classId || item.id === classId).flatMap((item) => item.sections.map((section) => section.id));
    const enrollments = sectionIds.length
      ? await prisma.enrollment.findMany({
        where: { schoolId, sectionId: { in: sectionIds }, ...(yearId ? { academicYearId: yearId } : {}) },
        include: { student: true, classGroup: true, section: true },
        orderBy: [{ sectionId: "asc" }, { rollNumber: "asc" }],
      })
      : [];
    const records = enrollments.length
      ? await prisma.attendanceRecord.findMany({
        where: {
          enrollmentId: { in: enrollments.map((item) => item.id) },
          date: { gte: day(from), lte: day(to) },
        },
        orderBy: { date: "asc" },
      })
      : [];
    const counted = records.filter((item) => !isSchoolHoliday(item.date));
    const count = (status: string, list = counted) => list.filter((item) => item.status === status).length;
    const present = count("PRESENT");
    const absent = count("ABSENT");
    const late = count("LATE");
    const excused = count("EXCUSED");
    const recorded = counted.length;
    const percent = (value: number) => (recorded ? Math.round((value / recorded) * 1000) / 10 : 0);
    const trendMap = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const record of counted) {
      const key = record.date.toISOString().slice(0, 10);
      const row = trendMap.get(key) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      if (record.status === "PRESENT") row.present += 1;
      if (record.status === "ABSENT") row.absent += 1;
      if (record.status === "LATE") row.late += 1;
      if (record.status === "EXCUSED") row.excused += 1;
      trendMap.set(key, row);
    }
    const reasonMap = new Map<string, number>();
    for (const record of counted.filter((item) => item.status === "EXCUSED")) {
      const key = reasonBucket(record.note);
      reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
    }
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const statusFilter = String(req.query.status ?? "ALL");
    const students = enrollments.map((enrollment) => {
      const mine = counted.filter((item) => item.enrollmentId === enrollment.id);
      const presentCount = count("PRESENT", mine);
      const absentCount = count("ABSENT", mine);
      const lateCount = count("LATE", mine);
      const excusedCount = count("EXCUSED", mine);
      const total = mine.length;
      const latestExcuse = [...mine].reverse().find((item) => item.status === "EXCUSED");
      const attendancePercent = total ? Math.round((presentCount / total) * 1000) / 10 : null;
      return {
        enrollmentId: enrollment.id,
        sectionId: enrollment.sectionId,
        permanentId: enrollment.student.permanentId,
        rollNumber: enrollment.rollNumber,
        name: `${enrollment.student.firstName} ${enrollment.student.fatherName}`,
        level: levelLabel(enrollment.classGroup.level),
        section: enrollment.section.name,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        recorded: total,
        percent: attendancePercent,
        status: attendancePercent == null ? "No records" : attendancePercent >= 90 ? "Good" : attendancePercent >= 75 ? "Fair" : "Low",
        reason: latestExcuse?.note ?? "",
      };
    }).filter((row) => {
      if (q && !`${row.name} ${row.permanentId} ${row.rollNumber}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      return true;
    });
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = 8;
    res.json({
      school: { id: admin.school.id, name: admin.school.name },
      filters: { from, to, academicYearId: yearId, classId, sectionId },
      years: years.map((item) => ({ id: item.id, name: item.name, isCurrent: item.isCurrent })),
      classes: classes.map((item) => ({
        id: item.id,
        label: levelLabel(item.level),
        sections: item.sections.map((section) => ({ id: section.id, name: section.name })),
      })),
      summary: {
        students: enrollments.length,
        present,
        absent,
        late,
        excused,
        recorded,
        presentPercent: percent(present),
        absentPercent: percent(absent),
        latePercent: percent(late),
        excusedPercent: percent(excused),
      },
      trend: [...trendMap.entries()].map(([date, row]) => ({ date, ...row })),
      reasons: [...reasonMap.entries()].map(([label, value]) => ({ label, value })),
      students,
      page,
      pages: Math.max(1, Math.ceil(students.length / pageSize)),
      pageRows: students.slice((page - 1) * pageSize, page * pageSize),
    });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/attendance/excused", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const sectionId = String(req.query.sectionId ?? "");
    const records = await prisma.attendanceRecord.findMany({
      where: {
        status: "EXCUSED",
        ...(from && to ? { date: { gte: day(from), lte: day(to) } } : {}),
        enrollment: {
          schoolId: admin.school.id,
          ...(sectionId ? { sectionId } : {}),
        },
      },
      include: {
        enrollment: { include: { student: true, classGroup: true, section: true } },
      },
      orderBy: { date: "desc" },
    });
    const actors = await prisma.user.findMany({
      where: { id: { in: [...new Set(records.map((item) => item.markedByUserId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    res.json(records.map((record) => ({
      id: record.id,
      date: record.date.toISOString().slice(0, 10),
      session: record.session,
      status: record.status,
      note: record.note ?? "",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      student: `${record.enrollment.student.firstName} ${record.enrollment.student.fatherName}`,
      permanentId: record.enrollment.student.permanentId,
      level: levelLabel(record.enrollment.classGroup.level),
      section: record.enrollment.section.name,
      teacher: actors.find((item) => item.id === record.markedByUserId)
        ? `${actors.find((item) => item.id === record.markedByUserId)!.firstName} ${actors.find((item) => item.id === record.markedByUserId)!.lastName}`
        : "Unknown",
    })));
  } catch (error) {
    next(error);
  }
});

attendanceRouter.patch("/attendance-records/:id", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!admin?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const body = z.object({
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      note: z.string().trim().max(200).optional().or(z.literal("")),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a valid attendance status.");
    const record = await prisma.attendanceRecord.findFirst({
      where: { id: String(req.params.id), enrollment: { schoolId: admin.school.id } },
      include: { enrollment: { include: { student: true } } },
    });
    if (!record) throw new HttpError(404, "Attendance record was not found.");
    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: body.data.status,
        note: body.data.note?.trim() || null,
        markedByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: admin.school.id,
      actorUserId: req.authUser!.id,
      action: "ATTENDANCE_CORRECTED",
      entityType: "AttendanceRecord",
      entityId: record.id,
      summary: `${record.enrollment.student.permanentId} ${record.date.toISOString().slice(0, 10)} ${record.session}: ${record.status} → ${updated.status}`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get("/student/attendance", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) throw new HttpError(403, "You are not allowed to access this record.");

    const empty = {
      student: null,
      years: [],
      year: null,
      availableMonths: [],
      selectedMonth: "",
      monthName: "",
      summary: null,
      days: [],
      dailyLog: [],
      yearSummary: { attendanceRate: null, totalSessions: 0, presentSessions: 0, absentSessions: 0, lateSessions: 0, excusedSessions: 0, months: [] },
    };

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
        enrollments: {
          where: user.schoolId ? { schoolId: user.schoolId } : {},
          include: {
            school: true,
            academicYear: true,
            classGroup: true,
            section: true,
          },
          orderBy: { academicYear: { startDate: "desc" } },
        },
      },
    });

    if (!student || !student.enrollments.length) {
      res.json(empty);
      return;
    }

    const requestedYear = typeof req.query.academicYearId === "string" ? req.query.academicYearId : "";
    const enrollment = student.enrollments.find((row) => row.academicYearId === requestedYear)
      ?? student.enrollments.find((row) => row.academicYear.isCurrent)
      ?? student.enrollments[0];

    // Load all attendance records for this enrollment
    const allRecords = await prisma.attendanceRecord.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: [{ date: "asc" }, { session: "asc" }],
    });

    // Determine available months in this academic year
    const startYear = enrollment.academicYear.startDate.getUTCFullYear();
    const startMonth = enrollment.academicYear.startDate.getUTCMonth();
    const endYear = enrollment.academicYear.endDate.getUTCFullYear();
    const endMonth = enrollment.academicYear.endDate.getUTCMonth();

    const monthsSet = new Set<string>();
    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const monthStr = `${curY}-${String(curM + 1).padStart(2, "0")}`;
      monthsSet.add(monthStr);
      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }
    for (const r of allRecords) {
      monthsSet.add(r.date.toISOString().slice(0, 7));
    }

    const availableMonths = [...monthsSet].sort();

    // Determine active selected month
    let selectedMonth = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : "";

    if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
      const recordedMonths = [...new Set(allRecords.map((r) => r.date.toISOString().slice(0, 7)))].sort();
      selectedMonth = recordedMonths.at(-1) || availableMonths.at(-1) || new Date().toISOString().slice(0, 7);
    }

    const monthStart = new Date(`${selectedMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const monthRecords = allRecords.filter((r) => r.date >= monthStart && r.date < monthEnd);

    // Metrics for the month
    const countSession = (st: string) => monthRecords.filter((r) => r.status === st).length;
    const presentSessions = countSession("PRESENT");
    const absentSessions = countSession("ABSENT");
    const lateSessions = countSession("LATE");
    const excusedSessions = countSession("EXCUSED");
    const totalSessions = monthRecords.length;

    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();

    const recordsByDay = new Map<string, typeof monthRecords>();
    for (const r of monthRecords) {
      const dayKey = r.date.toISOString().slice(0, 10);
      const list = recordsByDay.get(dayKey) ?? [];
      list.push(r);
      recordsByDay.set(dayKey, list);
    }

    const calendarDays = [];
    let uniquePresentDays = 0;
    let uniqueAbsentDays = 0;
    let uniqueRecordedDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d));
      const dateStr = dayDate.toISOString().slice(0, 10);
      const dayOfWeek = dayDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const dayRecords = recordsByDay.get(dateStr) ?? [];

      const morning = dayRecords.find((r) => r.session === "MORNING") ?? null;
      const afternoon = dayRecords.find((r) => r.session === "AFTERNOON") ?? null;

      let dayStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "PARTIAL" | "WEEKEND" | "NO_RECORD" = "NO_RECORD";

      if (isWeekend) {
        dayStatus = "WEEKEND";
      } else if (dayRecords.length > 0) {
        uniqueRecordedDays++;
        const hasPresent = dayRecords.some((r) => r.status === "PRESENT");
        const hasLate = dayRecords.some((r) => r.status === "LATE");
        const hasExcused = dayRecords.some((r) => r.status === "EXCUSED");
        const allAbsent = dayRecords.every((r) => r.status === "ABSENT");

        if (dayRecords.every((r) => r.status === "PRESENT")) {
          dayStatus = "PRESENT";
          uniquePresentDays++;
        } else if (allAbsent) {
          dayStatus = "ABSENT";
          uniqueAbsentDays++;
        } else if (hasExcused && !hasPresent && !hasLate) {
          dayStatus = "EXCUSED";
        } else if (hasLate) {
          dayStatus = "LATE";
          uniquePresentDays++;
        } else if (hasPresent) {
          dayStatus = "PARTIAL";
          uniquePresentDays++;
        }
      }

      calendarDays.push({
        date: dateStr,
        dayNumber: d,
        dayOfWeek,
        dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek],
        isWeekend,
        isSchoolDay: !isWeekend,
        dayStatus,
        morning: morning ? { status: morning.status, note: morning.note } : null,
        afternoon: afternoon ? { status: afternoon.status, note: afternoon.note } : null,
      });
    }

    // Daily chronological log
    const dailyLog = [...recordsByDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateStr, recs]) => {
        const dObj = new Date(`${dateStr}T00:00:00.000Z`);
        const dayOfWeek = dObj.getUTCDay();
        const morning = recs.find((r) => r.session === "MORNING");
        const afternoon = recs.find((r) => r.session === "AFTERNOON");

        let overall = "PRESENT";
        if (recs.every((r) => r.status === "ABSENT")) overall = "ABSENT";
        else if (recs.some((r) => r.status === "LATE")) overall = "LATE";
        else if (recs.every((r) => r.status === "EXCUSED")) overall = "EXCUSED";
        else if (recs.some((r) => r.status === "PRESENT")) overall = "PRESENT";

        return {
          date: dateStr,
          dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
          formattedDate: dObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          overall,
          morning: morning ? { status: morning.status, note: morning.note } : null,
          afternoon: afternoon ? { status: afternoon.status, note: afternoon.note } : null,
          note: morning?.note || afternoon?.note || null,
        };
      });

    const monthRate = totalSessions > 0
      ? Math.round(((presentSessions + lateSessions * 0.75 + excusedSessions) / totalSessions) * 100)
      : null;

    // Academic Year overall stats
    const yearPresent = allRecords.filter((r) => r.status === "PRESENT").length;
    const yearLate = allRecords.filter((r) => r.status === "LATE").length;
    const yearExcused = allRecords.filter((r) => r.status === "EXCUSED").length;
    const yearAbsent = allRecords.filter((r) => r.status === "ABSENT").length;
    const yearTotal = allRecords.length;
    const yearRate = yearTotal > 0
      ? Math.round(((yearPresent + yearLate * 0.75 + yearExcused) / yearTotal) * 100)
      : null;

    const monthTrend = availableMonths.map((m) => {
      const mRecs = allRecords.filter((r) => r.date.toISOString().slice(0, 7) === m);
      const mPres = mRecs.filter((r) => r.status === "PRESENT").length;
      const mLate = mRecs.filter((r) => r.status === "LATE").length;
      const mExc = mRecs.filter((r) => r.status === "EXCUSED").length;
      const mAbs = mRecs.filter((r) => r.status === "ABSENT").length;
      const mTot = mRecs.length;
      const mRate = mTot > 0 ? Math.round(((mPres + mLate * 0.75 + mExc) / mTot) * 100) : null;
      const dObj = new Date(`${m}-01T00:00:00.000Z`);
      return {
        month: m,
        monthName: dObj.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        totalSessions: mTot,
        present: mPres,
        absent: mAbs,
        late: mLate,
        excused: mExc,
        rate: mRate,
      };
    }).filter((item) => item.totalSessions > 0);

    // Compute today's check-in details
    const now = new Date();
    const todayDateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayIso = todayDateOnly.toISOString().slice(0, 10);
    const todayDayOfWeek = todayDateOnly.getUTCDay();
    const isTodayWeekend = todayDayOfWeek === 5 || todayDayOfWeek === 6;

    const todayRecords = await prisma.attendanceRecord.findMany({
      where: {
        enrollment: { studentId: student.id },
        date: todayDateOnly,
      },
    });

    const todayMorning = todayRecords.find((r) => r.session === "MORNING");
    const todayAfternoon = todayRecords.find((r) => r.session === "AFTERNOON");

    let todayStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "PARTIAL" | "WEEKEND" | "NO_RECORD" = "NO_RECORD";
    if (todayRecords.length > 0) {
      if (todayRecords.every((r) => r.status === "ABSENT")) todayStatus = "ABSENT";
      else if (todayRecords.some((r) => r.status === "LATE")) todayStatus = "LATE";
      else if (todayRecords.every((r) => r.status === "EXCUSED")) todayStatus = "EXCUSED";
      else if (todayRecords.every((r) => r.status === "PRESENT")) todayStatus = "PRESENT";
      else todayStatus = "PARTIAL";
    } else if (isTodayWeekend) {
      todayStatus = "WEEKEND";
    }

    const todayPayload = {
      date: todayIso,
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][todayDayOfWeek],
      formattedDate: todayDateOnly.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      isWeekend: isTodayWeekend,
      status: todayStatus,
      morning: todayMorning ? { status: todayMorning.status, note: todayMorning.note } : null,
      afternoon: todayAfternoon ? { status: todayAfternoon.status, note: todayAfternoon.note } : null,
      note: todayMorning?.note || todayAfternoon?.note || null,
    };

    // Find the latest recorded attendance for student
    const latestRec = allRecords[0];
    let latestPayload = null;
    if (latestRec) {
      const latDate = latestRec.date;
      const latDateOnly = new Date(Date.UTC(latDate.getUTCFullYear(), latDate.getUTCMonth(), latDate.getUTCDate()));
      const latDayOfWeek = latDateOnly.getUTCDay();
      const latRecs = allRecords.filter((r) => r.date.getTime() === latDate.getTime());
      const latMorning = latRecs.find((r) => r.session === "MORNING");
      const latAfternoon = latRecs.find((r) => r.session === "AFTERNOON");

      let latStatus = "PRESENT";
      if (latRecs.every((r) => r.status === "ABSENT")) latStatus = "ABSENT";
      else if (latRecs.some((r) => r.status === "LATE")) latStatus = "LATE";
      else if (latRecs.every((r) => r.status === "EXCUSED")) latStatus = "EXCUSED";

      latestPayload = {
        date: latDateOnly.toISOString().slice(0, 10),
        dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][latDayOfWeek],
        formattedDate: latDateOnly.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        status: latStatus,
        morning: latMorning ? { status: latMorning.status, note: latMorning.note } : null,
        afternoon: latAfternoon ? { status: latAfternoon.status, note: latAfternoon.note } : null,
        note: latMorning?.note || latAfternoon?.note || null,
      };
    }

    res.json({
      student: {
        name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`.replace(/\s+/g, " ").trim(),
        permanentId: student.secondaryPermanentId ?? student.permanentId,
        photoUrl: student.photoUrl,
        status: student.status,
      },
      years: student.enrollments.map((e) => ({
        id: e.academicYearId,
        name: e.academicYear.name,
        isCurrent: e.academicYear.isCurrent,
        level: levelLabel(e.classGroup.level),
        section: e.section.name,
      })),
      year: {
        id: enrollment.academicYearId,
        name: enrollment.academicYear.name,
        isCurrent: enrollment.academicYear.isCurrent,
        school: enrollment.school.name,
        level: levelLabel(enrollment.classGroup.level),
        section: enrollment.section.name,
        rollNumber: enrollment.rollNumber,
      },
      today: todayPayload,
      latestRecordedDay: latestPayload,
      availableMonths,
      selectedMonth,
      monthName: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      summary: {
        attendanceRate: monthRate,
        totalSessions,
        presentSessions,
        absentSessions,
        lateSessions,
        excusedSessions,
        recordedDays: uniqueRecordedDays,
        presentDays: uniquePresentDays,
        absentDays: uniqueAbsentDays,
      },
      days: calendarDays,
      dailyLog,
      yearSummary: {
        attendanceRate: yearRate,
        totalSessions: yearTotal,
        presentSessions: yearPresent,
        absentSessions: yearAbsent,
        lateSessions: yearLate,
        excusedSessions: yearExcused,
        months: monthTrend,
      },
    });
  } catch (error) {
    next(error);
  }
});
