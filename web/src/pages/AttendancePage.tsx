import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Moon, Search, Send, Sun, X } from "lucide-react";
import { api } from "../lib/api";

type Options = {
  schools: Array<{
    id: string;
    name: string;
    year: { id: string; name: string };
    classes: Array<{ id: string; label: string; sections: Array<{ id: string; name: string; students: number }> }>;
  }>;
};

type DayStatus = {
  year: string;
  level: string;
  section: string;
  currentYear: boolean;
  students: number;
  morning: { recorded: boolean; complete: boolean; marked: number };
  afternoon: { recorded: boolean; complete: boolean; marked: number };
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

type MonthlyAbsences = {
  month: string;
  year: { id: string; name: string } | null;
  classes: Array<{
    classId: string;
    label: string;
    sections: Array<{
      sectionId: string;
      section: string;
      students: number;
      days: Array<{ date: string; session: string; absent: number; late: number; excused: number }>;
    }>;
  }>;
  students: Array<{
    enrollmentId: string;
    sectionId: string;
    permanentId: string;
    name: string;
    level: string;
    section: string;
    days: Array<{ date: string; session: string; status: string; note: string }>;
  }>;
};

const statuses = [
  { value: "PRESENT", label: "Present", idle: "border-emerald-200 bg-emerald-50 text-emerald-700", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "ABSENT", label: "Absent", idle: "border-rose-200 bg-rose-50 text-rose-700", on: "bg-rose-600 text-white border-rose-600" },
  { value: "LATE", label: "Late", idle: "border-amber-200 bg-amber-50 text-amber-700", on: "bg-amber-500 text-white border-amber-500" },
  { value: "EXCUSED", label: "Excused", idle: "border-violet-200 bg-violet-50 text-violet-700", on: "bg-violet-600 text-white border-violet-600" },
] as const;

function draftKey(sectionId: string, date: string, session: string) {
  return `emp_attendance_draft:${sectionId}:${date}:${session}`;
}

export function AttendancePage({ adminMode = false, initialView = "take" }: { adminMode?: boolean; initialView?: "take" | "month" }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<"MORNING" | "AFTERNOON" | "">("");
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Sheet["rows"]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [view, setView] = useState<"take" | "month">(initialView);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthClassId, setMonthClassId] = useState("");
  const [monthQuery, setMonthQuery] = useState("");
  const [monthly, setMonthly] = useState<MonthlyAbsences | null>(null);

  useEffect(() => {
    api<Options>("/api/v1/attendance/options")
      .then((data) => {
        setOptions(data);
        setSchoolId(data.schools[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load attendance."));
  }, []);

  const school = options?.schools.find((item) => item.id === schoolId) ?? options?.schools[0];
  const classGroup = school?.classes.find((item) => item.id === classId);
  const section = classGroup?.sections.find((item) => item.id === sectionId);
  const setupReady = Boolean(classId && sectionId && date);

  useEffect(() => {
    if (!setupReady || !sectionId) {
      setDayStatus(null);
      return;
    }
    api<DayStatus>(`/api/v1/attendance/day-status?sectionId=${sectionId}&date=${date}`)
      .then(setDayStatus)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load session status."));
  }, [setupReady, sectionId, date]);

  useEffect(() => {
    if (!opened || !sectionId || !session) return;
    api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}&session=${session}`)
      .then((data) => {
        const draftRaw = localStorage.getItem(draftKey(sectionId, date, session));
        if (draftRaw) {
          try {
            const draft = JSON.parse(draftRaw) as Sheet["rows"];
            if (Array.isArray(draft) && draft.length) {
              setSheet(data);
              setRows(draft);
              setEditing(true);
              setDirty(true);
              setSaved("Draft restored on this device.");
              return;
            }
          } catch {
            /* ignore bad draft */
          }
        }
        const hasSaved = data.rows.some((row) => row.status);
        setSheet(data);
        setRows(data.rows);
        setEditing(!hasSaved);
        setDirty(false);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the sheet."));
  }, [opened, sectionId, date, session]);

  useEffect(() => {
    if (view !== "month" || !adminMode) return;
    const params = new URLSearchParams({ month });
    if (monthClassId) params.set("classId", monthClassId);
    if (monthQuery.trim()) params.set("q", monthQuery.trim());
    api<MonthlyAbsences>(`/api/v1/attendance/monthly-absences?${params}`)
      .then(setMonthly)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load monthly absences."));
  }, [view, adminMode, month, monthClassId, monthQuery]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const counts = useMemo(() => ({
    present: rows.filter((row) => row.status === "PRESENT").length,
    absent: rows.filter((row) => row.status === "ABSENT").length,
    late: rows.filter((row) => row.status === "LATE").length,
    excused: rows.filter((row) => row.status === "EXCUSED").length,
  }), [rows]);

  const visibleRows = rows.filter((row) => `${row.student} ${row.permanentId} ${row.rollNumber}`.toLowerCase().includes(studentQuery.trim().toLowerCase()));
  const locked = opened && !editing;
  const canOpen = setupReady && (session === "MORNING" || session === "AFTERNOON");

  function markDirty(next: Sheet["rows"]) {
    setRows(next);
    setDirty(true);
    setSaved("");
  }

  function setStatus(enrollmentId: string, status: Sheet["rows"][number]["status"]) {
    if (locked) return;
    markDirty(rows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, status, note: status === "ABSENT" || status === "EXCUSED" ? row.note : "" } : row)));
  }

  function setNote(enrollmentId: string, note: string) {
    if (locked) return;
    markDirty(rows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, note } : row)));
  }

  function markAllPresent() {
    if (locked) return;
    markDirty(rows.map((row) => ({ ...row, status: "PRESENT", note: "" })));
  }

  function clearAll() {
    if (locked) return;
    markDirty(rows.map((row) => ({ ...row, status: null, note: "" })));
  }

  function confirmLeave() {
    if (!dirty) return true;
    return window.confirm("Attendance is not saved. Leave and keep a draft, or stay and save?");
  }

  function leaveSheet(keepDraft: boolean) {
    if (dirty && keepDraft && sectionId && session) {
      localStorage.setItem(draftKey(sectionId, date, session), JSON.stringify(rows));
      setSaved("Draft saved on this device.");
    } else if (!keepDraft && sectionId && session) {
      localStorage.removeItem(draftKey(sectionId, date, session));
    }
    setOpened(false);
    setEditing(false);
    setDirty(false);
    setSheet(null);
    setRows([]);
    setSession("");
  }

  function cancel() {
    if (dirty && !window.confirm("Leave without submitting? You can save a draft first.")) return;
    if (dirty) leaveSheet(true);
    else leaveSheet(false);
  }

  function saveDraft() {
    if (!sectionId || !session) return;
    localStorage.setItem(draftKey(sectionId, date, session), JSON.stringify(rows));
    setDirty(false);
    setSaved("Draft saved on this device. Submit later to store attendance.");
  }

  async function submit() {
    setError("");
    setSaved("");
    const marked = rows.filter((row) => row.status);
    if (!marked.length) {
      setError("Mark at least one student before submitting.");
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
      if (sectionId && session) localStorage.removeItem(draftKey(sectionId, date, session));
      setSaved("Attendance submitted.");
      setDirty(false);
      setEditing(false);
      const data = await api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}&session=${session}`);
      setSheet(data);
      setRows(data.rows);
      const status = await api<DayStatus>(`/api/v1/attendance/day-status?sectionId=${sectionId}&date=${date}`);
      setDayStatus(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit attendance.");
    }
  }

  function openSheet() {
    if (!canOpen) {
      setError("Choose class, section, and Morning or Afternoon before opening attendance.");
      return;
    }
    setError("");
    setOpened(true);
  }

  function sessionHint(value: "MORNING" | "AFTERNOON") {
    const info = value === "MORNING" ? dayStatus?.morning : dayStatus?.afternoon;
    if (!info) return "Choose class and section first";
    if (info.complete) return "Recorded";
    if (info.recorded) return `Partial · ${info.marked}/${dayStatus?.students ?? 0}`;
    return "Not recorded";
  }

  if (view === "month" && adminMode) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Monthly attendance</h2>
            <p className="text-sm text-slate-500">Choose month and year, then see absences by class or search one student.</p>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setView("take")}>Take attendance</button>
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">Month and year
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500">Class
            <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={monthClassId} onChange={(event) => setMonthClassId(event.target.value)}>
              <option value="">All classes</option>
              {school?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">Search student
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" placeholder="Name or student ID" value={monthQuery} onChange={(event) => setMonthQuery(event.target.value)} />
            </span>
          </label>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {monthQuery.trim() ? (
          <section className="space-y-3">
            <h3 className="font-semibold text-slate-900">Student absences</h3>
            {monthly?.students.length ? monthly.students.map((person) => (
              <article key={person.enrollmentId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-950">{person.name}</p>
                <p className="text-xs text-slate-500">{person.permanentId} · {person.level} · Section {person.section}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {person.days.map((day) => (
                    <li key={`${day.date}-${day.session}`}>{day.date} · {day.session === "MORNING" ? "Morning" : "Afternoon"} · {day.status}{day.note ? ` · ${day.note}` : ""}</li>
                  ))}
                </ul>
              </article>
            )) : <p className="text-sm text-slate-500">No matching absences this month.</p>}
          </section>
        ) : (
          <section className="space-y-3">
            {monthly?.classes.map((group) => (
              <article key={group.classId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-slate-950">{group.label}</h3>
                <div className="mt-3 space-y-3">
                  {group.sections.map((sectionRow) => (
                    <div key={sectionRow.sectionId} className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-800">Section {sectionRow.section} · {sectionRow.students} students</p>
                      {sectionRow.days.length ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {sectionRow.days.map((day) => (
                            <li key={`${day.date}-${day.session}`}>{day.date} · {day.session === "MORNING" ? "Morning" : "Afternoon"} · Absent {day.absent} · Late {day.late} · Excused {day.excused}</li>
                          ))}
                        </ul>
                      ) : <p className="mt-1 text-sm text-slate-500">No absences recorded this month.</p>}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!monthly?.classes.length ? <p className="text-sm text-slate-500">No classes for this month.</p> : null}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Take attendance</h2>
          <p className="text-sm text-slate-500">Choose class and section, then Morning or Afternoon. Attendance opens only after that.</p>
        </div>
        {adminMode ? (
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => {
            if (opened && dirty && !confirmLeave()) return;
            if (opened) leaveSheet(dirty);
            setView("month");
          }}>Monthly report</button>
        ) : null}
      </div>

      {!opened ? (
        <>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            {options && options.schools.length > 1 ? (
              <Field label="School">
                <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={school?.id ?? ""} onChange={(event) => {
                  setSchoolId(event.target.value);
                  setClassId("");
                  setSectionId("");
                  setSession("");
                }}>
                  {options.schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Academic year">
              <input className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700" value={school?.year.name ?? "No current year"} readOnly />
            </Field>
            <Field label="Class / Form">
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={classId} onChange={(event) => {
                setClassId(event.target.value);
                setSectionId("");
                setSession("");
              }}>
                <option value="">Choose class</option>
                {school?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={sectionId} disabled={!classId} onChange={(event) => {
                setSectionId(event.target.value);
                setSession("");
              }}>
                <option value="">Choose section</option>
                {classGroup?.sections.map((item) => <option key={item.id} value={item.id}>Section {item.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" type="date" value={date} onChange={(event) => {
                setDate(event.target.value);
                setSession("");
              }} />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SessionCard
              value="MORNING"
              label="Morning session"
              hint={sessionHint("MORNING")}
              selected={session === "MORNING"}
              idleTone="green"
              disabled={!setupReady}
              onSelect={() => setSession("MORNING")}
            />
            <SessionCard
              value="AFTERNOON"
              label="Afternoon session"
              hint={sessionHint("AFTERNOON")}
              selected={session === "AFTERNOON"}
              idleTone="white"
              disabled={!setupReady}
              onSelect={() => setSession("AFTERNOON")}
            />
          </div>

          {!setupReady ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Choose class and section first. Then choose Morning or Afternoon.</p> : null}
          {setupReady && !session ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Choose Morning or Afternoon. Attendance cannot open until a session is selected.</p> : null}

          <div className="flex justify-end">
            <button type="button" disabled={!canOpen} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={openSheet}>
              Open attendance
            </button>
          </div>
        </>
      ) : null}

      {opened && sheet ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="font-semibold text-slate-950">{sheet.level} · Section {sheet.section} · {session === "MORNING" ? "Morning" : "Afternoon"}</p>
              <p className="text-xs text-slate-500">{date} · {sheet.year} · {locked ? "Locked — open Edit to change" : "Editing"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {locked ? (
                <button type="button" className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700" onClick={() => setEditing(true)}>Edit</button>
              ) : null}
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={cancel}>Cancel</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Count label="Total" value={sheet.students} tone="bg-white text-slate-800" />
            <Count label="Present" value={counts.present} tone="bg-emerald-50 text-emerald-700" />
            <Count label="Absent" value={counts.absent} tone="bg-rose-50 text-rose-700" />
            <Count label="Late" value={counts.late} tone="bg-amber-50 text-amber-700" />
            <Count label="Excused" value={counts.excused} tone="bg-violet-50 text-violet-700" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">Students — {session === "MORNING" ? "Morning" : "Afternoon"} session</h3>
                <p className="text-xs text-slate-500">{classGroup?.label} · Section {section?.name} · {date}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:max-w-xs">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Name, ID, or roll no..." value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} />
                </label>
                <button type="button" disabled={locked} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50" onClick={markAllPresent}><Check className="mr-1 inline h-4 w-4" />Mark all present</button>
                <button type="button" disabled={locked} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50" onClick={clearAll}>Clear all</button>
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-sky-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Photo</th>
                    <th className="px-3 py-2">Student name</th>
                    <th className="px-3 py-2">Roll no.</th>
                    <th className="px-3 py-2">Present</th>
                    <th className="px-3 py-2">Absent</th>
                    <th className="px-3 py-2">Late</th>
                    <th className="px-3 py-2">Excused</th>
                    <th className="px-3 py-2">Reason (optional)</th>
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
                      </td>
                      <td className="px-3 py-3">{String(row.rollNumber).padStart(2, "0")}</td>
                      {statuses.map((item) => (
                        <td key={item.value} className="px-3 py-3">
                          <button type="button" disabled={locked} className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-60 ${row.status === item.value ? item.on : item.idle}`} onClick={() => setStatus(row.enrollmentId, item.value)}>{item.label}</button>
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        {row.status === "ABSENT" || row.status === "EXCUSED" ? (
                          <input className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50" maxLength={200} disabled={locked} placeholder={row.status === "ABSENT" ? "Absent reason (optional)" : "Excuse reason (optional)"} value={row.note} onChange={(event) => setNote(row.enrollmentId, event.target.value)} />
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {visibleRows.map((row) => (
                <article key={row.enrollmentId} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{initials(row.student)}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-950">{row.student}</p>
                      <p className="text-xs text-slate-500">{row.permanentId} · Roll {String(row.rollNumber).padStart(2, "0")}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {statuses.map((item) => (
                      <button key={item.value} type="button" disabled={locked} className={`rounded-xl border px-2 py-2 text-xs font-semibold disabled:opacity-60 ${row.status === item.value ? item.on : item.idle}`} onClick={() => setStatus(row.enrollmentId, item.value)}>{item.label}</button>
                    ))}
                  </div>
                  {row.status === "ABSENT" || row.status === "EXCUSED" ? (
                    <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" maxLength={200} disabled={locked} placeholder={row.status === "ABSENT" ? "Absent reason (optional)" : "Excuse reason (optional)"} value={row.note} onChange={(event) => setNote(row.enrollmentId, event.target.value)} />
                  ) : null}
                </article>
              ))}
            </div>
            {!visibleRows.length ? <p className="px-4 py-6 text-sm text-slate-500">No students match this search.</p> : null}
          </section>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-sm text-slate-500">{dirty ? "Unsaved changes. Save a draft or submit before leaving." : "Attendance is ready."}</p>
            {sheet.currentYear ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={cancel}><X className="h-4 w-4" />Cancel</button>
                <button type="button" disabled={locked} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={saveDraft}>Save draft</button>
                <button type="button" disabled={locked} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void submit()}><Send className="h-4 w-4" />Submit attendance</button>
              </div>
            ) : <p className="text-sm text-amber-700">Attendance can only be taken for the current academic year.</p>}
          </div>
        </>
      ) : null}

      {saved ? <p className="text-sm text-blue-700">{saved}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function SessionCard({
  label,
  hint,
  selected,
  idleTone,
  disabled,
  onSelect,
}: {
  value: "MORNING" | "AFTERNOON";
  label: string;
  hint: string;
  selected: boolean;
  idleTone: "green" | "white";
  disabled?: boolean;
  onSelect: () => void;
}) {
  const idle = idleTone === "green"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-white text-slate-800";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-blue-600 bg-blue-600 text-white shadow-sm" : idle}`}
    >
      <span className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-10 w-10 place-items-center rounded-xl ${selected ? "bg-white/15" : idleTone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {idleTone === "green" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </span>
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className={`text-xs ${selected ? "text-blue-100" : "text-slate-500"}`}>{hint}</span>
        </span>
      </span>
      <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${selected ? "border-white" : "border-current opacity-40"}`}>
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-slate-500">{label}<span className="mt-1 block text-sm text-slate-800">{children}</span></label>;
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-2xl border border-slate-200 px-3 py-2 ${tone}`}><p className="text-xs">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
