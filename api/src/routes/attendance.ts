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
      const classes = await prisma.classGroup.findMany({
        where: { academicYearId: year.id },
        include: { sections: { include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } } },
        orderBy: { level: "asc" },
      });
      res.json({
        schools: [{
          id: admin.school.id,
          name: admin.school.name,
          year: { id: year.id, name: year.name },
          classes: classes.map((item) => ({
            id: item.id,
            label: levelLabel(item.level),
            sections: item.sections.map((section) => ({ id: section.id, name: section.name, students: section._count.enrollments })),
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

attendanceRouter.get("/attendance-sheet", requireAuth, requireRole("TEACHER", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const sectionId = String(req.query.sectionId ?? "");
    const date = String(req.query.date ?? "");
    const session = String(req.query.session ?? "");
    if (!z.string().date().safeParse(date).success || (session !== "MORNING" && session !== "AFTERNOON")) {
      throw new HttpError(400, "Choose a date and Morning or Afternoon.");
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
    if (body.data.rows.some((row) => row.status === "EXCUSED" && !row.note?.trim())) {
      throw new HttpError(400, "An excused student needs a reason.");
    }
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
    const count = (status: string, list = records) => list.filter((item) => item.status === status).length;
    const present = count("PRESENT");
    const absent = count("ABSENT");
    const late = count("LATE");
    const excused = count("EXCUSED");
    const recorded = records.length;
    const percent = (value: number) => (recorded ? Math.round((value / recorded) * 1000) / 10 : 0);
    const trendMap = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const record of records) {
      const key = record.date.toISOString().slice(0, 10);
      const row = trendMap.get(key) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      if (record.status === "PRESENT") row.present += 1;
      if (record.status === "ABSENT") row.absent += 1;
      if (record.status === "LATE") row.late += 1;
      if (record.status === "EXCUSED") row.excused += 1;
      trendMap.set(key, row);
    }
    const reasonMap = new Map<string, number>();
    for (const record of records.filter((item) => item.status === "EXCUSED")) {
      const key = reasonBucket(record.note);
      reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
    }
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const statusFilter = String(req.query.status ?? "ALL");
    const students = enrollments.map((enrollment) => {
      const mine = records.filter((item) => item.enrollmentId === enrollment.id);
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
    if (body.data.status === "EXCUSED" && !body.data.note?.trim()) throw new HttpError(400, "An excused student needs a reason.");
    const record = await prisma.attendanceRecord.findFirst({
      where: { id: String(req.params.id), enrollment: { schoolId: admin.school.id } },
      include: { enrollment: { include: { student: true } } },
    });
    if (!record) throw new HttpError(404, "Attendance record was not found.");
    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: body.data.status,
        note: body.data.status === "EXCUSED" ? body.data.note?.trim() || null : null,
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
