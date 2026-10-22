import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Moon, Search, Send, Sun, Users, X } from "lucide-react";
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
  { value: "PRESENT", label: "Present", color: "#16A34A" },
  { value: "ABSENT", label: "Absent", color: "#DC2626" },
  { value: "LATE", label: "Late", color: "#D97706" },
  { value: "EXCUSED", label: "Excused", color: "#7C3AED" },
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
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Sheet["rows"]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [page, setPage] = useState(1);
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
    if (!sectionId || !date) {
      setSheet(null);
      setRows([]);
      return;
    }
    const selectionKey = `${sectionId}:${date}:${session}`;
    const sessionQuery = session ? `&session=${session}` : "";
    api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}${sessionQuery}`)
      .then((data) => {
        if (session) {
          const draftRaw = localStorage.getItem(draftKey(sectionId, date, session));
          if (draftRaw) {
            try {
              const draft = JSON.parse(draftRaw) as Sheet["rows"];
              if (Array.isArray(draft) && draft.length) {
                setSheet(data);
                setRows(draft);
                setEditing(true);
                setDirty(true);
                setLoadedKey(selectionKey);
                setSaved("Draft restored on this device.");
                return;
              }
            } catch {
              /* ignore bad draft */
            }
          }
        }
        const hasSaved = Boolean(session) && data.rows.some((row) => row.status);
        setSheet(data);
        setRows(data.rows);
        setEditing(!hasSaved);
        setDirty(false);
        setLoadedKey(selectionKey);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the sheet."));
  }, [sectionId, date, session, reloadKey]);

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
    setNotice(null);
  }, [sectionId, date, session]);

  useEffect(() => {
    setPage(1);
  }, [studentQuery, sectionId, date, session]);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedRows = visibleRows.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => pageCount <= 7 || number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1);
  const totalStudents = sheet?.students ?? rows.length;
  const locked = Boolean(session) && !editing;
  const canMark = Boolean(session) && !locked && !submitting;
  const selectionReady = loadedKey === `${sectionId}:${date}:${session}`;
  const submitted = selectionReady && Boolean(session) && !editing && !dirty && rows.some((row) => row.status);
  const showActions = Boolean(session && sheet?.currentYear && selectionReady && !submitted && rows.length > 0);

  function markDirty(next: Sheet["rows"]) {
    setRows(next);
    setDirty(true);
    setSaved("");
  }

  function setStatus(enrollmentId: string, status: Sheet["rows"][number]["status"]) {
    if (!canMark) return;
    markDirty(rows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, status, note: status === "ABSENT" || status === "EXCUSED" ? row.note : "" } : row)));
  }

  function setNote(enrollmentId: string, note: string) {
    if (!canMark) return;
    markDirty(rows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, note } : row)));
  }

  function markAllPresent() {
    if (!canMark) return;
    markDirty(rows.map((row) => ({ ...row, status: "PRESENT", note: "" })));
  }

  function clearAll() {
    if (!canMark) return;
    markDirty(rows.map((row) => ({ ...row, status: null, note: "" })));
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved attendance marks?")) return;
    if (sectionId && session) localStorage.removeItem(draftKey(sectionId, date, session));
    setDirty(false);
    setSaved("");
    setReloadKey((current) => current + 1);
  }

  function saveDraft() {
    if (!sectionId || !session) return;
    localStorage.setItem(draftKey(sectionId, date, session), JSON.stringify(rows));
    setDirty(false);
    setSaved("Draft saved on this device. Submit later to store attendance.");
  }

  async function submit() {
    if (submittingRef.current || submitted) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaved("");
    const marked = rows.filter((row) => row.status);
    if (!marked.length) {
      submittingRef.current = false;
      setSubmitting(false);
      setNotice({ kind: "error", title: "Attendance was not submitted", message: "Mark at least one student before submitting." });
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
    } catch (caught) {
      setNotice({
        kind: "error",
        title: "Attendance was not submitted",
        message: caught instanceof Error ? caught.message : "Could not submit attendance.",
      });
      return;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    if (sectionId && session) localStorage.removeItem(draftKey(sectionId, date, session));
    setDirty(false);
    setEditing(false);
    setNotice({
      kind: "success",
      title: "Attendance submitted successfully!",
      message: "The attendance session has been recorded successfully.",
    });
    try {
      const data = await api<Sheet>(`/api/v1/attendance-sheet?sectionId=${sectionId}&date=${date}&session=${session}`);
      setSheet(data);
      setRows(data.rows);
      const status = await api<DayStatus>(`/api/v1/attendance/day-status?sectionId=${sectionId}&date=${date}`);
      setDayStatus(status);
    } catch {
      /* The save already succeeded. Keep the submitted marks on screen. */
    }
  }

  function sessionHint(value: "MORNING" | "AFTERNOON") {
    const info = value === "MORNING" ? dayStatus?.morning : dayStatus?.afternoon;
    if (!info) return "Choose class and section first";
    if (info.complete) return `Submitted · ${info.marked}/${dayStatus?.students ?? info.marked}`;
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
    <div className="mx-auto w-full max-w-3xl space-y-4 md:max-w-none">
      {notice ? (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${notice.kind === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
            {notice.kind === "success" ? <Check className="h-5 w-5" stroke="white" strokeWidth={3} /> : <X className="h-5 w-5" stroke="white" strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-semibold ${notice.kind === "success" ? "text-emerald-950" : "text-red-950"}`}>{notice.title}</span>
            <span className={`block text-sm ${notice.kind === "success" ? "text-emerald-800" : "text-red-800"}`}>{notice.message}</span>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Take attendance</h2>
          <p className="text-sm text-slate-500">Choose class and section to see the students. Choose Morning or Afternoon before marking.</p>
        </div>
        {adminMode ? (
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setView("month")}>Monthly report</button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className="grid flex-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
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
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
        <div className="hidden md:block lg:w-56 lg:shrink-0">
          <TotalStudentsCard count={totalStudents} />
        </div>
      </div>

      {setupReady ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <SessionCard
            value="MORNING"
            label="Morning session"
            hint={sessionHint("MORNING")}
            selected={session === "MORNING"}
            idleTone="green"
            onSelect={() => setSession("MORNING")}
          />
          <SessionCard
            value="AFTERNOON"
            label="Afternoon session"
            hint={sessionHint("AFTERNOON")}
            selected={session === "AFTERNOON"}
            idleTone="white"
            onSelect={() => setSession("AFTERNOON")}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Choose Class / Form and Section first. Then Morning or Afternoon will appear.</p>
      )}

      {setupReady && !session ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">The student list is ready. Choose Morning or Afternoon before marking attendance.</p> : null}

      {setupReady ? <div className="md:hidden"><TotalStudentsCard count={totalStudents} /></div> : null}

      {setupReady && sheet ? (
        <section className={`space-y-3 ${showActions ? "pb-28 md:pb-0" : ""}`}>
          <div className="space-y-3 md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Student Attendance</h3>
                <p className="text-sm text-slate-500">{sheet.level} · Section {sheet.section}{session ? ` · ${session === "MORNING" ? "Morning Session" : "Afternoon Session"}` : ""}</p>
              </div>
              <div className="flex gap-2">
                {locked ? <button type="button" className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700" onClick={() => setEditing(true)}>Edit</button> : null}
                <button type="button" disabled={!canMark} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50" onClick={markAllPresent}>All present</button>
              </div>
            </div>
            <SearchField value={studentQuery} onChange={setStudentQuery} />
            {visibleRows.map((row) => (
              <article key={row.enrollmentId} className="relative overflow-visible rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-950">{row.student}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{row.permanentId}</p>
                  </div>
                  <p className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">Roll {String(row.rollNumber).padStart(2, "0")}</p>
                </div>
                <div className={`relative z-10 mt-4 grid grid-cols-4 gap-2 overflow-visible ${canMark ? "" : "pointer-events-none"} ${session ? "" : "opacity-50"}`}>
                  {statuses.map((item) => (
                    <div key={item.value} className="flex flex-col items-center gap-1.5">
                      <StatusMark active={row.status === item.value} color={item.color} disabled={!canMark} size="lg" onSelect={() => setStatus(row.enrollmentId, item.value)} />
                      <span className="text-[11px] font-semibold" style={{ color: row.status === item.value ? item.color : "#94a3b8" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <ReasonField row={row} canMark={canMark} onChange={(value) => setNote(row.enrollmentId, value)} />
              </article>
            ))}
            {!visibleRows.length ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No students in this section.</p> : null}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h3 className="text-lg font-bold text-slate-950">Student Attendance</h3>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <div className="w-full max-w-sm">
                  <SearchField value={studentQuery} onChange={setStudentQuery} placeholder="Search student by name, ID, or roll..." />
                </div>
                {locked ? <button type="button" className="shrink-0 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700" onClick={() => setEditing(true)}>Edit</button> : null}
                <button type="button" disabled={!canMark} className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50" onClick={markAllPresent}>All present</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">Student ID</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Roll No</th>
                    {statuses.map((item) => <th key={item.value} className="px-3 py-3 text-center" style={{ color: item.color }}>{item.label}</th>)}
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => {
                    const chosen = statuses.find((item) => item.value === row.status);
                    return (
                      <tr key={row.enrollmentId} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-500">{pageStart + index + 1}</td>
                        <td className="px-3 py-3 text-slate-600">{row.permanentId}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-950">{row.student}</p>
                          <ReasonField row={row} canMark={canMark} onChange={(value) => setNote(row.enrollmentId, value)} />
                        </td>
                        <td className="px-3 py-3 text-slate-600">Roll {String(row.rollNumber).padStart(2, "0")}</td>
                        {statuses.map((item) => (
                          <td key={item.value} className={`px-3 py-3 text-center ${canMark ? "" : "pointer-events-none"} ${session ? "" : "opacity-50"}`}>
                            <StatusMark active={row.status === item.value} color={item.color} disabled={!canMark} size="sm" onSelect={() => setStatus(row.enrollmentId, item.value)} />
                          </td>
                        ))}
                        <td className="px-4 py-3 font-semibold" style={{ color: chosen?.color ?? "#94a3b8" }}>{chosen?.label ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visibleRows.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">No students in this section.</p> : null}
            {rows.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              <p>Showing {visibleRows.length ? pageStart + 1 : 0} to {Math.min(pageStart + pageSize, visibleRows.length)} of {visibleRows.length} students</p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage <= 1} className="rounded-lg border border-slate-200 px-2.5 py-1.5 disabled:opacity-40" onClick={() => setPage(currentPage - 1)}>‹</button>
                {pageNumbers.map((number) => (
                  <button key={number} type="button" className={`h-8 min-w-8 rounded-lg px-2 font-semibold ${number === currentPage ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setPage(number)}>{number}</button>
                ))}
                <button type="button" disabled={currentPage >= pageCount} className="rounded-lg border border-slate-200 px-2.5 py-1.5 disabled:opacity-40" onClick={() => setPage(currentPage + 1)}>›</button>
              </div>
            </div> : null}
            {showActions ? (
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button type="button" disabled={submitting} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={cancel}>Cancel</button>
                <button type="button" disabled={!canMark} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={saveDraft}>Draft</button>
                <button type="button" disabled={!canMark || submitting} className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void submit()}>{submitting ? "Submitting..." : <><Send className="h-4 w-4" />Submit</>}</button>
              </div>
            ) : null}
          </div>

          {showActions ? (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur md:hidden">
              <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2">
                <button type="button" disabled={submitting} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={cancel}>Cancel</button>
                <button type="button" disabled={!canMark} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={saveDraft}>Draft</button>
                <button type="button" disabled={!canMark || submitting} className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void submit()}>{submitting ? "Submitting..." : <><Send className="h-4 w-4" />Submit</>}</button>
              </div>
            </div>
          ) : null}
        </section>
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

function TotalStudentsCard({ count }: { count: number }) {
  return (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
        <Users className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">Total Students</span>
        <span className="block text-2xl font-bold leading-none text-slate-950">{count}</span>
      </span>
    </div>
  );
}

function SearchField({ value, onChange, placeholder = "Search name, ID, or roll" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StatusMark({ active, color, disabled, size, onSelect }: { active: boolean; color: string; disabled: boolean; size: "sm" | "lg"; onSelect: () => void }) {
  const box = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <button type="button" disabled={disabled} onClick={onSelect} className="inline-grid place-items-center overflow-visible disabled:cursor-not-allowed">
      <span
        className={`relative z-10 grid shrink-0 place-items-center overflow-visible rounded-full border-2 bg-white ${box}`}
        style={active ? { backgroundColor: color, borderColor: color } : { backgroundColor: "#ffffff", borderColor: `${color}66` }}
      >
        {active ? <Check className={`pointer-events-none relative z-20 shrink-0 text-white ${icon}`} stroke="white" strokeWidth={3} absoluteStrokeWidth aria-hidden /> : null}
      </span>
    </button>
  );
}

function ReasonField({ row, canMark, onChange }: { row: Sheet["rows"][number]; canMark: boolean; onChange: (value: string) => void }) {
  if (row.status !== "ABSENT" && row.status !== "EXCUSED") return null;
  if (canMark) {
    return (
      <label className="mt-2 block text-xs font-medium text-slate-500">Reason (optional)
        <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" maxLength={200} placeholder={row.status === "ABSENT" ? "Absent reason" : "Excuse reason"} value={row.note} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  return row.note ? <p className="mt-2 text-sm font-normal text-slate-600">Reason: {row.note}</p> : null;
}

