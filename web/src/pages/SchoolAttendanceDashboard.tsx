import { useEffect, useState, type ReactNode } from "react";
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

const tabs = ["Take attendance", "Students", "Daily Records", "Monthly Summary", "Excused Students", "Reports"] as const;

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
  const [tab, setTab] = useState<(typeof tabs)[number]>("Take attendance");
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

  useEffect(() => {
    if (tab !== "Excused Students" && tab !== "Reports") return;
    const params = new URLSearchParams({ from: data?.filters.from ?? from, to: data?.filters.to ?? to, sectionId });
    api<Excused[]>(`/api/v1/attendance/excused?${params.toString()}`)
      .then(setExcused)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load excused students."));
  }, [tab, sectionId, data?.filters.from, data?.filters.to]);

  const selectedClass = data?.classes.find((item) => item.id === classId);

  function exportCsv() {
    const rows = tab === "Excused Students"
      ? [["Student", "ID", "Class", "Section", "Date", "Session", "Reason", "Teacher", "Created", "Updated"], ...excused.map((row) => [row.student, row.permanentId, row.level, row.section, row.date, row.session, row.note, row.teacher, row.createdAt, row.updatedAt])]
      : [["ID", "Roll", "Name", "Class", "Section", "Present", "Absent", "Late", "Excused", "Recorded", "Percent", "Status", "Reason"], ...(data?.students ?? []).map((row) => [row.permanentId, row.rollNumber, row.name, row.level, row.section, row.present, row.absent, row.late, row.excused, row.recorded, row.percent ?? "", row.status, row.reason])];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "attendance.csv";
    link.click();
  }

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
          {sectionId ? (
          <>
          <div className="grid grid-cols-5 gap-3">
            <Card label="Total Students" value={data.summary.students} detail="Enrolled in the filter" tone="text-slate-900" />
            <Card label="Present" value={data.summary.present} detail={`${data.summary.presentPercent}% of recorded`} tone="text-emerald-700" />
            <Card label="Absent" value={data.summary.absent} detail={`${data.summary.absentPercent}% of recorded`} tone="text-rose-700" />
            <Card label="Late" value={data.summary.late} detail={`${data.summary.latePercent}% of recorded`} tone="text-amber-700" />
            <Card label="Excused" value={data.summary.excused} detail={`${data.summary.excusedPercent}% of recorded`} tone="text-violet-700" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Chart title="Attendance trend">
              {data.trend.length ? data.trend.map((row) => (
                <div key={row.date} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-slate-500">{row.date.slice(5)}</span>
                  <span className="h-2 rounded bg-emerald-500" style={{ width: `${row.present * 8}px` }} />
                  <span className="text-slate-500">{row.present + row.absent + row.late + row.excused}</span>
                </div>
              )) : <Empty />}
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
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">Choose academic year, Class / Form, and Section. Each section shows only its own attendance.</p>
          )}

          <div className="flex gap-2 border-b border-slate-200">
            {tabs.map((item) => (
              <button key={item} type="button" className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab(item)}>{item}</button>
            ))}
          </div>

          {tab === "Take attendance" ? <AttendancePage adminMode /> : null}
          {tab === "Monthly Summary" ? <AttendancePage adminMode initialView="month" filterYearId={yearId} filterClassId={classId} filterSectionId={sectionId} /> : null}

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
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>{["SL", "Student ID", "Roll", "Student", "Class", "Section", "Present", "Absent", "Late", "Excused", "Recorded", "%", "Status", "Reason", ""].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {data.pageRows.map((row, index) => (
                    <tr key={row.enrollmentId} className="border-t border-slate-100">
                      <td className="px-2 py-2">{(data.page - 1) * 8 + index + 1}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.permanentId}</td>
                      <td className="px-2 py-2">{row.rollNumber}</td>
                      <td className="px-2 py-2 font-semibold">{row.name}</td>
                      <td className="px-2 py-2">{row.level}</td>
                      <td className="px-2 py-2">{row.section}</td>
                      <td className="px-2 py-2">{row.present}</td>
                      <td className="px-2 py-2">{row.absent}</td>
                      <td className="px-2 py-2">{row.late}</td>
                      <td className="px-2 py-2">{row.excused}</td>
                      <td className="px-2 py-2">{row.recorded}</td>
                      <td className="px-2 py-2">{row.percent == null ? "—" : `${row.percent}%`}</td>
                      <td className="px-2 py-2">{row.status}</td>
                      <td className="px-2 py-2">{row.reason || "—"}</td>
                      <td className="px-2 py-2"><button type="button" className="font-semibold text-blue-700" onClick={() => void viewHistory(row)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.pageRows.length ? <Empty /> : null}
              <div className="flex items-center justify-end gap-2 p-3 text-sm">
                <button type="button" className="rounded-lg border px-3 py-1" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <span>{data.page} / {data.pages}</span>
                <button type="button" className="rounded-lg border px-3 py-1" disabled={page >= data.pages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            </div>
          ) : null}

          {tab === "Daily Records" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {!sectionId ? <p className="text-sm text-slate-500">Choose one section to see that day's attendance.</p> : null}
              <div className="mb-3 flex gap-2">
                <button type="button" className={`rounded-xl px-3 py-2 text-sm font-semibold ${session === "MORNING" ? "bg-blue-600 text-white" : "bg-emerald-50 text-emerald-800"}`} onClick={() => setSession("MORNING")}>Morning</button>
                <button type="button" className={`rounded-xl px-3 py-2 text-sm font-semibold ${session === "AFTERNOON" ? "bg-blue-600 text-white" : "bg-emerald-50 text-emerald-800"}`} onClick={() => setSession("AFTERNOON")}>Afternoon</button>
              </div>
              {daily.map((row) => (
                <p key={row.enrollmentId} className="border-t border-slate-100 py-2 text-sm">{row.permanentId} · Roll {row.rollNumber} · {row.student} · {row.status ?? "Not recorded"}{row.note ? ` · ${row.note}` : ""}</p>
              ))}
              {sectionId && !daily.length ? <Empty /> : null}
            </div>
          ) : null}

          {tab === "Excused Students" && sectionId ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{["Student", "ID", "Class", "Section", "Date", "Session", "Reason", "Recorded by", "Created", "Updated", ""].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr></thead>
                <tbody>
                  {excused.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-semibold">{row.student}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.permanentId}</td>
                      <td className="px-2 py-2">{row.level}</td>
                      <td className="px-2 py-2">{row.section}</td>
                      <td className="px-2 py-2">{row.date}</td>
                      <td className="px-2 py-2">{row.session}</td>
                      <td className="px-2 py-2">{row.note || "—"}</td>
                      <td className="px-2 py-2">{row.teacher}</td>
                      <td className="px-2 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2">{new Date(row.updatedAt).toLocaleString()}</td>
                      <td className="px-2 py-2"><button type="button" className="font-semibold text-blue-700" onClick={() => void correct(row)}>Correct</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!excused.length ? <Empty /> : null}
            </div>
          ) : null}

          {tab === "Reports" && sectionId ? (
            <div className="flex gap-3">
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={exportCsv}>Export CSV</button>
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold" onClick={() => window.print()}>Print</button>
            </div>
          ) : null}
        </>
      ) : null}

      {historyName ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6" onClick={() => setHistoryName("")}>
          <div className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold">{historyName}</h3>
            {history.map((row) => <p key={`${row.date}-${row.session}`} className="mt-2 text-sm">{row.date} · {row.session} · {row.status}{row.note ? ` · ${row.note}` : ""}</p>)}
            {!history.length ? <p className="mt-2 text-sm text-slate-500">No recorded sessions this month.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
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
