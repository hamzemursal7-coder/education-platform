import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, FileText, GraduationCap, School, Users } from "lucide-react";
import { api } from "../lib/api";

type SubjectOption = { id: string; name: string; code: string };
type ClassOption = {
  id: string;
  label: string;
  level: string;
  sections: Array<{ id: string; name: string; subjects: SubjectOption[] }>;
  subjects: SubjectOption[];
};
type Placement = {
  id: string;
  name: string;
  isCurrent: boolean;
  classes: ClassOption[];
};

type ExamSubjectPick = { classGroupId: string; subjectId: string; examDay: string | null };

type Exam = {
  id: string;
  academicYearId: string;
  term: string;
  startDate: string | null;
  endDate: string | null;
  generalMax: number;
  passMark?: number;
  classGroupIds: string[];
  sectionIds: string[];
  classes: Array<{ id: string; label: string }>;
  subjects: ExamSubjectPick[];
  counts: { draft: number; submitted: number; verified: number; published: number; rejected: number };
};

type ReviewRow = {
  id: string | null;
  student: string;
  section: string;
  rollNumber: number;
  marks: number | null;
  isAbsent: boolean;
  comment: string | null;
  state: string;
  rejectReason: string | null;
  submittedAt: string | null;
  issue: string | null;
};

type ReviewSubject = {
  id: string;
  name: string;
  maxMarks: number;
  examDay: string | null;
  teacher: string | null;
  rows: ReviewRow[];
};

type ReviewClass = {
  id: string;
  label: string;
  sections: string[];
  subjects: ReviewSubject[];
};

type SchoolType = "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY";

function subjectKey(classGroupId: string, subjectId: string) {
  return `${classGroupId}|${subjectId}`;
}

function subjectsOn(classGroup: ClassOption, section: ClassOption["sections"][number]) {
  const rows = section.subjects?.length ? section.subjects : classGroup.subjects;
  return rows.map((subject) => ({ ...subject, classGroupId: classGroup.id, classLabel: classGroup.label }));
}

const field = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function dateValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function termLabel(term: string) {
  return term === "TERM_2" ? "Term 2" : "Term 1";
}

function prettyDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function PickList({
  title,
  count,
  total,
  empty,
  onAll,
  onClear,
  children,
}: {
  title: string;
  count: number;
  total: number;
  empty: string;
  onAll: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{count} selected</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{total} available</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700" onClick={onAll}>Select all</button>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700" onClick={onClear}>Clear all</button>
        </div>
      </div>
      <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {children}
      </div>
      {!total ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : null}
    </section>
  );
}

function PickRow({ checked, label, badge, onChange }: { checked: boolean; label: string; badge: string; onChange: () => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 px-3 py-3 ${checked ? "bg-blue-50" : "bg-white"}`}>
      <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={checked} onChange={onChange} />
      <span className="font-medium text-slate-900">{label}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{badge}</span>
    </label>
  );
}

export function ExamsPage() {
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [yearId, setYearId] = useState("");
  const [term, setTerm] = useState("TERM_1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generalMax, setGeneralMax] = useState(100);
  const [passMark, setPassMark] = useState(50);
  const [step, setStep] = useState<"details" | "scope">("details");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectDays, setSubjectDays] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ReviewClass[]>([]);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [schoolType, setSchoolType] = useState<SchoolType>("SECONDARY_ONLY");
  const [stage, setStage] = useState<"PRIMARY" | "SECONDARY">("SECONDARY");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [years, payload] = await Promise.all([
      api<Placement[]>("/api/v1/placement"),
      api<{ schoolType: SchoolType; exams: Exam[] }>("/api/v1/exams"),
    ]);
    setPlacement(years);
    setSchoolType(payload.schoolType);
    setStage(payload.schoolType === "PRIMARY_ONLY" ? "PRIMARY" : payload.schoolType === "PRIMARY_AND_SECONDARY" ? "PRIMARY" : "SECONDARY");
    setExams(payload.exams);
    setYearId((current) => current || years.find((year) => year.isCurrent)?.id || years[0]?.id || "");
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load exams."));
  }, []);

  const year = placement.find((item) => item.id === yearId);
  const exam = exams.find((item) => item.academicYearId === yearId && item.term === term);

  useEffect(() => {
    if (!exam) {
      setStartDate("");
      setEndDate("");
      setGeneralMax(100);
      setPassMark(50);
      setSelectedClasses([]);
      setSelectedSections([]);
      setSelectedSubjects([]);
      setSubjectDays({});
      setReview([]);
      return;
    }
    setStartDate(dateValue(exam.startDate));
    setEndDate(dateValue(exam.endDate));
    setGeneralMax(exam.generalMax);
    setPassMark(exam.passMark && exam.passMark > 0 ? exam.passMark : Math.round(exam.generalMax / 2));
    setSelectedClasses(exam.classGroupIds);
    setSelectedSections(exam.sectionIds);
    setSelectedSubjects(exam.subjects.map((row) => subjectKey(row.classGroupId, row.subjectId)));
    setSubjectDays(Object.fromEntries(exam.subjects.map((row) => [subjectKey(row.classGroupId, row.subjectId), dateValue(row.examDay)])));
    setMode("review");
    api<{ classes: ReviewClass[] }>(`/api/v1/exams/${exam.id}/review`)
      .then((data) => setReview(data.classes))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load results."));
  }, [exam?.id, exam?.startDate, exam?.endDate, exam?.generalMax, exam?.passMark, exam?.sectionIds.join("|"), exam?.subjects.map((row) => `${row.classGroupId}|${row.subjectId}|${row.examDay ?? ""}`).join(",")]);

  const activeStage = schoolType === "PRIMARY_AND_SECONDARY" ? stage : schoolType === "PRIMARY_ONLY" ? "PRIMARY" : "SECONDARY";
  const stageClasses = (year?.classes ?? []).filter((item) => activeStage === "PRIMARY" ? item.level.startsWith("CLASS") : item.level.startsWith("FORM"));

  const chosenClasses = stageClasses.filter((item) => selectedClasses.includes(item.id));
  const visibleSections = chosenClasses.flatMap((classGroup) => classGroup.sections.map((section) => ({ ...section, classGroup })));
  const chosenSections = visibleSections.filter((section) => selectedSections.includes(section.id));
  const visibleSubjects = chosenSections.flatMap((section) => subjectsOn(section.classGroup, section));
  const uniqueSubjects = [...new Map(visibleSubjects.map((subject) => [subjectKey(subject.classGroupId, subject.id), subject])).values()];

  function toggleClass(classGroup: ClassOption) {
    const on = selectedClasses.includes(classGroup.id);
    const sectionIds = classGroup.sections.map((section) => section.id);
    const keys = classGroup.sections.flatMap((section) => subjectsOn(classGroup, section).map((subject) => subjectKey(classGroup.id, subject.id)));
    setSelectedClasses((current) => on ? current.filter((id) => id !== classGroup.id) : [...current, classGroup.id]);
    if (on) {
      setSelectedSections((current) => current.filter((id) => !sectionIds.includes(id)));
      setSelectedSubjects((current) => current.filter((key) => !keys.includes(key)));
    }
  }

  function toggleSection(classGroup: ClassOption, sectionId: string) {
    const on = selectedSections.includes(sectionId);
    const section = classGroup.sections.find((item) => item.id === sectionId);
    const keys = section ? subjectsOn(classGroup, section).map((subject) => subjectKey(classGroup.id, subject.id)) : [];
    setSelectedSections((current) => on ? current.filter((id) => id !== sectionId) : [...current, sectionId]);
    if (on) {
      const stillVisible = new Set(
        chosenClasses.flatMap((item) => item.sections.filter((row) => row.id !== sectionId && selectedSections.includes(row.id)).flatMap((row) => subjectsOn(item, row).map((subject) => subjectKey(item.id, subject.id)))),
      );
      setSelectedSubjects((current) => current.filter((key) => stillVisible.has(key) || !keys.includes(key)));
    }
  }
  async function saveExam(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const subjects = selectedSubjects.flatMap((key) => {
        const [classGroupId, subjectId] = key.split("|");
        if (!classGroupId || !subjectId) return [];
        const classGroup = year?.classes.find((item) => item.id === classGroupId);
        if (!classGroup?.sections.some((section) => selectedSections.includes(section.id))) return [];
        return [{ classGroupId, subjectId, examDay: subjectDays[key] || undefined }];
      });
      const body = { startDate, endDate, generalMax, passMark, sectionIds: selectedSections, subjects, academicYearId: yearId, term };
      if (exam) {
        await api(`/api/v1/exams/${exam.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setMessage("Exam updated.");
      } else {
        await api("/api/v1/exams", { method: "POST", body: JSON.stringify(body) });
        setMessage("Exam created. Open it again any time to edit or review marks.");
      }
      setMode("review");
      setStep("details");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the exam.");
    } finally {
      setBusy(false);
    }
  }


  const editing = !exam || mode === "edit";

  return (
    <div className="space-y-6">
      {!editing ? (
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-600">Academic year
            <select className={`${field} mt-1.5 w-full`} value={yearId} onChange={(event) => setYearId(event.target.value)}>
              {placement.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " · current" : ""}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Term
            <select className={`${field} mt-1.5 w-full`} value={term} onChange={(event) => setTerm(event.target.value)}>
              <option value="TERM_1">Term 1</option>
              <option value="TERM_2">Term 2</option>
            </select>
          </label>
        </div>
      ) : null}

      {exam && !editing ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Exam</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{year?.name} · {termLabel(term)}</h2>
                <p className="mt-1 text-sm text-slate-500">Teachers enter marks for these subjects. Review, approve, and publish them in Results.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => { setMode("edit"); setStep("details"); }}>
                  <ArrowLeft className="h-4 w-4" /> Edit exam
                </button>
                <Link to="/school/results" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
                  Open results
                </Link>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">Start</dt><dd className="mt-1 font-medium text-slate-900">{prettyDate(exam.startDate)}</dd></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">End</dt><dd className="mt-1 font-medium text-slate-900">{prettyDate(exam.endDate)}</dd></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">Maximum marks</dt><dd className="mt-1 font-medium text-slate-900">{exam.generalMax}</dd></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">Pass mark</dt><dd className="mt-1 font-medium text-slate-900">{exam.passMark && exam.passMark > 0 ? exam.passMark : "Not set"}</dd></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3"><dt className="text-xs text-slate-500">Classes</dt><dd className="mt-1 font-medium text-slate-900">{exam.classes.length}</dd></div>
            </dl>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-950">Classes, sections and subjects</h3>
            {(review.length ? review : exam.classes.map((item) => ({ id: item.id, label: item.label, sections: [] as string[], subjects: [] as ReviewSubject[] }))).map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <h4 className="font-semibold text-slate-950">{item.label}</h4>
                  <p className="text-sm text-slate-500">{item.sections.length ? item.sections.map((section) => `Section ${section}`).join(" · ") : "Sections load with the exam"}</p>
                </div>
                {item.subjects.length ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3">Teacher</th>
                        <th className="px-5 py-3">Exam day</th>
                        <th className="px-5 py-3">Maximum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.subjects.map((subject) => (
                        <tr key={subject.id} className="border-t border-slate-100">
                          <td className="px-5 py-3 font-medium text-slate-900">{subject.name}</td>
                          <td className="px-5 py-3 text-slate-700">{subject.teacher ?? "Not assigned"}</td>
                          <td className="px-5 py-3 text-slate-700">{prettyDate(subject.examDay)}</td>
                          <td className="px-5 py-3 text-slate-700">{subject.maxMarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="px-5 py-4 text-sm text-slate-500">No subjects on this class yet.</p>}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {editing ? <form onSubmit={saveExam} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{step === "details" ? "Exam period" : "Classes, sections and subjects"}</h2>
            <p className="mt-1 text-sm text-slate-500">{step === "details" ? "Choose the year, term, and the exam dates. Classes for that year appear next." : "Choose every class, or one class. Sections of those classes appear next, then the subjects taught in those sections. Select all includes every section and subject."}</p>
          </div>
          {exam ? <button type="button" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600" onClick={() => setMode("review")}>Back to exam</button> : null}
        </div>
        {step === "details" ? <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-600">Academic year
            <select className={`${field} mt-1.5 w-full`} value={yearId} onChange={(event) => setYearId(event.target.value)}>
              {placement.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " · current" : ""}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Term
            <select className={`${field} mt-1.5 w-full`} value={term} onChange={(event) => setTerm(event.target.value)}>
              <option value="TERM_1">Term 1</option>
              <option value="TERM_2">Term 2</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">Start
            <span className="relative mt-1.5 block">
              <Calendar className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className={`${field} w-full pl-9`} type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </span>
          </label>
          <label className="text-sm text-slate-600">End
            <span className="relative mt-1.5 block">
              <Calendar className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className={`${field} w-full pl-9`} type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </span>
          </label>
          <label className="text-sm text-slate-600">Maximum marks
            <select className={`${field} mt-1.5 w-full`} value={generalMax} onChange={(event) => {
              const next = Number(event.target.value);
              setGeneralMax(next);
              setPassMark((current) => current > next ? Math.round(next / 2) : current);
            }}>
              <option value={100}>100</option>
              <option value={50}>50</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">Pass mark
            <input className={`${field} mt-1.5 w-full`} type="number" min={0} max={generalMax} required value={passMark} onChange={(event) => setPassMark(Number(event.target.value))} />
          </label>
        </div> : null}
        {step === "scope" ? (
          <div className="mt-5 space-y-4">
            <PickList
              title="Classes"
              count={selectedClasses.filter((id) => stageClasses.some((item) => item.id === id)).length}
              total={stageClasses.length}
              empty={activeStage === "PRIMARY" ? "This year has no primary classes yet." : "This year has no secondary classes yet."}
              onAll={() => {
                const classIds = stageClasses.map((item) => item.id);
                const sectionIds = stageClasses.flatMap((item) => item.sections.map((section) => section.id));
                const keys = stageClasses.flatMap((item) => item.sections.flatMap((section) => subjectsOn(item, section).map((subject) => subjectKey(item.id, subject.id))));
                setSelectedClasses((current) => [...new Set([...current, ...classIds])]);
                setSelectedSections((current) => [...new Set([...current, ...sectionIds])]);
                setSelectedSubjects((current) => [...new Set([...current, ...keys])]);
                setSubjectDays((current) => {
                  const next = { ...current };
                  for (const key of keys) if (!next[key] && startDate) next[key] = startDate;
                  return next;
                });
              }}
              onClear={() => {
                setSelectedClasses([]);
                setSelectedSections([]);
                setSelectedSubjects([]);
              }}
            >
              {schoolType === "PRIMARY_AND_SECONDARY" ? (
                <div className="flex gap-2 border-b border-slate-100 px-3 py-3">
                  <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeStage === "PRIMARY" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setStage("PRIMARY")}>Primary · Classes 1–8</button>
                  <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeStage === "SECONDARY" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setStage("SECONDARY")}>Secondary · Forms 1–4</button>
                </div>
              ) : null}
              {stageClasses.map((item) => (
                <PickRow key={item.id} checked={selectedClasses.includes(item.id)} label={item.label} badge={item.level.startsWith("FORM") ? "SECONDARY" : "PRIMARY"} onChange={() => toggleClass(item)} />
              ))}
            </PickList>
            {chosenClasses.length ? (
              <PickList
                title="Sections"
                count={chosenSections.length}
                total={visibleSections.length}
                empty="The selected classes have no sections yet."
                onAll={() => setSelectedSections(visibleSections.map((section) => section.id))}
                onClear={() => {
                  setSelectedSections([]);
                  setSelectedSubjects([]);
                }}
              >
                {visibleSections.map((section) => (
                  <PickRow key={section.id} checked={selectedSections.includes(section.id)} label={`Section ${section.name}`} badge={section.classGroup.label} onChange={() => toggleSection(section.classGroup, section.id)} />
                ))}
              </PickList>
            ) : null}
            {chosenSections.length ? (
              <PickList
                title="Subjects"
                count={uniqueSubjects.filter((subject) => selectedSubjects.includes(subjectKey(subject.classGroupId, subject.id))).length}
                total={uniqueSubjects.length}
                empty="The selected sections have no subjects yet."
                onAll={() => setSelectedSubjects(uniqueSubjects.map((subject) => subjectKey(subject.classGroupId, subject.id)))}
                onClear={() => setSelectedSubjects([])}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {uniqueSubjects.map((subject) => {
                    const key = subjectKey(subject.classGroupId, subject.id);
                    const checked = selectedSubjects.includes(key);
                    return (
                      <div key={key} className={`rounded-xl px-3 py-2 ${checked ? "bg-blue-50" : ""}`}>
                        <PickRow checked={checked} label={subject.name} badge={subject.code} onChange={() => setSelectedSubjects((current) => checked ? current.filter((item) => item !== key) : [...current, key])} />
                        {checked ? <input className={`${field} mt-2 w-full`} type="date" min={startDate || undefined} max={endDate || undefined} value={subjectDays[key] ?? ""} onChange={(event) => setSubjectDays((current) => ({ ...current, [key]: event.target.value }))} /> : null}
                      </div>
                    );
                  })}
                </div>
              </PickList>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 flex items-center justify-between">
          {step === "scope" ? (
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setStep("details")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : <span />}
          {step === "details" ? (
            <button type="button" disabled={!yearId || !startDate || !endDate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" onClick={() => setStep("scope")}>
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={busy || !selectedSections.length || !selectedSubjects.length} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {exam ? "Save changes" : "Create exam"} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form> : null}

      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

type StudentSubject = {
  subject: string;
  maxMarks: number;
  marks: number | null;
  isAbsent: boolean;
  pending?: boolean;
  percentage: number | null;
};

type StudentTerm = {
  term: "TERM_1" | "TERM_2";
  label: string;
  examConfigured: boolean;
  published: boolean;
  publishedAt: string | null;
  examLabel: string | null;
  average: number | null;
  status?: "final" | "provisional" | "unavailable";
  subjectCount: number;
  publishedCount?: number;
  pendingCount?: number;
  obtained?: number;
  possible?: number;
  subjects: StudentSubject[];
};

type StudentDashboard = {
  student: { name: string; permanentId: string; photoUrl: string | null; initials: string; dateOfBirth?: string; rollNumber?: number | null } | null;
  years: Array<{ id: string; name: string; isCurrent: boolean }>;
  year: {
    id: string;
    name: string;
    isCurrent: boolean;
    school: string;
    level: string;
    section: string;
    status: string;
    teachers: string[];
  } | null;
  terms: StudentTerm[];
  yearAverage: number | null;
  yearStatus?: "final" | "provisional" | "unavailable";
  yearObtained?: number;
  yearPossible?: number;
  yearSubjectCount: number;
  yearPublishedCount?: number;
  yearPendingCount?: number;
};

function ageFrom(value: string | undefined) {
  if (!value) return null;
  const born = new Date(value);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age < 0 ? null : age;
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100) / 100}%`;
}

function formatPublishedOn(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AverageRing({ value, color }: { value: number | null; color: string }) {
  const portion = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${portion * 3.6}deg, #e2e8f0 0deg)` }} />
      <div className="absolute inset-[5px] rounded-full bg-white" />
      <span className="relative text-[11px] font-semibold text-slate-700">{value === null ? "—" : formatPercent(Math.round(value))}</span>
    </div>
  );
}

function SummaryMetric({
  term,
  tone,
  detail,
}: {
  term: StudentTerm | { label: string; average: number | null; subjectCount: number; published: boolean; examConfigured: boolean; status?: "final" | "provisional" | "unavailable"; publishedCount?: number; pendingCount?: number; obtained?: number; possible?: number };
  tone: "sky" | "amber" | "emerald";
  detail?: string;
}) {
  const styles = {
    sky: { card: "border-sky-100 bg-sky-50", icon: "bg-blue-600", ring: "#2563eb" },
    amber: { card: "border-amber-100 bg-amber-50", icon: "bg-amber-500", ring: "#d97706" },
    emerald: { card: "border-emerald-100 bg-emerald-50", icon: "bg-emerald-600", ring: "#059669" },
  }[tone];
  const waiting = term.subjectCount === 0;
  return (
    <article className={`flex h-full items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${styles.card}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-white ${styles.icon}`}>
            <GraduationCap className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium text-slate-600">{term.label} Average</p>
        </div>
        {waiting ? (
          <>
            <p className={`mt-3 text-lg font-semibold ${term.examConfigured ? "text-amber-700" : "text-slate-600"}`}>{term.examConfigured ? "Not Yet Published" : "Not available"}</p>
            <p className="mt-1 text-xs text-slate-500">{term.examConfigured ? "Results will appear once published" : "This exam has not been set up"}</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(term.average)}</p>
            <p className="mt-1 text-xs text-slate-500">{detail ?? `${term.status === "final" ? "Final" : "Provisional"} · ${term.publishedCount ?? term.subjectCount}/${term.subjectCount} published${term.possible ? ` · ${term.obtained ?? 0}/${term.possible}` : ""}`}</p>
          </>
        )}
      </div>
      <AverageRing value={waiting ? null : term.average} color={styles.ring} />
    </article>
  );
}

export function StudentResultsPage() {
  const [yearId, setYearId] = useState("");
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = yearId ? `?academicYearId=${encodeURIComponent(yearId)}` : "";
    api<StudentDashboard>(`/api/v1/student/results${query}`)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setError("");
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [yearId]);

  const yearAverageTerm = {
    label: "Academic Year",
    average: data?.yearAverage ?? null,
    subjectCount: data?.yearSubjectCount ?? 0,
    publishedCount: data?.yearPublishedCount ?? 0,
    pendingCount: data?.yearPendingCount ?? 0,
    obtained: data?.yearObtained ?? 0,
    possible: data?.yearPossible ?? 0,
    status: data?.yearStatus,
    published: (data?.yearPublishedCount ?? data?.yearSubjectCount ?? 0) > 0,
    examConfigured: (data?.terms ?? []).some((term) => term.examConfigured),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-slate-500">Academic Year</span>
          <select
            className="bg-transparent font-semibold text-slate-900 outline-none"
            value={yearId || data?.year?.id || ""}
            onChange={(event) => setYearId(event.target.value)}
          >
            {(data?.years ?? []).map((year) => (
              <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current Year)" : ""}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      {loading && !data ? <p className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">Loading your results…</p> : null}

      {data?.student && data.year ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            {data.student.photoUrl ? (
              <img src={data.student.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-blue-600 text-lg font-semibold text-white">{data.student.initials || "S"}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">{data.student.name}</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{data.year.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">ID {data.student.permanentId} · Roll {data.student.rollNumber ?? "—"} · Age {ageFrom(data.student.dateOfBirth) ?? "—"}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><School className="h-4 w-4 text-blue-600" />{data.year.school}</span>
                <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-blue-600" />{data.year.level}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-600" />Section {data.year.section}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-blue-600" />{data.year.name}{data.year.isCurrent ? " · Current year" : ""}</span>
                {data.year.teachers.length ? (
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-600" />{data.year.teachers.length === 1 ? "Class teacher" : "Teachers"}: {data.year.teachers.join(", ")}</span>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {data?.terms.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.terms.map((term) => (
            <SummaryMetric key={term.term} term={term} tone={term.term === "TERM_1" ? "sky" : "amber"} />
          ))}
          <SummaryMetric term={yearAverageTerm} tone="emerald" />
        </div>
      ) : null}

      {data?.terms.length ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {data.terms.map((term) => {
            const publishedOn = formatPublishedOn(term.publishedAt);
            return (
              <section key={term.term} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex min-h-[4.75rem] items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">{term.label} Results</h3>
                      <p className="text-sm text-slate-500">{term.examLabel ?? "No exam configured"}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {term.published ? (
                      <>
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Published</span>
                        {publishedOn ? <p className="mt-1 text-xs text-slate-500">Published on {publishedOn}</p> : null}
                      </>
                    ) : (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${term.examConfigured ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {term.examConfigured ? "Not Yet Published" : "Not available"}
                      </span>
                    )}
                  </div>
                </header>
                {term.subjects.length ? (
                  <div className="overflow-x-auto px-3 py-3">
                    <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <th className="border-b border-slate-200 px-3 py-2">#</th>
                          <th className="border-b border-slate-200 px-3 py-2">Subject</th>
                          <th className="border-b border-slate-200 px-3 py-2">Max Marks</th>
                          <th className="border-b border-slate-200 px-3 py-2">Marks Obtained</th>
                          <th className="border-b border-slate-200 px-3 py-2">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.subjects.map((row, index) => (
                          <tr key={`${row.subject}-${index}`}>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-500">{index + 1}</td>
                            <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">{row.subject}</td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.maxMarks}</td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-900">{row.isAbsent ? "Absent" : row.pending ? "—" : row.marks}</td>
                            <td className="border-b border-slate-100 px-3 py-3 font-semibold text-blue-700">{row.isAbsent ? "—" : row.pending ? "Pending" : formatPercent(row.percentage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-sky-50 text-blue-500">
                      <FileText className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      {term.examConfigured ? `Results for ${term.label} have not been published yet.` : `${term.label} exam is not available.`}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      {term.examConfigured ? "Results will appear here once the school publishes them." : "The school has not set up this exam for your class."}
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {data?.year && data.terms.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><GraduationCap className="h-4 w-4" /></span>
            <div>
              <h3 className="font-semibold text-slate-950">Academic Year Summary ({data.year.name})</h3>
              <p className="text-sm text-slate-500">{data.yearStatus === "final" ? "Final average. Every assigned subject is published." : "Provisional average. Unpublished subjects stay in the maximum marks."}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {data.terms.map((term) => (
              <SummaryMetric key={`summary-${term.term}`} term={term} tone={term.term === "TERM_1" ? "sky" : "amber"} />
            ))}
            <SummaryMetric term={yearAverageTerm} tone="emerald" />
          </div>
        </section>
      ) : null}

      {data && !data.student && !loading ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">No student record is linked to this account.</p>
      ) : null}
    </div>
  );
}
