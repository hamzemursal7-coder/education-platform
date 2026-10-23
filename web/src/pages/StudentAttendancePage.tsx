import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Hash,
  School,
  ArrowLeft,
  Sparkles,
  FileText,
  CalendarCheck2,
  ListFilter,
  Info,
} from "lucide-react";
import { api } from "../lib/api";

type DaySession = {
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  note: string | null;
};

type CalendarDay = {
  date: string;
  dayNumber: number;
  dayOfWeek: number;
  dayName: string;
  isWeekend: boolean;
  isSchoolDay: boolean;
  dayStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "PARTIAL" | "WEEKEND" | "NO_RECORD";
  morning: DaySession | null;
  afternoon: DaySession | null;
};

type DailyLogEntry = {
  date: string;
  dayName: string;
  formattedDate: string;
  overall: string;
  morning: DaySession | null;
  afternoon: DaySession | null;
  note: string | null;
};

type MonthSummary = {
  attendanceRate: number | null;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  lateSessions: number;
  excusedSessions: number;
  recordedDays: number;
  presentDays: number;
  absentDays: number;
};

type YearMonthTrend = {
  month: string;
  monthName: string;
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number | null;
};

type StudentAttendanceData = {
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
  availableMonths: string[];
  selectedMonth: string;
  monthName: string;
  summary: MonthSummary | null;
  days: CalendarDay[];
  dailyLog: DailyLogEntry[];
  yearSummary: {
    attendanceRate: number | null;
    totalSessions: number;
    presentSessions: number;
    absentSessions: number;
    lateSessions: number;
    excusedSessions: number;
    months: YearMonthTrend[];
  };
};

export function StudentAttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<StudentAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"monthly" | "daily">("monthly");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDayDetail, setSelectedDayDetail] = useState<CalendarDay | null>(null);

  const yearId = searchParams.get("academicYearId") || "";
  const month = searchParams.get("month") || "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (yearId) params.set("academicYearId", yearId);
    if (month) params.set("month", month);

    api<StudentAttendanceData>(`/api/v1/student/attendance?${params.toString()}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          // Auto select first day with records for detail drawer if in calendar
          const firstRecorded = res.days.find((d) => d.dayStatus !== "NO_RECORD" && d.dayStatus !== "WEEKEND");
          setSelectedDayDetail(firstRecorded || null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load attendance records.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [yearId, month]);

  function changeYear(newYearId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("academicYearId", newYearId);
    next.delete("month"); // reset to latest month of that year
    setSearchParams(next);
  }

  function changeMonth(newMonth: string) {
    const next = new URLSearchParams(searchParams);
    next.set("month", newMonth);
    setSearchParams(next);
  }

  function navigateMonth(direction: "prev" | "next") {
    if (!data?.availableMonths.length || !data.selectedMonth) return;
    const idx = data.availableMonths.indexOf(data.selectedMonth);
    if (idx === -1) return;
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < data.availableMonths.length) {
      changeMonth(data.availableMonths[targetIdx]);
    }
  }

  const currentMonthIdx = data?.availableMonths.indexOf(data.selectedMonth) ?? -1;
  const hasPrevMonth = currentMonthIdx > 0;
  const hasNextMonth = currentMonthIdx >= 0 && currentMonthIdx < (data?.availableMonths.length ?? 0) - 1;

  // Filter daily log
  const filteredDailyLog = (data?.dailyLog ?? []).filter((entry) => {
    if (statusFilter === "ALL") return true;
    return entry.overall === statusFilter;
  });

  return (
    <div className="space-y-5 pb-10">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* 1. Header Hero Card with Switchers */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Student Profile Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {data?.student?.photoUrl ? (
              <img
                src={data.student.photoUrl}
                alt={data.student.name}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover ring-2 ring-blue-100 shadow-sm"
              />
            ) : (
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm ring-2 ring-blue-100">
                <UserRound className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                  {data?.student?.name ?? "Student Attendance"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                    data?.student?.status === "ALUMNI"
                      ? "bg-purple-50 text-purple-700 ring-purple-600/20"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      data?.student?.status === "ALUMNI" ? "bg-purple-600" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  {data?.student?.status ?? "ACTIVE"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200/60">
                  <Hash className="h-3 w-3 text-blue-600" />
                  ID: <span className="font-semibold text-slate-900">{data?.student?.permanentId ?? "—"}</span>
                </span>
                {data?.year?.rollNumber != null ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200/60">
                    Roll: <span className="font-semibold text-slate-900">#{data.year.rollNumber}</span>
                  </span>
                ) : null}
                {data?.year?.school ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200/60">
                    <School className="h-3 w-3 text-blue-600" />
                    {data.year.school}
                  </span>
                ) : null}
                {data?.year ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 ring-1 ring-blue-100">
                    <GraduationCap className="h-3 w-3" />
                    {data.year.level} · Section {data.year.section}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Controls: Year Selector & Link to Dashboard */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <Link
              to="/student/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Academic Results
            </Link>

            {/* Academic Year Switcher */}
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-700 shadow-2xs">
              <CalendarIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="font-medium text-slate-500">Year:</span>
              <select
                className="bg-transparent font-semibold text-slate-900 outline-none cursor-pointer"
                value={yearId || data?.year?.id || ""}
                onChange={(e) => changeYear(e.target.value)}
              >
                {(data?.years ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* 2. Month Selector & KPI Metrics Row */}
      <section className="space-y-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <CalendarCheck2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Attendance Overview</h2>
              <p className="text-xs text-slate-500">Daily and monthly tracking record</p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              disabled={!hasPrevMonth}
              onClick={() => navigateMonth("prev")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 shadow-2xs outline-none cursor-pointer hover:border-slate-300 transition-colors"
              value={data?.selectedMonth || ""}
              onChange={(e) => changeMonth(e.target.value)}
            >
              {(data?.availableMonths ?? []).map((mStr) => {
                const dateObj = new Date(`${mStr}-01T00:00:00.000Z`);
                const label = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                return (
                  <option key={mStr} value={mStr}>
                    {label}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              disabled={!hasNextMonth}
              onClick={() => navigateMonth("next")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Attendance Rate */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
              <span>Attendance Rate</span>
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {data?.summary?.attendanceRate !== null && data?.summary?.attendanceRate !== undefined
                  ? `${data.summary.attendanceRate}%`
                  : "—"}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                  (data?.summary?.attendanceRate ?? 0) >= 90
                    ? "bg-emerald-50 text-emerald-700"
                    : (data?.summary?.attendanceRate ?? 0) >= 75
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {(data?.summary?.attendanceRate ?? 0) >= 90
                  ? "Excellent"
                  : (data?.summary?.attendanceRate ?? 0) >= 75
                    ? "Good"
                    : "Low"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              {data?.monthName || "Selected month"}
            </p>
          </div>

          {/* Card 2: Present Days / Sessions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
              <span>Present Days</span>
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {data?.summary?.presentDays ?? 0}
              </span>
              <span className="text-xs text-slate-500">
                / {data?.summary?.recordedDays ?? 0} school days
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium truncate">
              {data?.summary?.presentSessions ?? 0} sessions present
            </p>
          </div>

          {/* Card 3: Late Arrivals */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
              <span>Late Arrivals</span>
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {data?.summary?.lateSessions ?? 0}
              </span>
              <span className="text-xs text-slate-500">sessions late</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              {data?.summary?.lateSessions ? "Recorded late arrival" : "No late check-ins"}
            </p>
          </div>

          {/* Card 4: Absences & Excused */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
              <span>Absences & Excuses</span>
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-rose-50 text-rose-600">
                <AlertCircle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {data?.summary?.absentSessions ?? 0}
              </span>
              <span className="text-xs text-slate-500">absent</span>
              <span className="text-xs text-blue-600 font-semibold">
                · {data?.summary?.excusedSessions ?? 0} excused
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              {data?.summary?.absentSessions === 0 ? "Perfect zero unexcused absences" : "Unexcused absences"}
            </p>
          </div>
        </div>
      </section>

      {/* 3. View Switcher Tabs: Monthly Calendar vs Daily Log */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "monthly"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            Monthly Attendance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "daily"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <CalendarCheck2 className="h-4 w-4" />
            Daily Attendance Log
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "daily" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {data?.dailyLog.length ?? 0}
            </span>
          </button>
        </div>

        {/* Legend pills (compact) */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Present
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Late
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Excused
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Absent
          </span>
        </div>
      </div>

      {/* 4. TAB 1: MONTHLY CALENDAR VIEW */}
      {activeTab === "monthly" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Calendar Grid (Spans 2 cols) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  {data?.monthName || "Monthly Calendar"}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Somalia School Week: Sun – Thu
                </span>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div className="text-slate-300">Fri</div>
                <div className="text-slate-300">Sat</div>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty offset padding for first day of month */}
                {data?.days.length && data.days[0].dayOfWeek > 0
                  ? Array.from({ length: data.days[0].dayOfWeek }).map((_, i) => (
                      <div key={`offset-${i}`} className="min-h-[50px] sm:min-h-[64px] rounded-xl bg-slate-50/30" />
                    ))
                  : null}

                {/* Day cells */}
                {(data?.days ?? []).map((day) => {
                  const isSelected = selectedDayDetail?.date === day.date;
                  const isWeekend = day.isWeekend;

                  return (
                    <button
                      type="button"
                      key={day.date}
                      onClick={() => setSelectedDayDetail(day)}
                      className={`min-h-[52px] sm:min-h-[64px] rounded-xl p-1 sm:p-1.5 flex flex-col justify-between text-left transition-all ${
                        isSelected
                          ? "ring-2 ring-blue-600 bg-blue-50/40 shadow-xs"
                          : isWeekend
                            ? "bg-slate-50/60 border border-slate-100 text-slate-400"
                            : day.dayStatus === "NO_RECORD"
                              ? "bg-white border border-slate-100 hover:bg-slate-50/80"
                              : "bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isWeekend ? "text-slate-400" : isSelected ? "text-blue-700" : "text-slate-800"
                          }`}
                        >
                          {day.dayNumber}
                        </span>
                        {/* Status Icon Indicator */}
                        {day.dayStatus === "PRESENT" ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Present" />
                        ) : day.dayStatus === "LATE" ? (
                          <span className="h-2 w-2 rounded-full bg-amber-500" title="Late" />
                        ) : day.dayStatus === "EXCUSED" ? (
                          <span className="h-2 w-2 rounded-full bg-blue-500" title="Excused" />
                        ) : day.dayStatus === "ABSENT" ? (
                          <span className="h-2 w-2 rounded-full bg-rose-500" title="Absent" />
                        ) : isWeekend ? (
                          <span className="text-[9px] font-semibold text-slate-300">Off</span>
                        ) : null}
                      </div>

                      {/* Sessions mini pills (AM / PM) */}
                      {!isWeekend && (day.morning || day.afternoon) ? (
                        <div className="mt-1 flex items-center gap-1">
                          {day.morning ? (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                day.morning.status === "PRESENT"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : day.morning.status === "LATE"
                                    ? "bg-amber-50 text-amber-700"
                                    : day.morning.status === "EXCUSED"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-rose-50 text-rose-700"
                              }`}
                              title={`Morning: ${day.morning.status}`}
                            >
                              AM
                            </span>
                          ) : null}
                          {day.afternoon ? (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                day.afternoon.status === "PRESENT"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : day.afternoon.status === "LATE"
                                    ? "bg-amber-50 text-amber-700"
                                    : day.afternoon.status === "EXCUSED"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-rose-50 text-rose-700"
                              }`}
                              title={`Afternoon: ${day.afternoon.status}`}
                            >
                              PM
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="h-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Detail Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Info className="h-4 w-4" />
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">Day Details</h4>
                </div>
                {selectedDayDetail ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedDayDetail.dayName}, {selectedDayDetail.date}
                  </span>
                ) : null}
              </div>

              {selectedDayDetail ? (
                <div className="space-y-3">
                  {/* Status overview */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
                    <span className="text-xs font-medium text-slate-600">Overall Status</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                        selectedDayDetail.dayStatus === "PRESENT"
                          ? "bg-emerald-100/70 text-emerald-800"
                          : selectedDayDetail.dayStatus === "LATE"
                            ? "bg-amber-100/70 text-amber-800"
                            : selectedDayDetail.dayStatus === "EXCUSED"
                              ? "bg-blue-100/70 text-blue-800"
                              : selectedDayDetail.dayStatus === "ABSENT"
                                ? "bg-rose-100/70 text-rose-800"
                                : selectedDayDetail.isWeekend
                                  ? "bg-slate-200 text-slate-700"
                                  : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {selectedDayDetail.dayStatus}
                    </span>
                  </div>

                  {/* Morning Session */}
                  <div className="rounded-xl border border-slate-100 p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Morning Session (AM)
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          selectedDayDetail.morning?.status === "PRESENT"
                            ? "bg-emerald-50 text-emerald-700"
                            : selectedDayDetail.morning?.status === "LATE"
                              ? "bg-amber-50 text-amber-700"
                              : selectedDayDetail.morning?.status === "EXCUSED"
                                ? "bg-blue-50 text-blue-700"
                                : selectedDayDetail.morning?.status === "ABSENT"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {selectedDayDetail.morning?.status ?? "No session"}
                      </span>
                    </div>
                    {selectedDayDetail.morning?.note ? (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg">
                        "{selectedDayDetail.morning.note}"
                      </p>
                    ) : null}
                  </div>

                  {/* Afternoon Session */}
                  <div className="rounded-xl border border-slate-100 p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Afternoon Session (PM)
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          selectedDayDetail.afternoon?.status === "PRESENT"
                            ? "bg-emerald-50 text-emerald-700"
                            : selectedDayDetail.afternoon?.status === "LATE"
                              ? "bg-amber-50 text-amber-700"
                              : selectedDayDetail.afternoon?.status === "EXCUSED"
                                ? "bg-blue-50 text-blue-700"
                                : selectedDayDetail.afternoon?.status === "ABSENT"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {selectedDayDetail.afternoon?.status ?? "No session"}
                      </span>
                    </div>
                    {selectedDayDetail.afternoon?.note ? (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg">
                        "{selectedDayDetail.afternoon.note}"
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">
                  Click on any day in the calendar to view its session breakdown and notes.
                </p>
              )}
            </div>
          </div>

          {/* Academic Year Monthly Trends Strip */}
          {data?.yearSummary.months.length ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Academic Year Monthly Trend ({data.year?.name})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Overall Year Attendance Rate:{" "}
                      <strong className="text-slate-900">
                        {data.yearSummary.attendanceRate !== null ? `${data.yearSummary.attendanceRate}%` : "—"}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {data.yearSummary.months.map((mTrend) => (
                  <button
                    type="button"
                    key={mTrend.month}
                    onClick={() => changeMonth(mTrend.month)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      data.selectedMonth === mTrend.month
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                        : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{mTrend.monthName}</span>
                      <span className="text-blue-700">{mTrend.rate !== null ? `${mTrend.rate}%` : "—"}</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(100, mTrend.rate ?? 0)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{mTrend.present} pres</span>
                      <span>{mTrend.late} late</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 5. TAB 2: DAILY ATTENDANCE TIMELINE & LOG */}
      {activeTab === "daily" ? (
        <div className="space-y-3.5">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <ListFilter className="h-3.5 w-3.5" /> Filter:
            </span>
            {[
              { id: "ALL", label: "All Days" },
              { id: "PRESENT", label: "Present" },
              { id: "LATE", label: "Late" },
              { id: "EXCUSED", label: "Excused" },
              { id: "ABSENT", label: "Absent" },
            ].map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  statusFilter === f.id
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List of days */}
          {filteredDailyLog.length ? (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
              {filteredDailyLog.map((log) => (
                <div
                  key={log.date}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Left: Date */}
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 font-bold text-xs shadow-2xs">
                      {log.date.slice(8, 10)}
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {log.formattedDate}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">{log.dayName}</p>
                    </div>
                  </div>

                  {/* Middle: Sessions info */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Morning */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1">
                      <span className="text-[10px] text-slate-400 font-medium block">Morning (AM)</span>
                      <span
                        className={`font-semibold text-xs ${
                          log.morning?.status === "PRESENT"
                            ? "text-emerald-700"
                            : log.morning?.status === "LATE"
                              ? "text-amber-700"
                              : log.morning?.status === "EXCUSED"
                                ? "text-blue-700"
                                : "text-rose-700"
                        }`}
                      >
                        {log.morning?.status ?? "—"}
                      </span>
                    </div>

                    {/* Afternoon */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1">
                      <span className="text-[10px] text-slate-400 font-medium block">Afternoon (PM)</span>
                      <span
                        className={`font-semibold text-xs ${
                          log.afternoon?.status === "PRESENT"
                            ? "text-emerald-700"
                            : log.afternoon?.status === "LATE"
                              ? "text-amber-700"
                              : log.afternoon?.status === "EXCUSED"
                                ? "text-blue-700"
                                : "text-rose-700"
                        }`}
                      >
                        {log.afternoon?.status ?? "—"}
                      </span>
                    </div>

                    {/* Teacher Note if any */}
                    {log.note ? (
                      <span className="text-[11px] text-slate-500 italic max-w-xs truncate" title={log.note}>
                        "{log.note}"
                      </span>
                    ) : null}
                  </div>

                  {/* Right: Overall Day Status Badge */}
                  <div className="shrink-0 self-start sm:self-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
                        log.overall === "PRESENT"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : log.overall === "LATE"
                            ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                            : log.overall === "EXCUSED"
                              ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                              : "bg-rose-50 text-rose-700 ring-rose-600/20"
                      }`}
                    >
                      {log.overall === "PRESENT" ? "Full Day Present" : log.overall}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              No attendance records match the selected filter.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
