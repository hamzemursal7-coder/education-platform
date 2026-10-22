import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { AttendancePage } from "./AttendancePage";

type Dashboard = {
  school: { id: string; name: string };
  filters: { from: string; to: string; academicYearId: string; classId: string; sectionId: string };
  years: Array<{ id: string; name: string; isCurrent: boolean }>;
  classes: Array<{ id: string; label: string; sections: Array<{ id: string; name: string }> }>;
  summary: {
    students: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    recorded: number;
    presentPercent: number;
    absentPercent: number;
    latePercent: number;
    excusedPercent: number;
  };
  trend: Array<{ date: string; present: number; absent: number; late: number; excused: number }>;
  reasons: Array<{ label: string; value: number }>;
  page: number;
  pages: number;
  students: StudentRow[];
  pageRows: StudentRow[];
};

type StudentRow = {
  enrollmentId: string;
  sectionId: string;
  permanentId: string;
  rollNumber: number;
  name: string;
  level: string;
  section: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  recorded: number;
  percent: number | null;
  status: string;
  reason: string;
};

type Excused = {
  id: string;
  date: string;
  session: string;
  status: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  student: string;
  permanentId: string;
  level: string;
  section: string;
  teacher: string;
};

type DayRow = {
  enrollmentId: string;
  permanentId: string;
  rollNumber: number;
  student: string;
  status: string | null;
  note: string;
};

const attendanceTabs = ["Take attendance", "Students", "Daily Records"] as const;
const reportTabs = ["Monthly report"] as const;
type AttendanceTab = (typeof attendanceTabs)[number] | (typeof reportTabs)[number] | "Excused Students";

export function SchoolAttendanceDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<AttendanceTab>("Take attendance");
  const [session, setSession] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [daily, setDaily] = useState<DayRow[]>([]);
  const [excused, setExcused] = useState<Excused[]>([]);
  const [history, setHistory] = useState<Array<{ date: string; session: string; status: string; note: string }>>([]);
  const [historyName, setHistoryName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = new URLSearchParams({
    academicYearId: yearId,
    classId,
    sectionId,
    month,
    from,
    to,
    q,
    status,
    page: String(page),
  });

  useEffect(() => {
    setLoading(true);
    api<Dashboard>(`/api/v1/attendance/dashboard?${query.toString()}`)
      .then((next) => {
        setData(next);
        if (!yearId) setYearId(next.filters.academicYearId);
        if (!from) setFrom(next.filters.from);
        if (!to) setTo(next.filters.to);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load attendance."))
      .finally(() => setLoading(false));
  }, [yearId, classId, sectionId, month, from, to, q, status, page]);

  useEffect(() => {
    if (tab !== "Daily Records" || !sectionId || !to) return;
    api<{ rows: DayRow[] }>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${to}&session=${session}`)
      .then((sheet) => setDaily(sheet.rows))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the day."));
  }, [tab, sectionId, to, session]);

  const showExcused = Boolean(sectionId && (data?.summary.excused ?? 0) > 0);

  useEffect(() => {
    if (tab === "Excused Students" && !showExcused) setTab("Take attendance");
  }, [tab, showExcused]);

  useEffect(() => {
    if (tab !== "Excused Students" || !sectionId) return;
    const params = new URLSearchParams({ from: data?.filters.from ?? from, to: data?.filters.to ?? to, sectionId });
    api<Excused[]>(`/api/v1/attendance/excused?${params.toString()}`)
      .then(setExcused)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load excused students."));
  }, [tab, sectionId, data?.filters.from, data?.filters.to]);

  const selectedClass = data?.classes.find((item) => item.id === classId);

  async function correct(row: Excused) {
    const statusValue = window.prompt("Status: PRESENT, ABSENT, LATE, or EXCUSED", row.status);
    if (!statusValue) return;
    const note = statusValue === "EXCUSED" ? window.prompt("Reason", row.note) ?? "" : "";
    await api(`/api/v1/attendance-records/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: statusValue, note }) });
    const params = new URLSearchParams({ from: data?.filters.from ?? from, to: data?.filters.to ?? to, sectionId });
    setExcused(await api<Excused[]>(`/api/v1/attendance/excused?${params.toString()}`));
  }

  async function viewHistory(row: StudentRow) {
    const rows = await api<Array<{ days: Array<{ date: string; session: string; status: string; note: string }> }>>(`/api/v1/attendance-month?sectionId=${row.sectionId}&month=${month || data?.filters.from.slice(0, 7)}&enrollmentId=${row.enrollmentId}`);
    setHistoryName(row.name);
    setHistory(rows[0]?.days ?? []);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-6">
        <label className="text-sm text-slate-600">School<input className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" value={data?.school.name ?? ""} readOnly /></label>
        <label className="text-sm text-slate-600">Class / Form
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); setPage(1); }}>
            <option value="">Choose class</option>
            {data?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Section
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={sectionId} disabled={!classId} onChange={(event) => { setSectionId(event.target.value); setPage(1); }}>
            <option value="">Choose section</option>
            {selectedClass?.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Academic Year
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={yearId} onChange={(event) => { setYearId(event.target.value); setClassId(""); setSectionId(""); setPage(1); }}>
            {data?.years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Month<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setFrom(""); setTo(""); setPage(1); }} /></label>
        <label className="text-sm text-slate-600">Date range
          <span className="mt-1 flex gap-2">
            <input className="w-full rounded-xl border border-slate-200 px-2 py-2" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setMonth(""); setPage(1); }} />
            <input className="w-full rounded-xl border border-slate-200 px-2 py-2" type="date" value={to} onChange={(event) => { setTo(event.target.value); setMonth(""); setPage(1); }} />
          </span>
        </label>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading attendance...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          {tab !== "Take attendance" && sectionId ? (
          <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Card label="Total Students" value={data.summary.students} detail="Enrolled in the filter" tone="text-slate-900" />
            <Card label="Present" value={data.summary.present} detail={`${data.summary.presentPercent}% of recorded`} tone="text-emerald-700" />
            <Card label="Absent" value={data.summary.absent} detail={`${data.summary.absentPercent}% of recorded`} tone="text-rose-700" />
            <Card label="Late" value={data.summary.late} detail={`${data.summary.latePercent}% of recorded`} tone="text-amber-700" />
            <Card label="Excused" value={data.summary.excused} detail={`${data.summary.excusedPercent}% of recorded`} tone="text-violet-700" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Chart title="Attendance trend">
              {data.trend.length ? data.trend.map((row) => {
                const total = row.present + row.absent + row.late + row.excused;
                const peak = Math.max(1, ...data.trend.map((item) => item.present + item.absent + item.late + item.excused));
                return (
                  <div key={row.date} className="flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 text-slate-500">{row.date.slice(5)}</span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded bg-slate-100">
                      <span className="block h-2 rounded bg-emerald-500" style={{ width: `${(total / peak) * 100}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-slate-500">{total}</span>
                  </div>
                );
              }) : <Empty />}
            </Chart>
            <Chart title="Attendance distribution">
              <Bar label="Present" value={data.summary.present} total={data.summary.recorded} color="bg-emerald-500" />
              <Bar label="Absent" value={data.summary.absent} total={data.summary.recorded} color="bg-rose-500" />
              <Bar label="Late" value={data.summary.late} total={data.summary.recorded} color="bg-amber-500" />
              <Bar label="Excused" value={data.summary.excused} total={data.summary.recorded} color="bg-violet-500" />
              {!data.summary.recorded ? <Empty /> : null}
            </Chart>
            <Chart title="Excused reasons">
              {data.reasons.length ? data.reasons.map((row) => <Bar key={row.label} label={row.label} value={row.value} total={data.summary.excused || 1} color="bg-violet-500" />) : <Empty />}
            </Chart>
          </div>
          </>
          ) : tab !== "Take attendance" ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">Choose academic year, Class / Form, and Section. Each section shows only its own attendance.</p>
          ) : null}

          <div className="flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-slate-200">
            <div className="flex gap-1">
              {attendanceTabs.map((item) => (
                <button key={item} type="button" className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab(item)}>{item}</button>
              ))}
            </div>
            <div className="flex gap-1 border-l border-slate-200 pl-6">
              {reportTabs.map((item) => (
                <button key={item} type="button" className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab(item)}>{item}</button>
              ))}
              {showExcused ? (
                <button type="button" className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === "Excused Students" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab("Excused Students")}>Excused Students</button>
              ) : null}
            </div>
          </div>

          {tab === "Take attendance" ? <AttendancePage adminMode lockView /> : null}
          {tab === "Monthly report" ? <AttendancePage adminMode lockView initialView="month" filterYearId={yearId} filterClassId={classId} filterSectionId={sectionId} /> : null}

          {tab === "Students" && sectionId ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex gap-3 border-b border-slate-100 p-3">
                <input className="w-72 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search name, ID, or roll" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="ALL">All statuses</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Low">Low</option>
                  <option value="No records">No records</option>
                </select>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                    {["#", "Student ID", "Roll", "Student", "Class", "Section", "Present", "Absent", "Late", "Excused", "Recorded", "%", "Status", "Reason", ""].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.pageRows.map((row, index) => (
                    <tr key={row.enrollmentId} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 text-slate-500">{(data.page - 1) * 8 + index + 1}</td>
                      <td className="px-3 py-3 text-slate-600">{row.permanentId}</td>
                      <td className="px-3 py-3 text-slate-600">{String(row.rollNumber).padStart(2, "0")}</td>
                      <td className="px-3 py-3 font-semibold text-slate-950">{row.name}</td>
                      <td className="px-3 py-3 text-slate-600">{row.level}</td>
                      <td className="px-3 py-3 text-slate-600">{row.section}</td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "#16A34A" }}>{row.present}</td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "#DC2626" }}>{row.absent}</td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "#D97706" }}>{row.late}</td>
                      <td className="px-3 py-3 font-semibold" style={{ color: "#7C3AED" }}>{row.excused}</td>
                      <td className="px-3 py-3 text-slate-700">{row.recorded}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{row.percent == null ? "—" : `${row.percent}%`}</td>
                      <td className="px-3 py-3"><RatePill status={row.status} /></td>
                      <td className="px-3 py-3 text-slate-500">{row.reason || "—"}</td>
                      <td className="px-3 py-3"><button type="button" className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700" onClick={() => void viewHistory(row)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {!data.pageRows.length ? <Empty /> : null}
              <div className="flex items-center justify-end gap-2 p-3 text-sm">
                <button type="button" className="rounded-lg border px-3 py-1" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <span>{data.page} / {data.pages}</span>
                <button type="button" className="rounded-lg border px-3 py-1" disabled={page >= data.pages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            </div>
          ) : null}

          {tab === "Daily Records" && !sectionId ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Choose one section to see that day's attendance.</p> : null}
          {tab === "Daily Records" && sectionId ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Daily records</h3>
                  <p className="text-sm text-slate-500">{formatDay(to)} · {sessionLabel(session)}</p>
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button type="button" className={`rounded-lg px-4 py-2 text-sm font-semibold ${session === "MORNING" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={() => setSession("MORNING")}>Morning</button>
                  <button type="button" className={`rounded-lg px-4 py-2 text-sm font-semibold ${session === "AFTERNOON" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={() => setSession("AFTERNOON")}>Afternoon</button>
                </div>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {daily.map((row) => (
                  <article key={row.enrollmentId} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{row.student}</p>
                        <p className="text-xs text-slate-500">{row.permanentId}</p>
                      </div>
                      <p className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">Roll {String(row.rollNumber).padStart(2, "0")}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <MarkPill status={row.status} />
                      <p className="text-xs text-slate-500">{row.note || ""}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                      {["#", "Student ID", "Name", "Roll No", "Status", "Note"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((row, index) => (
                      <tr key={row.enrollmentId} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-600">{row.permanentId}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950">{row.student}</td>
                        <td className="px-4 py-3 text-slate-600">{String(row.rollNumber).padStart(2, "0")}</td>
                        <td className="px-4 py-3"><MarkPill status={row.status} /></td>
                        <td className="px-4 py-3 text-slate-500">{row.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!daily.length ? <Empty /> : null}
            </div>
          ) : null}

          {tab === "Excused Students" && showExcused ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">{["Student", "ID", "Class", "Section", "Date", "Session", "Reason", "Recorded by", "Created", "Updated", ""].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {excused.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 font-semibold text-slate-950">{row.student}</td>
                      <td className="px-3 py-3 text-slate-600">{row.permanentId}</td>
                      <td className="px-3 py-3 text-slate-600">{row.level}</td>
                      <td className="px-3 py-3 text-slate-600">{row.section}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDay(row.date)}</td>
                      <td className="px-3 py-3 text-slate-600">{sessionLabel(row.session)}</td>
                      <td className="px-3 py-3 text-slate-500">{row.note || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{row.teacher}</td>
                      <td className="px-3 py-3 text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3 text-slate-500">{new Date(row.updatedAt).toLocaleString()}</td>
                      <td className="px-3 py-3"><button type="button" className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700" onClick={() => void correct(row)}>Correct</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {!excused.length ? <Empty /> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {historyName ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={() => setHistoryName("")}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Attendance history</p>
                <h3 className="text-lg font-bold text-slate-950">{historyName}</h3>
              </div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close" onClick={() => setHistoryName("")}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 overflow-auto p-4">
              {history.map((row) => (
                <div key={`${row.date}-${row.session}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{formatDay(row.date)}</p>
                    <p className="text-xs text-slate-500">{sessionLabel(row.session)}{row.note ? ` · ${row.note}` : ""}</p>
                  </div>
                  <MarkPill status={row.status} />
                </div>
              ))}
              {!history.length ? <p className="px-1 py-6 text-center text-sm text-slate-500">No recorded sessions this month.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDay(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function sessionLabel(value: string) {
  if (value === "MORNING") return "Morning";
  if (value === "AFTERNOON") return "Afternoon";
  return value;
}

function MarkPill({ status }: { status: string | null }) {
  const tone = status === "PRESENT" ? { label: "Present", color: "#16A34A", bg: "#F0FDF4" }
    : status === "ABSENT" ? { label: "Absent", color: "#DC2626", bg: "#FEF2F2" }
    : status === "LATE" ? { label: "Late", color: "#D97706", bg: "#FFFBEB" }
    : status === "EXCUSED" ? { label: "Excused", color: "#7C3AED", bg: "#F5F3FF" }
    : { label: "Not recorded", color: "#64748B", bg: "#F8FAFC" };
  return <span className="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: tone.color, backgroundColor: tone.bg }}>{tone.label}</span>;
}

function RatePill({ status }: { status: string }) {
  const tone = status === "Good" ? { color: "#16A34A", bg: "#F0FDF4" }
    : status === "Fair" ? { color: "#D97706", bg: "#FFFBEB" }
    : status === "Low" ? { color: "#DC2626", bg: "#FEF2F2" }
    : { color: "#64748B", bg: "#F8FAFC" };
  return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: tone.color, backgroundColor: tone.bg }}>{status}</span>;
}

function Card({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className={`text-3xl font-bold ${tone}`}>{value}</p><p className="text-xs text-slate-400">{detail}</p></article>;
}

function Chart({ title, children }: { title: string; children: ReactNode }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 font-semibold text-slate-900">{title}</h3><div className="space-y-2">{children}</div></article>;
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return <div><div className="flex justify-between text-xs text-slate-500"><span>{label}</span><span>{value}</span></div><div className="mt-1 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${color}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></div></div>;
}

function Empty() {
  return <p className="p-4 text-sm text-slate-500">No recorded attendance for these filters.</p>;
}
