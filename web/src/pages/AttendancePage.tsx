import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";

type Options = {
  schools: Array<{
    id: string;
    name: string;
    year: { id: string; name: string };
    classes: Array<{ id: string; label: string; sections: Array<{ id: string; name: string; students: number }> }>;
  }>;
};

type Sheet = {
  year: string;
  level: string;
  section: string;
  currentYear: boolean;
  students: number;
  morningRecorded: boolean;
  afternoonRecorded: boolean;
  rows: Array<{
    enrollmentId: string;
    number: number;
    rollNumber: number;
    permanentId: string;
    photoUrl: string | null;
    student: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
    note: string;
  }>;
};

type MonthRow = {
  enrollmentId: string;
  permanentId: string;
  rollNumber: number;
  student: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  days: Array<{ date: string; session: string; status: string; note: string }>;
};

const statuses = [
  { value: "PRESENT", label: "Present", idle: "border-emerald-200 bg-emerald-50 text-emerald-700", on: "bg-emerald-600 text-white" },
  { value: "ABSENT", label: "Absent", idle: "border-rose-200 bg-rose-50 text-rose-700", on: "bg-rose-600 text-white" },
  { value: "LATE", label: "Late", idle: "border-amber-200 bg-amber-50 text-amber-700", on: "bg-amber-500 text-white" },
  { value: "EXCUSED", label: "Excused", idle: "border-violet-200 bg-violet-50 text-violet-700", on: "bg-violet-600 text-white" },
] as const;

export function AttendancePage() {
  const [options, setOptions] = useState<Options | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Sheet["rows"]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [focusId, setFocusId] = useState("");
  const [view, setView] = useState<"take" | "month">("take");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  useEffect(() => {
    api<Options>("/api/v1/attendance/options")
      .then((data) => {
        setOptions(data);
        const school = data.schools[0];
        setSchoolId(school?.id ?? "");
        setClassId(school?.classes[0]?.id ?? "");
        setSectionId(school?.classes[0]?.sections[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load attendance."));
  }, []);

  const school = options?.schools.find((item) => item.id === schoolId) ?? options?.schools[0];
  const classGroup = school?.classes.find((item) => item.id === classId) ?? school?.classes[0];

  useEffect(() => {
    if (!sectionId) return;
    api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}&session=${session}`)
      .then((data) => {
        setSheet(data);
        setRows(data.rows);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the sheet."));
  }, [sectionId, date, session]);

  useEffect(() => {
    if (view !== "month" || !sectionId) return;
    const query = focusId ? `&enrollmentId=${focusId}` : "";
    api<MonthRow[]>(`/api/v1/attendance-month?sectionId=${sectionId}&month=${month}${query}`)
      .then(setMonthRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the month."));
  }, [view, sectionId, month, focusId]);

  const counts = useMemo(() => ({
    present: rows.filter((row) => row.status === "PRESENT").length,
    absent: rows.filter((row) => row.status === "ABSENT").length,
    late: rows.filter((row) => row.status === "LATE").length,
    excused: rows.filter((row) => row.status === "EXCUSED").length,
  }), [rows]);

  function setStatus(enrollmentId: string, status: Sheet["rows"][number]["status"]) {
    setRows((current) => current.map((row) => row.enrollmentId === enrollmentId ? { ...row, status, note: status === "EXCUSED" ? row.note : "" } : row));
  }

  async function save() {
    setError("");
    setSaved("");
    const marked = rows.filter((row) => row.status);
    if (!marked.length) {
      setError("Mark at least one student.");
      return;
    }
    try {
      await api("/api/v1/attendance-sheet", {
        method: "PUT",
        body: JSON.stringify({
          sectionId,
          date,
          session,
          rows: marked.map((row) => ({ enrollmentId: row.enrollmentId, status: row.status, note: row.note })),
        }),
      });
      setSaved("Attendance saved. You can change it later.");
      const data = await api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}&session=${session}`);
      setSheet(data);
      setRows(data.rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save attendance.");
    }
  }

  const visibleRows = rows.filter((row) => `${row.student} ${row.permanentId}`.toLowerCase().includes(studentQuery.trim().toLowerCase()));
  const recordedCount = counts.present + counts.absent + counts.late + counts.excused;
  const share = (value: number) => (recordedCount ? Math.round((value / recordedCount) * 100) : 0);
  const headingDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const sessionCard = (value: "MORNING" | "AFTERNOON", label: string, hint: string) => {
    const selected = session === value;
    return (
      <button
        type="button"
        onClick={() => setSession(value)}
        className={`flex flex-1 items-center justify-between rounded-2xl border px-4 py-4 text-left ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
      >
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className={`text-xs ${selected ? "text-blue-100" : "text-emerald-600"}`}>{selected ? hint : "Click to select"}</span>
        </span>
        <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${selected ? "border-white" : "border-emerald-400"}`}>
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Take Attendance</h2>
          <p className="text-sm text-slate-500">Mark and manage student attendance for this class section.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{headingDate}</p>
            <p className="text-xs text-slate-500">{school?.year.name} · {classGroup?.label} · Section {classGroup?.sections.find((item) => item.id === sectionId)?.name}</p>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setView(view === "month" ? "take" : "month")}>{view === "month" ? "Back" : "View Previous"}</button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-5">
        <Field label="School">
          <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" value={school?.id ?? ""} onChange={(event) => {
            const next = options?.schools.find((item) => item.id === event.target.value);
            setSchoolId(event.target.value);
            setClassId(next?.classes[0]?.id ?? "");
            setSectionId(next?.classes[0]?.sections[0]?.id ?? "");
          }}>
            {options?.schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Class / Form">
          <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" value={classGroup?.id ?? ""} onChange={(event) => {
            const next = school?.classes.find((item) => item.id === event.target.value);
            setClassId(event.target.value);
            setSectionId(next?.sections[0]?.id ?? "");
          }}>
            {school?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Section">
          <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            {classGroup?.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Academic Year">
          <input className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700" value={school?.year.name ?? "No current year"} readOnly />
        </Field>
        <Field label="Date">
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" type="date" value={date} onChange={(event) => { setDate(event.target.value); setMonth(event.target.value.slice(0, 7)); }} />
        </Field>
      </div>

      {view === "take" && sheet ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {sessionCard("MORNING", "Morning Session", "Selected · Mark attendance for morning session")}
            {sessionCard("AFTERNOON", "Afternoon Session", "Selected · Mark attendance for afternoon session")}
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Count label="Total Students" value={sheet.students} tone="bg-white text-slate-800" detail={`${sheet.level} · Section ${sheet.section}`} />
            <Count label="Present" value={counts.present} tone="bg-emerald-50 text-emerald-700" detail={`${share(counts.present)}%`} />
            <Count label="Absent" value={counts.absent} tone="bg-rose-50 text-rose-700" detail={`${share(counts.absent)}%`} />
            <Count label="Late" value={counts.late} tone="bg-amber-50 text-amber-700" detail={`${share(counts.late)}%`} />
            <Count label="Excused" value={counts.excused} tone="bg-violet-50 text-violet-700" detail={`${share(counts.excused)}%`} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-950">Students — {session === "MORNING" ? "Morning" : "Afternoon"} Session</h3>
                <p className="text-xs text-slate-500">{school?.name} / {sheet.level} · Section {sheet.section} / {sheet.year} / {date}</p>
              </div>
              <input className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search students..." value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Photo</th>
                    <th className="px-3 py-2">Student name</th>
                    <th className="px-3 py-2">Roll no.</th>
                    <th className="px-3 py-2">Present</th>
                    <th className="px-3 py-2">Absent</th>
                    <th className="px-3 py-2">Late</th>
                    <th className="px-3 py-2">Excused</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.enrollmentId} className="border-t border-slate-100">
                      <td className="px-3 py-3 text-slate-400">{row.number}</td>
                      <td className="px-3 py-3">
                        {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{initials(row.student)}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-950">{row.student}</p>
                        <p className="text-xs text-slate-500">{row.permanentId}</p>
                        {row.status === "EXCUSED" ? <input className="mt-2 w-52 rounded-lg border border-violet-200 px-2 py-1 text-xs" maxLength={200} placeholder="Reason for excuse" value={row.note} onChange={(event) => setRows((current) => current.map((item) => item.enrollmentId === row.enrollmentId ? { ...item, note: event.target.value } : item))} /> : null}
                      </td>
                      <td className="px-3 py-3">{String(row.rollNumber).padStart(2, "0")}</td>
                      {statuses.map((item) => (
                        <td key={item.value} className="px-3 py-3">
                          <button type="button" className={`rounded-full border px-3 py-1 text-xs font-semibold ${row.status === item.value ? item.on : item.idle}`} onClick={() => setStatus(row.enrollmentId, item.value)}>{item.label}</button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleRows.length ? <p className="px-4 py-6 text-sm text-slate-500">No students match this section.</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Select attendance status for each student and click Save Attendance.</p>
            {sheet.currentYear ? (
              <div className="flex gap-2">
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setSaved("Draft kept on this screen. Click Save Attendance to store it.")}>Save as Draft</button>
                <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => void save()}>Save Attendance</button>
              </div>
            ) : <p className="text-sm text-amber-700">Attendance can only be taken for the current academic year.</p>}
          </div>
        </>
      ) : null}

      {view === "month" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input className="rounded-xl border border-slate-200 bg-white px-3 py-2" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2" value={focusId} onChange={(event) => setFocusId(event.target.value)}>
              <option value="">Whole section</option>
              {sheet?.rows.map((row) => <option key={row.enrollmentId} value={row.enrollmentId}>{row.student}</option>)}
            </select>
          </div>
          {monthRows.map((row) => (
            <article key={row.enrollmentId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-900">{row.student}</p>
              <p className="text-xs text-slate-500">{row.permanentId} · Roll {row.rollNumber}</p>
              <p className="mt-2 text-sm text-slate-600">Present {row.present} · Absent {row.absent} · Late {row.late} · Excused {row.excused}</p>
              <div className="mt-2 space-y-1">
                {row.days.map((day) => (
                  <p key={`${day.date}-${day.session}`} className="text-sm text-slate-700">{day.date} · {day.session === "MORNING" ? "Morning" : "Afternoon"} · {day.status}{day.note ? ` · ${day.note}` : ""}</p>
                ))}
                {!row.days.length ? <p className="text-sm text-slate-500">No attendance this month.</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {saved ? <p className="text-sm text-blue-700">{saved}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-slate-500">{label}<span className="mt-1 block text-sm text-slate-800">{children}</span></label>;
}

function Count({ label, value, tone, detail }: { label: string; value: number; tone: string; detail?: string }) {
  return <div className={`rounded-2xl border border-slate-200 px-3 py-2 ${tone}`}><p className="text-xs">{label}</p><p className="text-2xl font-bold">{value}</p>{detail ? <p className="text-xs opacity-70">{detail}</p> : null}</div>;
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
