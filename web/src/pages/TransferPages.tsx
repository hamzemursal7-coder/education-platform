import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, School, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type StudentRow = { id: string; enrollmentId: string; permanentId: string; name: string; gender: string; dateOfBirth: string; status: string; photoUrl: string | null; level: string; section: string; year: string; rollNumber: number | null };
type Placement = { id: string; name: string; isCurrent?: boolean; classes: Array<{ id: string; level: string; label: string; sections: Array<{ id: string; name: string }> }> };
type School = { id: string; name: string; code: string; type: "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY" };
type Transfer = {
  id: string;
  studentId: string;
  permanentId: string;
  name: string;
  fromSchool: string;
  toSchool: string;
  status: string;
  rejectReason: string | null;
  incoming: boolean;
  note: string | null;
  sourceYear: string;
  sourceLevel: string;
  sourceLevelCode: string;
  sourceSection: string;
  kind: string;
  destinationYear: string;
  destinationLevel: string;
  destinationSection: string;
  toAcademicYearId: string | null;
  toSectionId: string | null;
  requestedAt: string;
  statusUpdatedAt: string;
};

function transferDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type FormYear = { id: string; name: string; sections: Array<{ id: string; name: string }> };

export function TransfersPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [toSchoolId, setToSchoolId] = useState("");
  const [destSectionId, setDestSectionId] = useState("");
  const [sectionReviewIds, setSectionReviewIds] = useState<string[] | null>(null);
  const [schoolReviewIds, setSchoolReviewIds] = useState<string[] | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [transferReason, setTransferReason] = useState("");
  const [placementChoices, setPlacementChoices] = useState<Record<string, string>>({});
  const [formYears, setFormYears] = useState<FormYear[]>([]);
  const [formYearId, setFormYearId] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);

  async function load() {
    const [years, orgSchools, requests, formSchools] = await Promise.all([
      api<{ years: Array<{ id: string; name: string; isCurrent: boolean; classes: Array<{ id: string; level: string; sections: Array<{ id: string; name: string }> }> }> }>("/api/v1/academic-years"),
      api<School[]>("/api/v1/org-schools"),
      api<Transfer[]>("/api/v1/transfer-requests"),
      api<Array<{ sameSchool: boolean; years: FormYear[] }>>("/api/v1/alumni-form-1-options").catch(() => []),
    ]);
    setTransfers(requests);
    const mine = formSchools.find((school) => school.sameSchool);
    setFormYears(mine?.years ?? []);
    setFormYearId((current) => current || mine?.years[0]?.id || "");
    setSchools(orgSchools);
    const normalized = years.years.map((year) => ({
      id: year.id,
      name: year.name,
      isCurrent: year.isCurrent,
      classes: year.classes.map((item) => ({
        id: item.id,
        level: item.level,
        label: item.level.replace("CLASS_", "Class ").replace("FORM_", "Form "),
        sections: item.sections,
      })),
    }));
    setPlacement(normalized);
    const defaultYear = normalized.find((year) => year.isCurrent) ?? normalized[0];
    setSourceYearId((current) => current || defaultYear?.id || "");
    setSourceSectionId((current) => current || defaultYear?.classes[0]?.sections[0]?.id || "");
    setToSchoolId((current) => current || orgSchools[0]?.id || "");
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load transfers."));
  }, []);

  useEffect(() => {
    if (!sourceYearId || !sourceSectionId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    api<{ students: StudentRow[] }>(`/api/v1/students?academicYearId=${sourceYearId}&sectionId=${sourceSectionId}&status=ACTIVE`)
      .then((response) => {
        setStudents(response.students);
        setSelectedEnrollmentIds([]);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load students."))
      .finally(() => setLoadingStudents(false));
  }, [sourceYearId, sourceSectionId]);

  const sourceYear = placement.find((year) => year.id === sourceYearId);
  const sourceSections = sourceYear?.classes.flatMap((item) =>
    item.sections.map((section) => ({ ...section, label: `${item.label} · Section ${section.name}` })),
  ) ?? [];
  const sourceClass = sourceYear?.classes.find((item) => item.sections.some((section) => section.id === sourceSectionId));
  const fromLabel = sourceSections.find((section) => section.id === sourceSectionId)?.label ?? "";
  const insideSections = (sourceClass?.sections ?? []).filter((section) => section.id !== sourceSectionId);
  const destinationSection = sourceClass?.sections.find((section) => section.id === destSectionId);
  const compatibleSchools = schools.filter((school) =>
    sourceClass?.level.startsWith("CLASS_")
      ? school.type !== "SECONDARY_ONLY"
      : sourceClass?.level.startsWith("FORM_")
        ? school.type !== "PRIMARY_ONLY"
        : false,
  );

  useEffect(() => {
    setToSchoolId((current) =>
      compatibleSchools.some((school) => school.id === current)
        ? current
        : compatibleSchools[0]?.id ?? "",
    );
  }, [sourceClass?.level, schools]);

  async function requestTransfer(enrollmentIds: string[]) {
    setError("");
    setMessage("");
    if (!enrollmentIds.length) {
      setError("Choose one student, several students, or the whole section.");
      return;
    }
    try {
      await api("/api/v1/transfer-requests", {
        method: "POST",
        body: JSON.stringify({
          enrollmentIds,
          toSchoolId,
          note: transferReason,
        }),
      });
      setMessage(enrollmentIds.length === students.length
        ? `Entire section sent (${enrollmentIds.length} ${enrollmentIds.length === 1 ? "student" : "students"}). The other school accepts or rejects them.`
        : enrollmentIds.length === 1
          ? "This student was sent. The other school accepts or rejects the request."
          : `${enrollmentIds.length} students were sent. The other school accepts or rejects them.`);
      setSelectedEnrollmentIds([]);
      setTransferReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request the transfer.");
    }
  }

  function matchingSections(row: Transfer) {
    return placement.flatMap((year) =>
      year.name !== row.sourceYear
        ? []
        : year.classes.flatMap((item) =>
            item.level !== row.sourceLevelCode
              ? []
              : item.sections.map((section) => ({
                  id: section.id,
                  yearId: year.id,
                  label: `${year.name} · ${item.label} · Section ${section.name}`,
                })),
          ),
    );
  }

  async function decide(row: Transfer, action: "approve" | "reject") {
    setError("");
    try {
      const sectionId = placementChoices[row.id];
      const option = matchingSections(row).find((item) => item.id === sectionId);
      const formSection = formYears.find((year) => year.id === formYearId)?.sections.find((section) => section.id === formSectionId);
      if (action === "approve" && row.kind === "FORM_1" && !formSection) {
        setError("Choose the Form 1 section before accepting.");
        return;
      }
      const reason = action === "reject" ? window.prompt("Rejection reason (optional)") ?? "" : "";
      await api(`/api/v1/transfer-requests/${row.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(
          action === "reject"
            ? { reason }
            : row.kind === "FORM_1"
              ? { toAcademicYearId: formYearId, toSectionId: formSectionId }
            : option
              ? { toAcademicYearId: option.yearId, toSectionId: option.id }
              : {},
        ),
      });
      setMessage(
        action === "reject"
          ? "Transfer rejected."
          : row.kind === "FORM_1"
            ? `Added to section ${formSection?.name}.`
            : option
              ? "Accepted. A new roll number was created. The student ID stays the same, and the first school still has the record and terms."
              : "Student accepted and is waiting for a matching section.",
      );
      setSelectedRequestIds((current) => current.filter((id) => id !== row.id));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the transfer.");
    }
  }

  async function acceptSelected(rows: Transfer[]) {
    const formSection = formYears.find((year) => year.id === formYearId)?.sections.find((section) => section.id === formSectionId);
    if (!formSection) {
      setError("Choose the Form 1 section before accepting.");
      return;
    }
    setError("");
    try {
      for (const row of rows) {
        await api(`/api/v1/transfer-requests/${row.id}/approve`, {
          method: "POST",
          body: JSON.stringify({ toAcademicYearId: formYearId, toSectionId: formSectionId }),
        });
      }
      setMessage(`Added to section ${formSection.name}.`);
      setSelectedRequestIds([]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept the selected students.");
      await load();
    }
  }

  const allSelected = students.length > 0 && students.every((student) => selectedEnrollmentIds.includes(student.enrollmentId));
  const incomingForm1 = transfers.filter((row) => row.incoming && row.kind === "FORM_1" && ["PENDING", "WAITING_FOR_SECTION"].includes(row.status));
  const formSections = formYears.find((year) => year.id === formYearId)?.sections ?? [];
  const chosenIncoming = incomingForm1.filter((row) => selectedRequestIds.includes(row.id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">Students › Transfers</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Student Transfers</h1>
        <p className="mt-1 text-sm text-slate-500">Students who are still studying in Class 1–8 or Form 1–4. Transfer the whole section, one student, or several students. Alumni are transferred from Alumni. The record, details, and terms stay here. The student ID stays the same, and a new roll number is created after the other school accepts.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><UsersRound className="h-5 w-5" /></span>
          <div><h2 className="font-semibold text-slate-950">1. Select students</h2><p className="text-sm text-slate-500">Tick one student, several students, or use Select all for the whole section.</p></div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">Academic year {sourceYear?.isCurrent ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Current Year</span> : null}</span>
            <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={sourceYearId} onChange={(event) => {
              const next = placement.find((year) => year.id === event.target.value);
              setSourceYearId(event.target.value);
              setSourceSectionId(next?.classes[0]?.sections[0]?.id ?? "");
              setDestSectionId("");
            }}>
              {placement.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current Year" : ""}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Class and section
            <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={sourceSectionId} onChange={(event) => { setSourceSectionId(event.target.value); setDestSectionId(""); }}>
              {sourceSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
          </label>
        </div>

        <div className="border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-[#2563eb]" checked={allSelected} onChange={() => setSelectedEnrollmentIds(allSelected ? [] : students.map((student) => student.enrollmentId))} />
              Select all students
            </label>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#2563eb]">{selectedEnrollmentIds.length} of {students.length} selected</span>
          </div>
          {loadingStudents ? <p className="px-5 py-8 text-sm text-slate-500">Loading students...</p> : null}
          {!loadingStudents && students.length ? (
            <div className="divide-y divide-slate-100">
              {students.map((student) => {
                const selected = selectedEnrollmentIds.includes(student.enrollmentId);
                return (
                  <div key={student.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${selected ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                    <input type="checkbox" aria-label={`Select ${student.name}`} className="h-4 w-4 accent-[#2563eb]" checked={selected} onChange={() => setSelectedEnrollmentIds((current) => selected ? current.filter((id) => id !== student.enrollmentId) : [...current, student.enrollmentId])} />
                    <Link to={`/school/students/${student.id}`} className="shrink-0">
                      {student.photoUrl
                        ? <img src={student.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        : <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700">{student.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>}
                    </Link>
                    <span className="min-w-48 flex-1">
                      <Link to={`/school/students/${student.id}`} className="block font-semibold text-slate-900 hover:text-[#2563eb] hover:underline">{student.name}</Link>
                      <Link to={`/school/students/${student.id}`} className="text-xs text-slate-500 hover:text-[#2563eb]">{student.permanentId}</Link>
                      <span className="mt-1 block text-xs font-medium text-blue-700">Current position: {student.year} · {student.level} · Section {student.section} · Roll {student.rollNumber}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{student.gender === "MALE" ? "Male" : "Female"}</span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">DOB {student.dateOfBirth.slice(0, 10)}</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{student.status}</span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Roll {student.rollNumber}</span>
                    </span>
                    {selected ? <Check className="h-5 w-5 text-[#2563eb]" /> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {!loadingStudents && !students.length ? <p className="px-5 py-8 text-sm text-slate-500">{sourceClass?.level === "CLASS_8" || sourceClass?.level === "FORM_4" ? "No students are still studying in this section. Graduates are transferred from Alumni: choose the year and section, then Transfer alumni student." : "No students are still studying in this section."}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><UsersRound className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold text-slate-950">2. Move inside this school</h2>
            <p className="text-sm text-slate-500">Class and year stay the same. Choose the destination section, then move one student, several students, or the whole section.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{fromLabel || "Choose a section"}</p>
            <p className="mt-1 text-xs text-slate-500">{sourceYear?.name} · {students.length} {students.length === 1 ? "student" : "students"}</p>
          </article>
          <div className="hidden items-center justify-center text-slate-300 md:flex"><ArrowRight className="h-5 w-5" /></div>
          <label className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm font-medium text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Destination</span>
            <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={destSectionId} onChange={(event) => setDestSectionId(event.target.value)}>
              <option value="">Choose section</option>
              {insideSections.map((section) => <option key={section.id} value={section.id}>{sourceClass?.label} · Section {section.name}</option>)}
            </select>
            <p className="mt-2 text-xs font-normal text-slate-500">Another section of the same class. Nothing moves until you confirm.</p>
          </label>
        </div>
        {!insideSections.length ? <p className="mt-3 text-sm text-amber-800">This class has no other section. Add one before moving students inside the school.</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!students.length || !destSectionId} className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setSectionReviewIds(students.map((student) => student.enrollmentId))}>Review entire section</button>
          <button type="button" disabled={!selectedEnrollmentIds.length || !destSectionId} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setSectionReviewIds(selectedEnrollmentIds)}>{selectedEnrollmentIds.length === 1 ? "Review this student" : `Review ${selectedEnrollmentIds.length || ""} students`}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><School className="h-5 w-5" /></span>
          <div><h2 className="font-semibold text-slate-950">3. Send to another school</h2><p className="text-sm text-slate-500">The destination school will choose a matching section after accepting.</p></div>
        </div>
        <label className="mt-5 block text-sm font-medium text-slate-700">Destination school
          <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={toSchoolId} onChange={(event) => setToSchoolId(event.target.value)}>
            {compatibleSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>
        {!compatibleSchools.length ? <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">No compatible school is available for {sourceClass?.label ?? "this level"}.</p> : null}
        <label className="mt-4 block text-sm font-medium text-slate-700">Transfer reason *
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            placeholder="Explain why the student(s) are being transferred..."
            maxLength={500}
            value={transferReason}
            onChange={(event) => setTransferReason(event.target.value)}
          />
          <span className="mt-1 block text-right text-xs font-normal text-slate-400">{transferReason.length}/500</span>
        </label>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>The other school accepts or rejects the request, then chooses the section. Nothing is placed automatically.</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!students.length || !toSchoolId || transferReason.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setSchoolReviewIds(students.map((student) => student.enrollmentId))}>
              Review entire section <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" disabled={!selectedEnrollmentIds.length || !toSchoolId || transferReason.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 font-semibold text-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setSchoolReviewIds(selectedEnrollmentIds)}>
              {selectedEnrollmentIds.length === 1 ? "Review this student" : `Review ${selectedEnrollmentIds.length || ""} students`}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-slate-900">Transfer requests</h2><p className="text-sm text-slate-500">Class 8 requests stay here until you review the student and choose a Form 1 section.</p></div>
        {incomingForm1.length ? (
          <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <h3 className="font-semibold text-slate-950">Place incoming Class 8 students</h3>
            <p className="mt-1 text-sm text-slate-600">Accept one student, several students, or the whole incoming section. Review the history first, then choose the Form 1 section. The new ID and roll are created when you accept.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Form 1 year
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={formYearId} onChange={(event) => { setFormYearId(event.target.value); setFormSectionId(""); }}>
                  {formYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Section
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={formSectionId} onChange={(event) => setFormSectionId(event.target.value)}>
                  <option value="">Choose section...</option>
                  {formSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setSelectedRequestIds(chosenIncoming.length === incomingForm1.length ? [] : incomingForm1.map((row) => row.id))}>{chosenIncoming.length === incomingForm1.length ? "Clear selection" : "Select all incoming students"}</button>
              <button type="button" disabled={!chosenIncoming.length || !formSectionId} className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void acceptSelected(chosenIncoming)}>{chosenIncoming.length === incomingForm1.length && incomingForm1.length > 0 ? "Accept entire section" : chosenIncoming.length === 1 ? "Accept this student" : `Accept ${chosenIncoming.length || ""} students`}</button>
            </div>
            {!formYears.length ? <p className="mt-3 text-sm text-amber-800">Create a Form 1 section for a year that starts after Class 8, then accept.</p> : null}
          </article>
        ) : null}
        {transfers.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{row.kind === "FORM_1" ? `Primary ID ${row.permanentId}` : row.permanentId}</p>
                <p className="mt-1 text-sm text-slate-500">{row.fromSchool} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {row.toSchool}</p>
                <p className="mt-1 text-xs text-slate-400">{row.sourceYear} · {row.sourceLevel} · Section {row.sourceSection}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Requested: {transferDate(row.requestedAt)}</span>
                  {row.status !== "PENDING" ? <span>{row.status === "COMPLETED" ? "Completed" : "Status updated"}: {transferDate(row.statusUpdatedAt)}</span> : null}
                </div>
              </div>
              <TransferStatus status={row.status} />
            </div>
            {row.note ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span className="font-semibold text-slate-700">Transfer reason:</span> {row.note}</p> : null}
            {row.rejectReason ? <p className="text-sm">Reason: {row.rejectReason}</p> : null}
            {row.incoming && ["PENDING", "WAITING_FOR_SECTION"].includes(row.status) ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                {row.kind === "FORM_1" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-slate-600">Open the student and check the academic history before choosing a section.</p>
                      <Link className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700" to={`/school/alumni/${row.studentId}`}>Review student</Link>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" className="h-4 w-4 accent-[#2563eb]" checked={selectedRequestIds.includes(row.id)} onChange={() => setSelectedRequestIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
                      Include in a section accept
                    </label>
                  </div>
                ) : matchingSections(row).length ? (
                  <label className="text-sm font-medium text-slate-700">Matching destination section
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={placementChoices[row.id] ?? ""} onChange={(event) => setPlacementChoices({ ...placementChoices, [row.id]: event.target.value })}>
                      <option value="">Choose section...</option>
                      {matchingSections(row).map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-amber-700"><Clock3 className="h-4 w-4" /> No matching section exists. Accepting will keep this student waiting for section.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white" onClick={() => decide(row, "approve")}>
                    {row.kind === "FORM_1" ? "Accept into this section" : placementChoices[row.id] ? "Accept & Place Student" : "Accept · Wait for Section"}
                  </button>
                  {row.status === "PENDING" ? <button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600" onClick={() => decide(row, "reject")}>Reject</button> : null}
                </div>
              </div>
            ) : null}
          </article>
        ))}
        {!transfers.length ? <p className="text-slate-500">No transfer requests yet.</p> : null}
      </section>
      {message ? <p className="text-blue-600">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      {sectionReviewIds ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-950">Confirm this move</h3>
              <p className="mt-1 text-sm text-slate-500">{sectionReviewIds.length} {sectionReviewIds.length === 1 ? "student" : "students"} stay at this school. Nothing changes until you confirm.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
                  <p className="mt-2 font-semibold text-slate-950">{fromLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{sourceYear?.name}</p>
                </article>
                <article className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Destination</p>
                  <p className="mt-2 font-semibold text-slate-950">{sourceClass?.label} · Section {destinationSection?.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{sourceYear?.name}</p>
                </article>
              </div>
              <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-700">
                {students.filter((student) => sectionReviewIds.includes(student.enrollmentId)).map((student) => <li key={student.enrollmentId}>{student.name} · {student.permanentId}</li>)}
              </ul>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setSectionReviewIds(null)}>Cancel</button>
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={moveBusy} onClick={() => {
                setMoveBusy(true);
                setError("");
                api<{ count: number }>("/api/v1/section-moves/batch", { method: "POST", body: JSON.stringify({ enrollmentIds: sectionReviewIds, toSectionId: destSectionId }) })
                  .then((result) => {
                    setMessage(`Moved ${result.count} ${result.count === 1 ? "student" : "students"} to ${sourceClass?.label} · Section ${destinationSection?.name}.`);
                    setSectionReviewIds(null);
                    setSelectedEnrollmentIds([]);
                    setDestSectionId("");
                    return api<{ students: StudentRow[] }>(`/api/v1/students?academicYearId=${sourceYearId}&sectionId=${sourceSectionId}&status=ACTIVE`).then((response) => setStudents(response.students));
                  })
                  .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not move the students."))
                  .finally(() => setMoveBusy(false));
              }}>{moveBusy ? "Moving…" : "Move students"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {schoolReviewIds ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-950">Confirm this transfer</h3>
              <p className="mt-1 text-sm text-slate-500">{schoolReviewIds.length} {schoolReviewIds.length === 1 ? "student stays" : "students stay"} here until the other school accepts.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
                  <p className="mt-2 font-semibold text-slate-950">{fromLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{sourceYear?.name}</p>
                </article>
                <article className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Destination school</p>
                  <p className="mt-2 font-semibold text-slate-950">{compatibleSchools.find((school) => school.id === toSchoolId)?.name}</p>
                  <p className="mt-1 text-xs text-slate-500">That school chooses the section after accepting.</p>
                </article>
              </div>
              <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-700">
                {students.filter((student) => schoolReviewIds.includes(student.enrollmentId)).map((student) => <li key={student.enrollmentId}>{student.name} · {student.permanentId}</li>)}
              </ul>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setSchoolReviewIds(null)}>Cancel</button>
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={moveBusy} onClick={() => {
                setMoveBusy(true);
                void requestTransfer(schoolReviewIds).finally(() => {
                  setSchoolReviewIds(null);
                  setMoveBusy(false);
                });
              }}>{moveBusy ? "Sending…" : "Send transfer"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TransferStatus({ status }: { status: string }) {
  const tones: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    WAITING_FOR_SECTION: "bg-orange-100 text-orange-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[status] ?? "bg-slate-100 text-slate-600"}`}>{status.replaceAll("_", " ")}</span>;
}
