import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCheck, Clock, Download, Pencil, Printer, Send, Users } from "lucide-react";
import { api } from "../lib/api";
import { provisionalTotal } from "../lib/examAverages";

type SchoolType = "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY";
type Placement = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; academicYearId: string; term: string; startDate?: string; endDate?: string; generalMax?: number };
type BoardStatus = "NOT_SUBMITTED" | "IN_PROGRESS" | "AWAITING" | "APPROVED" | "RETURNED" | "PUBLISHED";

type BoardSubject = {
  id: string;
  name: string;
  teacher: string | null;
  status: BoardStatus;
  students: number;
  submittedStudents: number;
  missingStudents: number;
  errors: number;
  submittedAt: string | null;
};

type BoardRow = {
  classGroupId: string;
  sectionId: string;
  level: string;
  stage: "PRIMARY" | "SECONDARY";
  classLabel: string;
  section: string;
  requiredSubjects: number;
  submittedSubjects: number;
  pendingSubjects: number;
  progress: number;
  status: BoardStatus;
  updatedAt: string | null;
  subjects: BoardSubject[];
};

type Board = { schoolType: SchoolType; examId: string; year: string; term: string; rows: BoardRow[] };

type ReviewStudent = {
  id: string | null;
  enrollmentId: string;
  student: string;
  permanentId: string;
  section: string;
  rollNumber: number;
  marks: number | null;
  isAbsent: boolean;
  state: string;
  rejectReason: string | null;
  submittedAt: string | null;
  publishedAt?: string | null;
  issue: string | null;
};

type ReviewSubject = { id: string; subjectId?: string; name: string; maxMarks: number; minMarks: number; examDay: string | null; teacher: string | null; rows: ReviewStudent[] };
type ReviewClass = { id: string; label: string; sections?: Array<{ name: string; subjectIds: string[] }>; subjects: ReviewSubject[] };

type PublishScope = {
  exam: string;
  year: string;
  term: string;
  classes: number;
  subjects: number;
  studentResults: number;
  ready: number;
  awaiting: number;
  published?: number;
  publishedAt?: string | null;
};

type PublishedRow = {
  classLabel: string;
  stage: "PRIMARY" | "SECONDARY";
  section: string;
  student: string;
  permanentId: string;
  subject: string;
  marks: number | null;
  isAbsent: boolean;
  maxMarks: number;
  publishedAt: string | null;
};

const field = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function termLabel(term: string) {
  return term === "TERM_2" ? "Term 2" : "Term 1";
}

function sectionScore(subjects: ReviewSubject[], enrollmentId: string) {
  const cells = subjects.map((subject) => {
    const row = subject.rows.find((item) => item.enrollmentId === enrollmentId);
    const approved = Boolean(row && (row.state === "VERIFIED" || row.state === "PUBLISHED"));
    const absent = Boolean(approved && row?.isAbsent);
    return {
      subject,
      row,
      approved,
      absent,
      pending: !approved,
      maxMarks: subject.maxMarks,
      marks: approved && !absent ? row?.marks ?? null : null,
      counted: !absent,
    };
  });
  return { cells, ...provisionalTotal(cells) };
}

function statusLabel(status: BoardStatus) {
  if (status === "NOT_SUBMITTED") return "Not Submitted";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "AWAITING") return "Pending Review";
  if (status === "APPROVED") return "Approved";
  if (status === "RETURNED") return "Returned for Correction";
  return "Published";
}

function statusClass(status: BoardStatus) {
  if (status === "NOT_SUBMITTED") return "bg-slate-100 text-slate-600";
  if (status === "IN_PROGRESS") return "bg-amber-50 text-amber-700";
  if (status === "AWAITING") return "bg-blue-50 text-blue-700";
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "RETURNED") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function Filters({
  years,
  yearId,
  setYearId,
  term,
  setTerm,
  exams,
  schoolType,
  stage,
  setStage,
  classId,
  setClassId,
  section,
  setSection,
  status,
  setStatus,
  showStatus = true,
  classes,
  sections,
}: {
  years: Placement[];
  yearId: string;
  setYearId: (value: string) => void;
  term: string;
  setTerm: (value: string) => void;
  exams: Exam[];
  schoolType: SchoolType;
  stage: "ALL" | "PRIMARY" | "SECONDARY";
  setStage: (value: "ALL" | "PRIMARY" | "SECONDARY") => void;
  classId: string;
  setClassId: (value: string) => void;
  section: string;
  setSection: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  showStatus?: boolean;
  classes: Array<{ id: string; label: string }>;
  sections: string[];
}) {
  const yearExams = exams.filter((item) => item.academicYearId === yearId);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm text-slate-600">Academic year
        <select className={`${field} mt-1.5 w-full`} value={yearId} onChange={(event) => setYearId(event.target.value)}>
          {years.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " · current" : ""}</option>)}
        </select>
      </label>
      <label className="text-sm text-slate-600">Term
        <select className={`${field} mt-1.5 w-full`} value={term} onChange={(event) => setTerm(event.target.value)}>
          {yearExams.map((item) => <option key={item.id} value={item.term}>{termLabel(item.term)}</option>)}
          {!yearExams.length ? <option value={term}>No exam</option> : null}
        </select>
      </label>
      <label className="text-sm text-slate-600">Exam
        <select className={`${field} mt-1.5 w-full`} value={term} onChange={(event) => setTerm(event.target.value)}>
          {yearExams.map((item) => <option key={item.id} value={item.term}>{termLabel(item.term)}</option>)}
          {!yearExams.length ? <option value="">No exam for this year</option> : null}
        </select>
      </label>
      {schoolType === "PRIMARY_AND_SECONDARY" ? (
        <label className="text-sm text-slate-600">School stage
          <select className={`${field} mt-1.5 w-full`} value={stage} onChange={(event) => setStage(event.target.value as "ALL" | "PRIMARY" | "SECONDARY")}>
            <option value="ALL">Primary and secondary</option>
            <option value="PRIMARY">Primary · Classes 1–8</option>
            <option value="SECONDARY">Secondary · Forms 1–4</option>
          </select>
        </label>
      ) : (
        <label className="text-sm text-slate-600">School stage
          <input className={`${field} mt-1.5 w-full`} readOnly value={schoolType === "PRIMARY_ONLY" ? "Primary · Classes 1–8" : "Secondary · Forms 1–4"} />
        </label>
      )}
      <label className="text-sm text-slate-600">Class
        <select className={`${field} mt-1.5 w-full`} value={classId} onChange={(event) => { setClassId(event.target.value); setSection(""); }}>
          <option value="">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm text-slate-600">Section
        <select className={`${field} mt-1.5 w-full`} value={section} onChange={(event) => setSection(event.target.value)}>
          <option value="">All sections</option>
          {sections.map((item) => <option key={item} value={item}>Section {item}</option>)}
        </select>
      </label>
      {showStatus ? (
      <label className="text-sm text-slate-600">Submission status
        <select className={`${field} mt-1.5 w-full`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="NOT_SUBMITTED">Not Submitted</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="AWAITING">Submitted — Awaiting Review</option>
          <option value="APPROVED">Approved</option>
          <option value="RETURNED">Returned for Correction</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </label>
      ) : null}
    </div>
  );
}

export function MarksSubmissionPage() {
  const [years, setYears] = useState<Placement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [schoolKind, setSchoolKind] = useState<SchoolType>("SECONDARY_ONLY");
  const [yearId, setYearId] = useState("");
  const [term, setTerm] = useState("TERM_1");
  const [board, setBoard] = useState<Board | null>(null);
  const [review, setReview] = useState<ReviewClass[]>([]);
  const [stage, setStage] = useState<"ALL" | "PRIMARY" | "SECONDARY">("ALL");
  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [openKey, setOpenKey] = useState("");
  const [reviewSubjectId, setReviewSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const exam = exams.find((item) => item.academicYearId === yearId && item.term === term);

  async function loadBoard(examId: string) {
    const [nextBoard, nextReview] = await Promise.all([
      api<Board>(`/api/v1/exams/${examId}/submissions`),
      api<{ classes: ReviewClass[] }>(`/api/v1/exams/${examId}/review`),
    ]);
    setBoard(nextBoard);
    setReview(nextReview.classes);
  }

  useEffect(() => {
    Promise.all([
      api<Placement[]>("/api/v1/placement"),
      api<{ schoolType: SchoolType; exams: Exam[] }>("/api/v1/exams"),
    ]).then(([yearRows, payload]) => {
      setYears(yearRows);
      setExams(payload.exams);
      setSchoolKind(payload.schoolType);
      const nextYear = yearRows.find((item) => item.isCurrent)?.id || yearRows[0]?.id || "";
      setYearId(nextYear);
      const first = payload.exams.find((item) => item.academicYearId === nextYear);
      if (first) setTerm(first.term);
      setStage(payload.schoolType === "PRIMARY_AND_SECONDARY" ? "ALL" : payload.schoolType === "PRIMARY_ONLY" ? "PRIMARY" : "SECONDARY");
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load marks."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!yearId || exams.some((item) => item.academicYearId === yearId && item.term === term)) return;
    const first = exams.find((item) => item.academicYearId === yearId);
    if (first) setTerm(first.term);
  }, [yearId, exams, term]);

  useEffect(() => {
    if (!exam) {
      setBoard(null);
      setReview([]);
      return;
    }
    setError("");
    loadBoard(exam.id).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load submissions."));
  }, [exam?.id]);

  const rows = useMemo(() => {
    return (board?.rows ?? []).filter((row) => {
      if (stage !== "ALL" && row.stage !== stage) return false;
      if (classId && row.classGroupId !== classId) return false;
      if (section && row.section !== section) return false;
      if (status && row.status !== status) return false;
      return true;
    });
  }, [board, stage, classId, section, status]);
  const classes = [...new Map((board?.rows ?? []).filter((row) => stage === "ALL" || row.stage === stage).map((row) => [row.classGroupId, { id: row.classGroupId, label: row.classLabel }])).values()];
  const sections = [...new Set((board?.rows ?? []).filter((row) => !classId || row.classGroupId === classId).map((row) => row.section))];
  const cards = {
    classes: new Set(rows.map((row) => row.classGroupId)).size,
    submitted: rows.filter((row) => !["NOT_SUBMITTED", "IN_PROGRESS"].includes(row.status)).length,
    progress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    missing: rows.filter((row) => row.status === "NOT_SUBMITTED").length,
    awaiting: rows.filter((row) => row.status === "AWAITING").length,
    approved: rows.filter((row) => row.status === "APPROVED").length,
  };
  const allSubjects = (board?.rows ?? []).flatMap((row) => row.subjects.map((subject) => ({ ...subject, classLabel: row.classLabel, section: row.section })));
  const openRow = rows.find((row) => `${row.sectionId}` === openKey) ?? null;
  const reviewSubject = review.flatMap((item) => item.subjects).find((subject) => subject.id === reviewSubjectId) ?? null;

  async function approveValid() {
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ accepted: number; skipped: number }>(`/api/v1/exams/${exam.id}/accept-submitted`, { method: "POST" });
      setSummaryOpen(false);
      setMessage(result.skipped
        ? `${result.accepted} valid mark${result.accepted === 1 ? "" : "s"} approved. ${result.skipped} incomplete mark${result.skipped === 1 ? "" : "s"} stayed unapproved.`
        : `${result.accepted} valid mark${result.accepted === 1 ? "" : "s"} approved. They stay hidden until you publish.`);
      await loadBoard(exam.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not approve marks.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "verify" | "reject") {
    if (!exam) return;
    setError("");
    try {
      await api(`/api/v1/result-sheets/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      });
      setRejectingId(null);
      setReason("");
      await loadBoard(exam.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the mark.");
    }
  }

  return (
    <div className="space-y-5">
      <Filters years={years} yearId={yearId} setYearId={setYearId} term={term} setTerm={setTerm} exams={exams} schoolType={schoolKind} stage={stage} setStage={setStage} classId={classId} setClassId={setClassId} section={section} setSection={setSection} status={status} setStatus={setStatus} classes={classes} sections={sections} />
      {loading ? <p className="text-sm text-slate-500">Loading submissions...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
      {!loading && !exam ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">Create the exam for this year and term before teachers can submit marks.</p> : null}
      {exam && board ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card label="Total classes" value={cards.classes} />
            <Card label="Fully submitted" value={cards.submitted} />
            <Card label="In progress" value={cards.progress} />
            <Card label="Not submitted" value={cards.missing} />
            <Card label="Awaiting approval" value={cards.awaiting} />
            <Card label="Approved, not published" value={cards.approved} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{board.year} · {termLabel(board.term)}. Classes with no marks stay on this list.</p>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => setSummaryOpen(true)}>
              <CheckCheck className="h-4 w-4" /> Review all submitted marks
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sectionId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.classLabel} · Section {row.section}</td>
                    <td className="px-4 py-3">{row.requiredSubjects}</td>
                    <td className="px-4 py-3">{row.submittedSubjects}</td>
                    <td className="px-4 py-3">{row.pendingSubjects}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${row.progress}%` }} /></div>
                      <span className="text-xs text-slate-500">{row.progress}%</span>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                    <td className="px-4 py-3 text-slate-500">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3"><button type="button" className="font-semibold text-blue-700" onClick={() => { setOpenKey(openKey === row.sectionId ? "" : row.sectionId); setReviewSubjectId(""); }}>{openKey === row.sectionId ? "Hide" : "View details"}</button></td>
                  </tr>
                ))}
                {!rows.length ? <tr><td className="px-4 py-8 text-slate-500" colSpan={8}>No classes match these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
          {openRow ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-950">{openRow.classLabel} · Section {openRow.section}</h2>
                <p className="text-sm text-slate-500">Every required subject stays visible, including subjects the teacher has not submitted.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Missing</th>
                      <th className="px-4 py-3">Errors</th>
                      <th className="px-4 py-3">Submitted on</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRow.subjects.map((subject) => (
                      <tr key={subject.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{subject.name}</td>
                        <td className="px-4 py-3">{subject.teacher ?? "No teacher assigned"}</td>
                        <td className="px-4 py-3">{subject.submittedStudents}/{subject.students}</td>
                        <td className="px-4 py-3">{subject.missingStudents}</td>
                        <td className="px-4 py-3">{subject.errors}</td>
                        <td className="px-4 py-3">{subject.submittedAt ? new Date(subject.submittedAt).toLocaleString() : "—"}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(subject.status)}`}>{statusLabel(subject.status)}</span></td>
                        <td className="px-4 py-3">{subject.status === "NOT_SUBMITTED" ? null : <button type="button" className="font-semibold text-blue-700" onClick={() => setReviewSubjectId(reviewSubjectId === subject.id ? "" : subject.id)}>Review marks</button>}</td>
                      </tr>
                    ))}
                    {!openRow.subjects.length ? <tr><td className="px-4 py-6 text-slate-500" colSpan={8}>This class has no subjects on the exam.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {reviewSubject ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-950">{reviewSubject.name}</h2>
                <p className="text-sm text-slate-500">Maximum {reviewSubject.maxMarks}. Invalid or missing marks cannot be approved.</p>
              </div>
              {reviewSubject.rows.map((row) => (
                <div key={`${row.permanentId}-${row.rollNumber}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{row.student}</p>
                    <p className="text-xs text-slate-500">{row.permanentId} · Roll {row.rollNumber} · {row.isAbsent ? "Absent" : row.marks ?? "No mark"} / {reviewSubject.maxMarks}</p>
                    {row.issue && row.state !== "PUBLISHED" ? <p className="text-xs text-amber-700">{row.issue}</p> : null}
                    {row.rejectReason ? <p className="text-xs text-red-600">{row.rejectReason}</p> : null}
                    {row.id && rejectingId === row.id ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input className={field} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for correction" />
                        <button type="button" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void act(row.id!, "reject")}>Confirm return</button>
                        <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => setRejectingId(null)}>Cancel</button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{row.state === "WAITING" ? "Not entered" : row.state === "VERIFIED" ? "Approved" : row.state === "REJECTED" ? "Returned" : row.state === "SUBMITTED" ? "Submitted" : row.state === "PUBLISHED" ? "Published" : "Draft"}</span>
                    {row.id && row.state === "SUBMITTED" && !row.issue ? <button type="button" className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700" onClick={() => void act(row.id!, "verify")}>Approve</button> : null}
                    {row.id && row.state === "SUBMITTED" ? <button type="button" className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600" onClick={() => setRejectingId(row.id)}>Return</button> : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
      {summaryOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <h2 className="text-lg font-semibold text-slate-950">Review all submitted marks</h2>
            <p className="mt-2 text-sm text-slate-600">Valid submitted marks can be approved together. Unsubmitted, incomplete, and invalid marks stay out.</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Ready for approval</dt><dd className="font-medium">{allSubjects.filter((row) => row.status === "AWAITING" && row.errors === 0 && row.missingStudents === 0).length} subjects</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Incomplete submissions</dt><dd className="font-medium">{allSubjects.filter((row) => row.status === "IN_PROGRESS" || row.errors > 0).length} subjects</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Still awaiting submission</dt><dd className="font-medium">{allSubjects.filter((row) => row.status === "NOT_SUBMITTED").length} subjects</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Validation errors</dt><dd className="font-medium">{allSubjects.reduce((sum, row) => sum + row.errors, 0)}</dd></div>
            </dl>
            <ul className="mt-4 max-h-48 space-y-1 overflow-auto text-sm text-slate-700">
              {allSubjects.filter((row) => row.status === "NOT_SUBMITTED" || row.status === "IN_PROGRESS").map((row) => (
                <li key={`${row.classLabel}-${row.section}-${row.id}`}>{row.classLabel} · {row.section} · {row.name} · {statusLabel(row.status)}{row.teacher ? ` · ${row.teacher}` : ""}</li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" onClick={() => setSummaryOpen(false)}>Cancel</button>
              <button type="button" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void approveValid()}>{busy ? "Approving..." : "Approve valid submissions"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResultsBoardPage() {
  const [years, setYears] = useState<Placement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [yearId, setYearId] = useState("");
  const [term, setTerm] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [review, setReview] = useState<ReviewClass[]>([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<{ subjectId: string; section: string } | null>(null);
  const [reason, setReason] = useState("");
  const [returning, setReturning] = useState(false);
  const [preview, setPreview] = useState<PublishScope | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [classId, setClassId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [view, setView] = useState<"section" | "review">("section");

  useEffect(() => {
    Promise.all([
      api<Placement[]>("/api/v1/placement"),
      api<{ exams: Exam[] }>("/api/v1/exams"),
    ]).then(([yearRows, payload]) => {
      setYears(yearRows);
      setExams(payload.exams);
      setYearId((current) => current || yearRows.find((year) => year.isCurrent)?.id || yearRows[0]?.id || "");
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load results.");
      setLoading(false);
    });
  }, []);

  const yearExams = exams.filter((item) => item.academicYearId === yearId);
  const exam = yearExams.find((item) => item.term === term) ?? yearExams[0];

  useEffect(() => {
    if (!yearId) return;
    if (yearExams.some((item) => item.term === term)) return;
    setTerm(yearExams[0]?.term ?? "");
  }, [yearId, exams, term]);

  useEffect(() => {
    if (!exam) {
      setBoard(null);
      setReview([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      api<Board>(`/api/v1/exams/${exam.id}/submissions`),
      api<{ classes: ReviewClass[] }>(`/api/v1/exams/${exam.id}/review`),
    ]).then(([nextBoard, nextReview]) => {
      if (cancelled) return;
      setBoard(nextBoard);
      setReview(nextReview.classes);
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load submitted marks.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [exam?.id, tick]);

  useEffect(() => {
    if (!sectionName || subjectId) return;
    const row = (board?.rows ?? []).find((item) => item.section === sectionName && (!classId || item.classGroupId === classId));
    const first = review.find((item) => item.id === row?.classGroupId)?.subjects[0];
    if (first) setSubjectId(first.id);
  }, [sectionName, classId, board, review, subjectId]);

  const lines = (board?.rows ?? []).flatMap((row) => row.subjects.map((subject) => ({
    ...subject,
    classLabel: row.classLabel,
    section: row.section,
  })));
  const visible = lines.filter((row) => !status || row.status === status);
  const readyCount = review.flatMap((item) => item.subjects.flatMap((subject) => subject.rows)).filter((row) => row.state === "VERIFIED").length;
  const yearName = years.find((item) => item.id === yearId)?.name ?? board?.year ?? "";
  const sheetLine = open ? lines.find((row) => row.id === open.subjectId && row.section === open.section) : undefined;
  const sheetSubject = open
    ? review.flatMap((item) => item.subjects.map((subject) => ({ ...subject, classLabel: item.label }))).find((subject) => subject.id === open.subjectId)
    : undefined;
  const students = (sheetSubject?.rows ?? []).filter((row) => row.section === open?.section).sort((a, b) => a.rollNumber - b.rollNumber);
  const scored = students.filter((row) => !row.isAbsent && row.marks != null);
  const average = scored.length ? Math.round(scored.reduce((sum, row) => sum + (row.marks ?? 0), 0) / scored.length) : null;
  const highest = scored.length ? Math.max(...scored.map((row) => row.marks ?? 0)) : null;
  const lowest = scored.length ? Math.min(...scored.map((row) => row.marks ?? 0)) : null;
  const approvable = students.filter((row) => row.id && row.state === "SUBMITTED" && !row.issue);
  const returnable = students.filter((row) => row.id && row.state === "SUBMITTED");
  const marked = students.filter((row) => row.state === "SUBMITTED" || row.state === "VERIFIED" || row.state === "PUBLISHED" || row.state === "REJECTED").length;

  function day(value: string | null | undefined) {
    if (!value) return "—";
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
  }

  function markState(state: string) {
    if (state === "PUBLISHED") return "Published";
    if (state === "VERIFIED") return "Approved";
    if (state === "SUBMITTED") return "Pending Review";
    if (state === "REJECTED") return "Returned";
    return "Not entered";
  }

  async function approveSheet() {
    if (!approvable.length) return;
    setBusy(true);
    setError("");
    try {
      for (const row of approvable) {
        await api(`/api/v1/result-sheets/${row.id}/verify`, { method: "POST" });
      }
      const skipped = returnable.length - approvable.length;
      setNotice(`${approvable.length} mark${approvable.length === 1 ? "" : "s"} approved. They stay hidden until you publish.${skipped ? ` ${skipped} incomplete mark${skipped === 1 ? "" : "s"} still need a correction.` : ""}`);
      setOpen(null);
      setReturning(false);
      setTick((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not approve these marks.");
    } finally {
      setBusy(false);
    }
  }

  async function returnSheet() {
    if (reason.trim().length < 3) {
      setError("Write a reason so the teacher knows what to correct.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const row of returnable) {
        await api(`/api/v1/result-sheets/${row.id}/reject`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      }
      setNotice("Marks returned for correction. The teacher can edit and submit them again.");
      setReason("");
      setReturning(false);
      setOpen(null);
      setTick((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not return these marks.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPublish() {
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<PublishScope>(`/api/v1/exams/${exam.id}/publish-accepted`, { method: "POST" });
      setPreview(null);
      setNotice(result.published ? `Published ${result.studentResults} result${result.studentResults === 1 ? "" : "s"}. Parents and students can now see them.` : "There were no approved marks left to publish.");
      setTick((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish results.");
    } finally {
      setBusy(false);
    }
  }

  if (open && sheetLine && sheetSubject) {
    const maxMarks = sheetSubject.maxMarks;
    const passMark = sheetSubject.minMarks;
    return (
      <div className="space-y-5">
        <style>{`@media print { aside, header, .no-print { display: none !important; } }`}</style>
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={() => { setOpen(null); setReturning(false); }}>
            <ArrowLeft className="h-4 w-4" /> Results
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print result sheet
          </button>
        </div>
        {error ? <p className="no-print rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-sm font-semibold text-slate-950">Exam details</p>
            <p className="mt-1 text-sm text-slate-500">Maximum marks and the pass mark come from the exam. They cannot be changed on this sheet.</p>
          </div>
          <div className="grid gap-6 px-6 py-5 sm:grid-cols-3">
            <Fact label="Subject" value={sheetSubject.name} />
            <Fact label="Class" value={sheetLine.classLabel} />
            <Fact label="Section" value={sheetLine.section} />
            <Fact label="Academic year" value={yearName} />
            <Fact label="Term" value={termLabel(exam?.term ?? board?.term ?? "")} />
            <Fact label="Exam date" value={day(sheetSubject.examDay ?? exam?.startDate)} />
            <Fact label="Maximum marks" value={String(maxMarks)} />
            <Fact label="Pass mark" value={passMark > 0 ? String(passMark) : "Not set"} />
            <Fact label="Status" value={statusLabel(sheetLine.status)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm">
            <p className="text-slate-600">Teacher: <span className="font-medium text-slate-900">{sheetLine.teacher ?? sheetSubject.teacher ?? "Not assigned"}</span></p>
            <p className="text-slate-600">{marked} / {students.length} student{students.length === 1 ? "" : "s"} marked · {Math.max(students.length - marked, 0)} missing</p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
            <p>Average <span className="font-semibold text-slate-950">{average ?? "—"}</span></p>
            <p>Highest <span className="font-semibold text-slate-950">{highest ?? "—"}</span></p>
            <p>Lowest <span className="font-semibold text-slate-950">{lowest ?? "—"}</span></p>
          </div>
        </section>
        <section className="space-y-3">
          {students.map((row) => {
            const percent = row.isAbsent || row.marks == null || !maxMarks ? "—" : `${Math.round((row.marks / maxMarks) * 100)}%`;
            return (
              <article key={row.permanentId} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-600 text-sm font-semibold text-white">{initials(row.student)}</span>
                <div className="min-w-40 flex-1">
                  <p className="font-semibold text-slate-950">{row.student}</p>
                  <p className="text-xs text-slate-500">{row.permanentId}</p>
                  {row.issue ? <p className="mt-1 text-xs text-red-600">{row.issue}</p> : null}
                  {row.rejectReason ? <p className="mt-1 text-xs text-red-600">{row.rejectReason}</p> : null}
                </div>
                <div className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-900">{row.isAbsent ? "Absent" : row.marks ?? "—"}</div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={row.isAbsent} disabled className="h-4 w-4 rounded border-slate-300" /> Absent
                </label>
                <span className="w-14 text-sm font-medium text-slate-700">{percent}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.state === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : row.state === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : row.state === "SUBMITTED" ? "bg-blue-50 text-blue-700" : row.state === "REJECTED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{markState(row.state)}</span>
              </article>
            );
          })}
          {!students.length ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No students are enrolled in this section.</p> : null}
        </section>
        {returning ? (
          <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-slate-700">Reason for correction
              <textarea className={`${field} mt-1.5 min-h-24 w-full`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell the teacher what to correct" />
            </label>
          </div>
        ) : null}
        <div className="no-print flex flex-wrap justify-end gap-2">
          {returnable.length ? (
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => returning ? void returnSheet() : setReturning(true)} disabled={busy}>
              {returning ? "Send back" : "Return for correction"}
            </button>
          ) : null}
          {approvable.length ? (
            <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" onClick={() => void approveSheet()} disabled={busy}>
              {busy ? "Saving..." : "Approve results"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const classes = review.map((item) => ({ id: item.id, label: item.label }));
  const sections = [...new Set((board?.rows ?? []).filter((row) => !classId || row.classGroupId === classId).map((row) => row.section))];
  const subjectClass = review.find((item) => item.id === classId) ?? review.find((item) => item.subjects.some((subject) => subject.rows.some((row) => row.section === sectionName)));
  const sectionAssignment = subjectClass?.sections?.find((section) => section.name === sectionName);
  const subjectChoices = (subjectClass?.subjects ?? []).filter((subject) => !sectionAssignment?.subjectIds.length || !subject.subjectId || sectionAssignment.subjectIds.includes(subject.subjectId));
  const pickedSubject = subjectChoices.find((subject) => subject.id === subjectId) ?? review.flatMap((item) => item.subjects).find((subject) => subject.id === subjectId);
  const roster = (pickedSubject?.rows ?? []).filter((row) => !sectionName || row.section === sectionName).sort((a, b) => a.rollNumber - b.rollNumber);
  const submittedCount = roster.filter((row) => row.state === "SUBMITTED" || row.state === "VERIFIED" || row.state === "PUBLISHED").length;
  const needsReview = roster.filter((row) => row.state === "SUBMITTED").length;

  const sectionPeople = (() => {
    const people = new Map<string, { name: string; permanentId: string; roll: number }>();
    subjectChoices.forEach((subject) => subject.rows.filter((row) => row.section === sectionName).forEach((row) => {
      people.set(row.enrollmentId, { name: row.student, permanentId: row.permanentId, roll: row.rollNumber });
    }));
    return [...people.entries()].sort((a, b) => a[1].roll - b[1].roll);
  })();
  const approvedCells = subjectChoices.reduce((sum, subject) => sum + subject.rows.filter((row) => row.section === sectionName && (row.state === "VERIFIED" || row.state === "PUBLISHED") && row.marks != null).length, 0);
  const waitingCells = subjectChoices.reduce((sum, subject) => sum + subject.rows.filter((row) => row.section === sectionName && row.state === "SUBMITTED").length, 0);
  const cellTotal = sectionPeople.length * subjectChoices.length;

  function exportSection() {
    const header = ["Student", "ID", "Roll", ...subjectChoices.map((subject) => subject.name), "Total", "Average", "Status"];
    const lines = sectionPeople.map(([enrollmentId, person]) => {
      const score = sectionScore(subjectChoices, enrollmentId);
      const marks = score.cells.map((cell) => cell.absent ? "Absent" : cell.pending || cell.marks == null ? "Pending" : String(cell.marks));
      const average = score.average == null ? "—" : `${score.average}%`;
      const status = !score.final ? "Provisional" : score.average == null ? "—" : score.average >= 50 ? "Pass" : "Fail";
      return [person.name, person.permanentId, String(person.roll), ...marks, score.possible ? `${score.obtained} / ${score.possible}` : "—", average, status];
    });
    const csv = [header, ...lines].map((row) => row.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `section-${sectionName || "results"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function grade(marks: number | null, max: number, _min: number, absent: boolean) {
    if (absent || marks == null || !max) return { grade: "—", pass: null as boolean | null, percent: "—" };
    const percent = Math.round((marks / max) * 100);
    const letter = percent >= 90 ? "A" : percent >= 80 ? "B+" : percent >= 70 ? "B" : percent >= 60 ? "C" : percent >= 50 ? "D" : "E";
    return { grade: letter, pass: percent >= 50, percent: `${percent}%` };
  }

  async function saveAdminMarks() {
    if (!exam || !pickedSubject) return;
    const rows = roster.flatMap((row) => {
      const raw = drafts[row.enrollmentId];
      if (raw == null || raw === "") return [];
      const marks = Number(raw);
      if (!Number.isInteger(marks)) return [];
      return [{ enrollmentId: row.enrollmentId, marks, isAbsent: false, comment: "" }];
    });
    if (!rows.length) {
      setError("Enter a mark for at least one student.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ saved: number }>(`/api/v1/exams/${exam.id}/admin-marks`, { method: "POST", body: JSON.stringify({ examSubjectId: pickedSubject.id, rows }) });
      setNotice(`${result.saved} mark${result.saved === 1 ? "" : "s"} saved. Approve them, then publish once.`);
      setTick((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save marks.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSubject() {
    const rows = roster.filter((row) => row.id && row.state === "SUBMITTED" && !row.issue);
    if (!rows.length) return;
    setBusy(true);
    setError("");
    try {
      for (const row of rows) await api(`/api/v1/result-sheets/${row.id}/verify`, { method: "POST" });
      setNotice(`${rows.length} mark${rows.length === 1 ? "" : "s"} approved. Publish when the rest are ready.`);
      setTick((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not approve these marks.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="text-sm text-slate-600">Academic year
          <select className={`${field} mt-1.5 w-full`} value={yearId} onChange={(event) => { setYearId(event.target.value); setOpen(null); }}>
            {years.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " · current" : ""}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Term
          <select className={`${field} mt-1.5 w-full`} value={exam?.term ?? ""} onChange={(event) => setTerm(event.target.value)}>
            {yearExams.map((item) => <option key={item.id} value={item.term}>{termLabel(item.term)}</option>)}
            {!yearExams.length ? <option value="">No exam this year</option> : null}
          </select>
        </label>
        <label className="text-sm text-slate-600">Class / Form
          <select className={`${field} mt-1.5 w-full`} value={classId} onChange={(event) => { setClassId(event.target.value); setSectionName(""); setSubjectId(""); }}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Section
          <select className={`${field} mt-1.5 w-full`} value={sectionName} onChange={(event) => setSectionName(event.target.value)}>
            <option value="">Choose a section</option>
            {sections.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      {notice ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading results...</p> : null}
      {!exam && !loading ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">This year has no exam yet. Create it in Exams, then teachers can submit marks here.</p> : null}
      {exam && sectionName && view === "section" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600"><Users className="h-5 w-5" /></span>
              <div><p className="text-sm text-slate-500">Total Students</p><p className="text-2xl font-semibold text-slate-950">{sectionPeople.length}</p><p className="text-xs text-slate-400">in Section {sectionName}</p></div>
            </article>
            <article className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-emerald-600"><BookOpen className="h-5 w-5" /></span>
              <div><p className="text-sm text-emerald-700">Total Subjects</p><p className="text-2xl font-semibold text-slate-950">{subjectChoices.length}</p><p className="text-xs text-emerald-600">for this section</p></div>
            </article>
            <article className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-orange-500"><CheckCheck className="h-5 w-5" /></span>
              <div><p className="text-sm text-orange-700">Results Submitted</p><p className="text-2xl font-semibold text-slate-950">{approvedCells}</p><p className="text-xs text-orange-600">{cellTotal ? `${Math.round((approvedCells / cellTotal) * 1000) / 10}%` : "0%"}</p></div>
            </article>
            <article className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-rose-500"><Clock className="h-5 w-5" /></span>
              <div><p className="text-sm text-rose-600">Needs Review</p><p className="text-2xl font-semibold text-slate-950">{waitingCells}</p><p className="text-xs text-rose-500">{cellTotal ? `${Math.round((waitingCells / cellTotal) * 1000) / 10}%` : "0%"}</p></div>
            </article>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-950">{classes.find((item) => item.id === classId)?.label ?? "Class"} · Section {sectionName}</h2>
              <p className="text-xs text-slate-500">{yearName} · {termLabel(exam.term)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setView("review")}><BookOpen className="h-4 w-4" /> Review teacher marks</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setView("review")}><Pencil className="h-4 w-4" /> Edit Marks</button>
            </div>
          </div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-950">Class results · Section {sectionName}</h2>
                <p className="text-xs text-slate-500">Approved marks show here. A subject not entered, not submitted, or not approved says Incomplete.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={exportSection}><Download className="h-4 w-4" /> Export</button>
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
                <button type="button" disabled={!exam || busy || readyCount === 0} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 disabled:opacity-50" onClick={() => {
                  if (!exam) return;
                  setBusy(true);
                  api<PublishScope>(`/api/v1/exams/${exam.id}/publish-preview`).then(setPreview).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not prepare publication.")).finally(() => setBusy(false));
                }}><Send className="h-4 w-4" /> Publish all classes</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">Student</th>
                    {subjectChoices.map((subject) => <th key={subject.id} className="px-3 py-3">{subject.name}<span className="block font-normal normal-case text-slate-400">{subject.maxMarks}</span></th>)}
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Average</th>
                    <th className="px-3 py-3">Grade</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionPeople.map(([enrollmentId, person], index) => {
                    const score = sectionScore(subjectChoices, enrollmentId);
                    const letter = !score.final || score.average == null ? "—" : score.average >= 90 ? "A" : score.average >= 80 ? "B+" : score.average >= 70 ? "B" : score.average >= 60 ? "C" : score.average >= 50 ? "D" : "E";
                    return (
                      <tr key={enrollmentId} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                        <td className="px-3 py-3"><p className="font-semibold text-slate-900">{person.name}</p><p className="text-xs text-slate-500">{person.permanentId} · Roll {person.roll}</p></td>
                        {score.cells.map((cell) => (
                          <td key={cell.subject.id} className={`px-3 py-3 ${cell.pending ? "text-slate-400" : "font-medium"}`}>{cell.absent ? "Absent" : cell.pending || cell.marks == null ? "Pending" : cell.marks}</td>
                        ))}
                        <td className="px-3 py-3">{score.possible ? `${score.obtained} / ${score.possible}` : "—"}</td>
                        <td className="px-3 py-3 font-semibold">{score.average == null ? "—" : `${score.average}%`}</td>
                        <td className="px-3 py-3">{letter}</td>
                        <td className="px-3 py-3">{!score.final ? <span className="font-semibold text-amber-700">Provisional</span> : score.average == null ? <span className="text-slate-500">—</span> : score.average >= 50 ? <span className="font-semibold text-emerald-700">Pass</span> : <span className="font-semibold text-red-600">Fail</span>}</td>
                        <td className="px-3 py-3"><button type="button" className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600" onClick={() => setView("review")}><Pencil className="h-3.5 w-3.5" /> Edit Marks</button></td>
                      </tr>
                    );
                  })}
                  {!sectionPeople.length ? <tr><td className="px-4 py-8 text-slate-500" colSpan={6 + subjectChoices.length}>This section has no students.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
      {exam && sectionName ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Teacher submissions</h2>
            <p className="text-xs text-slate-500">Marks the teacher sent for this section. Open one subject to edit and approve it.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-3 py-3">Teacher</th>
                <th className="px-3 py-3">Completed</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lines.filter((row) => row.section === sectionName && (!classId || review.some((item) => item.id === classId && item.subjects.some((subject) => subject.id === row.id)))).map((row) => (
                <tr key={`${row.id}-${row.section}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-3 text-slate-700">{row.teacher ?? "Not assigned"}</td>
                  <td className="px-3 py-3">{row.submittedStudents} / {row.students}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                  <td className="px-3 py-3"><button type="button" className="font-semibold text-blue-700" onClick={() => { setSubjectId(row.id); setView("review"); setDrafts({}); }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {exam && sectionName && view === "review" && pickedSubject ? (
        <>
          <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setView("section")}>Back to class results</button>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm text-blue-700">Students</p><p className="mt-1 text-2xl font-semibold text-blue-950">{roster.length}</p></article>
            <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm text-emerald-700">Marks entered</p><p className="mt-1 text-2xl font-semibold text-emerald-950">{submittedCount}</p></article>
            <article className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-sm text-amber-700">Needs approval</p><p className="mt-1 text-2xl font-semibold text-amber-950">{needsReview}</p></article>
          </div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {subjectChoices.map((subject) => (
                  <button key={subject.id} type="button" className={`rounded-full px-3 py-1.5 text-sm font-semibold ${subject.id === subjectId ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => { setSubjectId(subject.id); setDrafts({}); }}>{subject.name}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void saveAdminMarks()}>Save marks</button>
                <button type="button" disabled={busy || needsReview === 0} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void approveSubject()}>Approve this subject</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Roll</th>
                    <th className="px-3 py-3">Max</th>
                    <th className="px-3 py-3">Marks</th>
                    <th className="px-3 py-3">%</th>
                    <th className="px-3 py-3">Grade</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row, index) => {
                    const raw = drafts[row.enrollmentId];
                    const shown = raw !== undefined && raw !== "" ? Number(raw) : row.marks;
                    const scored = grade(Number.isFinite(shown) ? shown : null, pickedSubject.maxMarks, pickedSubject.minMarks, row.isAbsent);
                    return (
                      <tr key={row.enrollmentId} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                        <td className="px-3 py-3"><p className="font-semibold text-slate-900">{row.student}</p><p className="text-xs text-slate-500">{row.permanentId}</p></td>
                        <td className="px-3 py-3">{row.rollNumber}</td>
                        <td className="px-3 py-3">{pickedSubject.maxMarks}</td>
                        <td className="px-3 py-3">
                          <input className={`${field} w-20`} type="number" min={0} max={pickedSubject.maxMarks} value={raw ?? (row.marks ?? "")} onChange={(event) => setDrafts((current) => ({ ...current, [row.enrollmentId]: event.target.value }))} />
                        </td>
                        <td className="px-3 py-3">{scored.percent}</td>
                        <td className="px-3 py-3">{scored.grade}</td>
                        <td className="px-3 py-3 text-slate-600">{row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.state === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : row.state === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : row.state === "SUBMITTED" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{markState(row.state)}{scored.pass === false ? " · Fail" : scored.pass ? " · Pass" : ""}</span></td>
                      </tr>
                    );
                  })}
                  {!roster.length ? <tr><td className="px-4 py-8 text-slate-500" colSpan={9}>This section has no students.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : exam && view === "review" && sectionName && !loading ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">Choose one submitted subject to edit and approve.</p> : exam && !sectionName && !loading ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">Choose a section to see every subject and the average.</p> : null}
      {readyCount > 0 ? <p className="text-sm text-slate-500">{readyCount} approved mark{readyCount === 1 ? "" : "s"} waiting to be published. Approving a mark does not show it to parents or students.</p> : null}
      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <h2 className="text-lg font-semibold text-slate-950">Publish approved results?</h2>
            <p className="mt-2 text-sm text-slate-600">This publishes every approved mark on this exam, for every class from Class 1 to Class 8 or Form 1 to Form 4 that is included. The record stays, so the same year can be opened later.</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><dt className="text-slate-500">Exam</dt><dd className="font-medium text-slate-950">{preview.exam}</dd></div>
              <div><dt className="text-slate-500">Academic year</dt><dd className="font-medium text-slate-950">{preview.year}</dd></div>
              <div><dt className="text-slate-500">Term</dt><dd className="font-medium text-slate-950">{preview.term}</dd></div>
              <div><dt className="text-slate-500">Classes</dt><dd className="font-medium text-slate-950">{preview.classes}</dd></div>
              <div><dt className="text-slate-500">Subjects</dt><dd className="font-medium text-slate-950">{preview.subjects}</dd></div>
              <div><dt className="text-slate-500">Student results</dt><dd className="font-medium text-slate-950">{preview.studentResults}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Still awaiting approval</dt><dd className="font-medium text-slate-950">{preview.awaiting}</dd></div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setPreview(null)}>Cancel</button>
              <button type="button" disabled={busy || preview.ready === 0} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void confirmPublish()}>{busy ? "Publishing..." : "Confirm and publish"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}
