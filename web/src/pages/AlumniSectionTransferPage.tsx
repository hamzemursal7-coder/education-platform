import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type AlumniRow = {
  id: string;
  studentId: string;
  permanentId: string;
  name: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  phone: string | null;
  dateOfBirth: string;
  gender: string;
  photoUrl: string | null;
  rollNumber: number | null;
  yearName: string;
  sectionName: string;
  fromLevel: string;
  transferStatus: string;
};

type FormSchool = { id: string; name: string; years: Array<{ id: string; name: string; startDate: string; sections: Array<{ id: string; name: string }> }> };

type Draft = { firstName: string; fatherName: string; grandfatherName: string; phone: string; toSchoolId: string; selected: boolean };

export function AlumniSectionTransferPage() {
  const [params] = useSearchParams();
  const year = params.get("year") ?? "";
  const section = params.get("section") ?? "";
  const level = params.get("level") ?? "";
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [schools, setSchools] = useState<FormSchool[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedSchoolId, setSharedSchoolId] = useState("");

  useEffect(() => {
    Promise.all([
      api<AlumniRow[]>("/api/v1/alumni"),
      api<FormSchool[]>("/api/v1/alumni-form-1-options"),
    ]).then(([alumni, options]) => {
      const matched = alumni.filter((row) => row.yearName === year && row.sectionName === section && (!level || row.fromLevel === level) && row.transferStatus !== "Transferred" && row.transferStatus !== "Pending");
      setRows(matched);
      setSchools(options);
      const first = options[0];
      setDrafts(Object.fromEntries(matched.map((row) => [row.studentId, {
        firstName: row.firstName,
        fatherName: row.fatherName,
        grandfatherName: row.grandfatherName,
        phone: row.phone ?? "",
        toSchoolId: first?.id ?? "",
        selected: true,
      }])));
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load this section."));
  }, [year, section, level]);

  const chosen = useMemo(() => rows.filter((row) => drafts[row.studentId]?.selected), [rows, drafts]);
  const allSelected = rows.length > 0 && chosen.length === rows.length;

  function update(studentId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));
  }

  function selectAll(on: boolean) {
    setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, selected: on }])));
  }

  function applySchoolToSelected(schoolId: string) {
    setSharedSchoolId(schoolId);
    if (!schoolId) return;
    setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, draft.selected ? { ...draft, toSchoolId: schoolId } : draft])));
  }

  async function send(targets: AlumniRow[]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!targets.length) throw new Error("Choose one student, several students, or the whole section.");
      for (const row of targets) {
        const draft = drafts[row.studentId];
        if (!draft?.toSchoolId) throw new Error(`Choose a school for ${row.name}.`);
        await api(`/api/v1/students/${row.studentId}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: draft.firstName,
            fatherName: draft.fatherName,
            grandfatherName: draft.grandfatherName,
            phone: draft.phone,
            gender: row.gender === "Female" ? "FEMALE" : "MALE",
            dateOfBirth: row.dateOfBirth.slice(0, 10),
          }),
        });
        await api(`/api/v1/alumni/${row.studentId}/enroll-form-1`, {
          method: "POST",
          body: JSON.stringify({ toSchoolId: draft.toSchoolId }),
        });
      }
      setMessage(targets.length === rows.length
        ? `Entire section sent (${targets.length} ${targets.length === 1 ? "student" : "students"}). Each school can accept or reject its own students.`
        : targets.length === 1
          ? "This student was sent. The other school can accept or reject the request."
          : `${targets.length} students were sent. Each school can accept or reject its own students.`);
      const sent = new Set(targets.map((row) => row.studentId));
      setRows((current) => current.filter((row) => !sent.has(row.studentId)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link className="text-sm text-blue-700" to="/school/alumni">Back to alumni</Link>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Transfer section {section || "—"}</h2>
          <p className="mt-1 text-sm text-slate-500">{year || "Year"}{level ? ` · ${level}` : ""}. Send the whole section, one student, or several students. Each student can go to a different school.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!rows.length || busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void send(rows)}>{busy ? "Sending..." : "Transfer entire section"}</button>
          <button type="button" disabled={!chosen.length || busy} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50" onClick={() => void send(chosen)}>{chosen.length === 1 ? "Transfer this student" : `Transfer ${chosen.length || ""} students`}</button>
        </div>
      </div>
      {message ? <p className="text-blue-700">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      {rows.length ? (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={(event) => selectAll(event.target.checked)} />
            Select all · {chosen.length} of {rows.length}
          </label>
          <label className="text-sm text-slate-600">One school for the selected students
            <select className="mt-1 block min-w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sharedSchoolId} onChange={(event) => applySchoolToSelected(event.target.value)}>
              <option value="">Choose a school...</option>
              {schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      <div className="space-y-3">
        {rows.map((row) => {
          const draft = drafts[row.studentId];
          if (!draft) return null;
          return (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" className="mt-3 h-4 w-4" checked={draft.selected} onChange={(event) => update(row.studentId, { selected: event.target.checked })} aria-label={`Include ${row.name}`} />
                {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">{row.name.slice(0, 2).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{row.permanentId} · Roll {row.rollNumber ?? "—"}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.firstName} onChange={(event) => update(row.studentId, { firstName: event.target.value })} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.fatherName} onChange={(event) => update(row.studentId, { fatherName: event.target.value })} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.grandfatherName} onChange={(event) => update(row.studentId, { grandfatherName: event.target.value })} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.phone} placeholder="Phone" onChange={(event) => update(row.studentId, { phone: event.target.value })} />
                    <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={draft.toSchoolId} onChange={(event) => update(row.studentId, { toSchoolId: event.target.value })}>
                      {schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!rows.length ? <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No students in this section are waiting to be transferred.</p> : null}
      </div>
    </div>
  );
}
