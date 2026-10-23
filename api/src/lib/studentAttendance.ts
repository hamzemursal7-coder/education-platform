import { prisma } from "./prisma.js";
import { levelLabel } from "./levels.js";

export type StudentAttendancePayload = {
  student: {
    name: string;
    permanentId: string;
    photoUrl: string | null;
    status: string;
  } | null;
  years: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
    level: string;
    section: string;
  }>;
  year: {
    id: string;
    name: string;
    isCurrent: boolean;
    school: string;
    level: string;
    section: string;
    rollNumber: number | null;
  } | null;
  today: {
    date: string;
    dayName: string;
    formattedDate: string;
    isWeekend: boolean;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "PARTIAL" | "WEEKEND" | "NO_RECORD";
    morning: { status: string; note: string | null } | null;
    afternoon: { status: string; note: string | null } | null;
    note: string | null;
  } | null;
  latestRecordedDay: {
    date: string;
    dayName: string;
    formattedDate: string;
    status: string;
    morning: { status: string; note: string | null } | null;
    afternoon: { status: string; note: string | null } | null;
    note: string | null;
  } | null;
  availableMonths: string[];
  selectedMonth: string;
  monthName: string;
  summary: {
    attendanceRate: number | null;
    totalSessions: number;
    presentSessions: number;
    absentSessions: number;
    lateSessions: number;
    excusedSessions: number;
    recordedDays: number;
    presentDays: number;
    absentDays: number;
  } | null;
  days: Array<{
    date: string;
    dayNumber: number;
    dayOfWeek: number;
    dayName: string;
    isWeekend: boolean;
    isSchoolDay: boolean;
    dayStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "PARTIAL" | "WEEKEND" | "NO_RECORD";
    morning: { status: string; note: string | null } | null;
    afternoon: { status: string; note: string | null } | null;
  }>;
  dailyLog: Array<{
    date: string;
    dayName: string;
    formattedDate: string;
    overall: string;
    morning: { status: string; note: string | null } | null;
    afternoon: { status: string; note: string | null } | null;
    note: string | null;
  }>;
  yearSummary: {
    attendanceRate: number | null;
    totalSessions: number;
    presentSessions: number;
    absentSessions: number;
    lateSessions: number;
    excusedSessions: number;
    months: Array<{
      month: string;
      monthName: string;
      totalSessions: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      rate: number | null;
    }>;
  };
};

export async function buildStudentAttendancePayload({
  studentId,
  academicYearId,
  month,
  schoolId,
}: {
  studentId: string;
  academicYearId?: string;
  month?: string;
  schoolId?: string;
}): Promise<StudentAttendancePayload> {
  const empty: StudentAttendancePayload = {
    student: null,
    years: [],
    year: null,
    today: null,
    latestRecordedDay: null,
    availableMonths: [],
    selectedMonth: "",
    monthName: "",
    summary: null,
    days: [],
    dailyLog: [],
    yearSummary: {
      attendanceRate: null,
      totalSessions: 0,
      presentSessions: 0,
      absentSessions: 0,
      lateSessions: 0,
      excusedSessions: 0,
      months: [],
    },
  };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        where: schoolId ? { schoolId } : {},
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
    return empty;
  }

  const requestedYear = academicYearId || "";
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
  let selectedMonth = typeof month === "string" && /^\d{4}-\d{2}$/.test(month)
    ? month
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

    if (dayRecords.length > 0) {
      uniqueRecordedDays++;
      const hasPresent = dayRecords.some((r) => r.status === "PRESENT");
      const hasLate = dayRecords.some((r) => r.status === "LATE");
      const hasAbsent = dayRecords.some((r) => r.status === "ABSENT");
      const hasExcused = dayRecords.some((r) => r.status === "EXCUSED");
      const allAbsent = dayRecords.every((r) => r.status === "ABSENT");

      if (dayRecords.every((r) => r.status === "PRESENT")) {
        dayStatus = "PRESENT";
        uniquePresentDays++;
      } else if (allAbsent) {
        dayStatus = "ABSENT";
        uniqueAbsentDays++;
      } else if (dayRecords.every((r) => r.status === "EXCUSED")) {
        dayStatus = "EXCUSED";
      } else if (hasLate && !hasAbsent && !hasExcused) {
        dayStatus = "LATE";
        uniquePresentDays++;
      } else if ((hasPresent || hasLate) && (hasAbsent || hasExcused)) {
        dayStatus = "PARTIAL";
        uniquePresentDays++;
      } else {
        dayStatus = "PARTIAL";
      }
    } else if (isWeekend) {
      dayStatus = "WEEKEND";
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
      const hasPresent = recs.some((r) => r.status === "PRESENT");
      const hasLate = recs.some((r) => r.status === "LATE");
      const hasAbsent = recs.some((r) => r.status === "ABSENT");
      const hasExcused = recs.some((r) => r.status === "EXCUSED");

      if (recs.every((r) => r.status === "PRESENT")) {
        overall = "PRESENT";
      } else if (recs.every((r) => r.status === "ABSENT")) {
        overall = "ABSENT";
      } else if (recs.every((r) => r.status === "EXCUSED")) {
        overall = "EXCUSED";
      } else if (hasLate && !hasAbsent && !hasExcused) {
        overall = "LATE";
      } else if ((hasPresent || hasLate) && (hasAbsent || hasExcused)) {
        overall = "PARTIAL";
      } else {
        overall = "PARTIAL";
      }

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
    const hasPresent = todayRecords.some((r) => r.status === "PRESENT");
    const hasLate = todayRecords.some((r) => r.status === "LATE");
    const hasAbsent = todayRecords.some((r) => r.status === "ABSENT");
    const hasExcused = todayRecords.some((r) => r.status === "EXCUSED");

    if (todayRecords.every((r) => r.status === "PRESENT")) todayStatus = "PRESENT";
    else if (todayRecords.every((r) => r.status === "ABSENT")) todayStatus = "ABSENT";
    else if (todayRecords.every((r) => r.status === "EXCUSED")) todayStatus = "EXCUSED";
    else if (hasLate && !hasAbsent && !hasExcused) todayStatus = "LATE";
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

  return {
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
  };
}
