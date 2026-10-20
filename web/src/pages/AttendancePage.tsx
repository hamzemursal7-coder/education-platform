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
  { value: "PRESENT", label: "Present", ring: "border-emerald-500 bg-emerald-500 text-white", text: "text-emerald-600" },
  { value: "ABSENT", label: "Absent", ring: "border-rose-500 bg-rose-500 text-white", text: "text-rose-600" },
  { value: "LATE", label: "Late", ring: "border-amber-500 bg-amber-500 text-white", text: "text-amber-600" },
  { value: "EXCUSED", label: "Excused", ring: "border-violet-500 bg-violet-500 text-white", text: "text-violet-600" },
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
    if (!sectionId || !date) {
      setSheet(null);
      setRows([]);
      return;
    }
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
  const locked = Boolean(session) && !editing;
  const canMark = Boolean(session) && !locked;

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
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Take attendance</h2>
          <p className="text-sm text-slate-500">Choose class and section to see the students. Choose Morning or Afternoon before marking.</p>
        </div>
        {adminMode ? (
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setView("month")}>Monthly report</button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
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

      {setupReady ? (
        <div className="grid gap-3 sm:grid-cols-2">
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

      {setupReady && sheet ? (
        <section className="space-y-3 pb-28">
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
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search name, ID, or roll" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} />
          </label>
          {visibleRows.map((row) => (
            <article key={row.enrollmentId} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-950">{row.student}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{row.permanentId}</p>
                </div>
                <p className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">Roll {String(row.rollNumber).padStart(2, "0")}</p>
              </div>
              <div className={`mt-4 grid grid-cols-4 gap-2 ${canMark ? "" : "pointer-events-none opacity-50"}`}>
                {statuses.map((item) => {
                  const active = row.status === item.value;
                  return (
                    <button key={item.value} type="button" disabled={!canMark} onClick={() => setStatus(row.enrollmentId, item.value)} className="flex flex-col items-center gap-1.5">
                      <span className={`grid h-11 w-11 place-items-center rounded-full border-2 ${active ? item.ring : "border-slate-200 bg-white text-transparent"}`}>
                        {active ? <Check className="h-5 w-5" strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-[11px] font-semibold ${active ? item.text : "text-slate-400"}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {canMark && (row.status === "ABSENT" || row.status === "EXCUSED") ? (
                <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" maxLength={200} placeholder={row.status === "ABSENT" ? "Absent reason (optional)" : "Excuse reason (optional)"} value={row.note} onChange={(event) => setNote(row.enrollmentId, event.target.value)} />
              ) : null}
            </article>
          ))}
          {!visibleRows.length ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No students in this section.</p> : null}
          {session && sheet.currentYear ? (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
              <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2">
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700" onClick={cancel}>Cancel</button>
                <button type="button" disabled={!canMark} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={saveDraft}>Draft</button>
                <button type="button" disabled={!canMark} className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void submit()}><Send className="h-4 w-4" />Submit</button>
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

