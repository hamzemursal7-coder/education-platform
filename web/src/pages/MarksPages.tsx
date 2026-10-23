import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { provisionalTotal } from "../lib/examAverages";

type SchoolType = "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY";
type Placement = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; academicYearId: string; term: string; startDate?: string; endDate?: string; generalMax?: number; passMark?: number };
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
  comment?: string | null;
  isReExam?: boolean;
  originalMarks?: number | null;
  state: string;
  rejectReason: string | null;
  submittedAt: string | null;
  publishedAt?: string | null;
  issue: string | null;
};

type ReviewSubject = {
  id: string;
  subjectId?: string;
  name: string;
  maxMarks: number;
  minMarks: number;
  examDay: string | null;
  teacher: string | null;
  rows: ReviewStudent[];
};

type ReviewClass = {
  id: string;
  label: string;
  sections?: Array<{ name: string; subjectIds: string[] }>;
  subjects: ReviewSubject[];
};

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

const inputCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function termLabel(term: string) {
  return term === "TERM_2" ? "Term 2" : "Term 1";
}

function calculateGrade(percent: number | null) {
  if (percent === null) return { grade: "—", color: "text-slate-400 bg-slate-50 border-slate-200" };
  if (percent >= 90) return { grade: "A+", color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold" };
  if (percent >= 80) return { grade: "A", color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-semibold" };
  if (percent >= 70) return { grade: "B", color: "text-indigo-700 bg-indigo-50 border-indigo-200 font-semibold" };
  if (percent >= 60) return { grade: "C", color: "text-blue-700 bg-blue-50 border-blue-200 font-medium" };
  if (percent >= 50) return { grade: "D", color: "text-amber-700 bg-amber-50 border-amber-200 font-medium" };
  return { grade: "F", color: "text-rose-700 bg-rose-50 border-rose-200 font-bold" };
}

function sectionScore(subjects: ReviewSubject[], enrollmentId: string) {
  const cells = subjects.map((subject) => {
    const row = subject.rows.find((item) => item.enrollmentId === enrollmentId);
    const approved = Boolean(row && (row.state === "VERIFIED" || row.state === "PUBLISHED"));
    const absent = Boolean(row?.isAbsent);
    const isReExam = Boolean(row?.isReExam || row?.comment?.startsWith("RE_EXAM"));
    return {
      subject,
      row,
      approved,
      absent,
      isReExam,
      originalMarks: row?.originalMarks,
      pending: !approved && !absent && (row?.marks == null),
      maxMarks: subject.maxMarks,
      marks: !absent ? (row?.marks ?? null) : 0,
      counted: true,
    };
  });
  return { cells, ...provisionalTotal(cells) };
}

function statusBadge(status: BoardStatus) {
  switch (status) {
    case "APPROVED":
    case "PUBLISHED":
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> {status === "PUBLISHED" ? "Published" : "Approved"}</span>;
    case "AWAITING":
      return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200"><Clock className="h-3 w-3" /> Submitted</span>;
    case "IN_PROGRESS":
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"><Clock className="h-3 w-3" /> In Progress</span>;
    case "RETURNED":
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200"><AlertTriangle className="h-3 w-3" /> Returned</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200"><Clock className="h-3 w-3" /> Not Submitted</span>;
  }
}

export function ResultsBoardPage() {
  const [years, setYears] = useState<Placement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [yearId, setYearId] = useState("");
  const [term, setTerm] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [review, setReview] = useState<ReviewClass[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [activeTab, setActiveTab] = useState<"matrix" | "submissions" | "admin_entry">("matrix");

  const [preview, setPreview] = useState<PublishScope | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // Admin marks entry states
  const [drafts, setDrafts] = useState<Record<string, { marks: string; isAbsent: boolean }>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Re-Exam Modal state
  const [reExamTarget, setReExamTarget] = useState<{
    studentName: string;
    permanentId: string;
    enrollmentId: string;
    subjectId: string;
    subjectName: string;
    maxMarks: number;
    currentMarks: number | null;
    isAbsent: boolean;
  } | null>(null);
  const [reExamMarks, setReExamMarks] = useState<string>("");

  // Remove Subject Modal state
  const [subjectToDelete, setSubjectToDelete] = useState<{
    id: string;
    name: string;
    classLabel: string;
  } | null>(null);

  // Single sheet review
  const [openSubjectSheet, setOpenSubjectSheet] = useState<ReviewSubject | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingEnrollmentId, setRejectingEnrollmentId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Placement[]>("/api/v1/placement"),
      api<{ exams: Exam[] }>("/api/v1/exams"),
    ]).then(([yearRows, payload]) => {
      setYears(yearRows);
      setExams(payload.exams);
      setYearId((current) => current || yearRows.find((year) => year.isCurrent)?.id || yearRows[0]?.id || "");
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load exam data.");
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

  async function loadData(examId: string) {
    const [nextBoard, nextReview] = await Promise.all([
      api<Board>(`/api/v1/exams/${examId}/submissions`),
      api<{ classes: ReviewClass[] }>(`/api/v1/exams/${examId}/review`),
    ]);
    setBoard(nextBoard);
    setReview(nextReview.classes);
  }

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
    loadData(exam.id)
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load examination marks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exam?.id, tick]);

  const classes = review.map((item) => ({ id: item.id, label: item.label }));
  const sections = useMemo(() => {
    return [...new Set((board?.rows ?? []).filter((row) => !classId || row.classGroupId === classId).map((row) => row.section))];
  }, [board, classId]);

  useEffect(() => {
    if (!sectionName && sections.length > 0) {
      setSectionName(sections[0]);
    }
  }, [sections, sectionName]);

  const subjectClass = review.find((item) => item.id === classId) ?? review.find((item) => item.subjects.some((subject) => subject.rows.some((row) => row.section === sectionName)));
  const sectionAssignment = subjectClass?.sections?.find((section) => section.name === sectionName);
  const subjectChoices = (subjectClass?.subjects ?? []).filter((subject) => !sectionAssignment?.subjectIds.length || !subject.subjectId || sectionAssignment.subjectIds.includes(subject.subjectId));
  const pickedSubject = subjectChoices.find((subject) => subject.id === subjectId) ?? subjectChoices[0];

  useEffect(() => {
    if (!subjectId && subjectChoices.length > 0) {
      setSubjectId(subjectChoices[0].id);
    }
  }, [subjectChoices, subjectId]);

  const roster = useMemo(() => {
    return (pickedSubject?.rows ?? []).filter((row) => !sectionName || row.section === sectionName).sort((a, b) => a.rollNumber - b.rollNumber);
  }, [pickedSubject, sectionName]);

  const sectionPeople = useMemo(() => {
    const people = new Map<string, { name: string; permanentId: string; roll: number }>();
    subjectChoices.forEach((subject) => subject.rows.filter((row) => row.section === sectionName).forEach((row) => {
      people.set(row.enrollmentId, { name: row.student, permanentId: row.permanentId, roll: row.rollNumber });
    }));
    return [...people.entries()].sort((a, b) => a[1].roll - b[1].roll);
  }, [subjectChoices, sectionName]);

  const allReviewRows = review.flatMap((item) => item.subjects.flatMap((subject) => subject.rows));
  const readyCount = allReviewRows.filter((row) => row.state === "VERIFIED").length;
  const publishedCount = allReviewRows.filter((row) => row.state === "PUBLISHED").length;
  const pendingCount = allReviewRows.filter((row) => row.state === "SUBMITTED").length;
  const notEnteredCount = allReviewRows.filter((row) => row.state === "WAITING").length;

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return sectionPeople;
    const q = searchQuery.toLowerCase();
    return sectionPeople.filter(([, p]) => p.name.toLowerCase().includes(q) || p.permanentId.toLowerCase().includes(q) || String(p.roll).includes(q));
  }, [sectionPeople, searchQuery]);

  // Init drafts when switching subject in admin entry mode
  useEffect(() => {
    if (!roster.length) return;
    const next: Record<string, { marks: string; isAbsent: boolean }> = {};
    roster.forEach((r) => {
      next[r.enrollmentId] = {
        marks: r.marks != null ? String(r.marks) : "",
        isAbsent: Boolean(r.isAbsent),
      };
    });
    setDrafts(next);
  }, [pickedSubject?.id, sectionName]);

  // Action: Save marks entered by School Admin
  async function handleSaveAdminMarks(approveImmediately = false) {
    if (!exam || !pickedSubject) return;
    const rows: Array<{ enrollmentId: string; marks: number | null; isAbsent: boolean; comment: string }> = [];
    for (const row of roster) {
      const draft = drafts[row.enrollmentId];
      if (!draft) continue;
      if (draft.isAbsent) {
        rows.push({ enrollmentId: row.enrollmentId, marks: null, isAbsent: true, comment: "" });
        continue;
      }
      if (draft.marks === "" || draft.marks == null) continue;
      const num = Number(draft.marks);
      if (!Number.isFinite(num) || num < 0 || num > pickedSubject.maxMarks) continue;
      rows.push({ enrollmentId: row.enrollmentId, marks: Math.round(num), isAbsent: false, comment: "" });
    }

    if (!rows.length) {
      setError("Please enter valid marks or check Absent for at least one student.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await api<{ saved: number }>(`/api/v1/exams/${exam.id}/admin-marks`, {
        method: "POST",
        body: JSON.stringify({ examSubjectId: pickedSubject.id, rows }),
      });

      if (approveImmediately) {
        const freshReview = await api<{ classes: ReviewClass[] }>(`/api/v1/exams/${exam.id}/review`);
        const freshSubject = freshReview.classes.flatMap((c) => c.subjects).find((s) => s.id === pickedSubject.id);
        const submittable = freshSubject?.rows.filter((r) => r.section === sectionName && r.state === "SUBMITTED" && r.id) ?? [];
        for (const item of submittable) {
          if (item.id) await api(`/api/v1/result-sheets/${item.id}/verify`, { method: "POST" });
        }
        setNotice(`Successfully saved and approved ${result.saved} student marks for ${pickedSubject.name}.`);
      } else {
        setNotice(`Successfully saved ${result.saved} student marks for ${pickedSubject.name}.`);
      }

      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save marks.");
    } finally {
      setBusy(false);
    }
  }

  // Action: Submit Re-Exam Mark
  async function handleSubmitReExam() {
    if (!exam || !reExamTarget) return;
    const score = Number(reExamMarks);
    if (!Number.isFinite(score) || score < 0 || score > reExamTarget.maxMarks) {
      setError(`Re-exam score must be between 0 and ${reExamTarget.maxMarks}.`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/exams/${exam.id}/re-exam`, {
        method: "POST",
        body: JSON.stringify({
          examSubjectId: reExamTarget.subjectId,
          enrollmentId: reExamTarget.enrollmentId,
          marks: Math.round(score),
        }),
      });
      setNotice(`Re-exam mark of ${score}/${reExamTarget.maxMarks} saved for ${reExamTarget.studentName}. Overall average updated!`);
      setReExamTarget(null);
      setReExamMarks("");
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save re-exam.");
    } finally {
      setBusy(false);
    }
  }

  // Action: Remove Subject from Exam
  async function handleRemoveSubject() {
    if (!exam || !subjectToDelete) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/exams/${exam.id}/subjects/${subjectToDelete.id}`, { method: "DELETE" });
      setNotice(`Subject "${subjectToDelete.name}" removed from exam. Student totals and averages recalculated.`);
      setSubjectToDelete(null);
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to remove subject from exam.");
    } finally {
      setBusy(false);
    }
  }

  // Action: Approve All in Subject
  async function handleApproveEntireSubject(subjId: string) {
    const target = review.flatMap((c) => c.subjects).find((s) => s.id === subjId);
    const submittable = target?.rows.filter((r) => r.section === sectionName && r.state === "SUBMITTED" && r.id && !r.issue) ?? [];
    if (!submittable.length) return;

    setBusy(true);
    setError("");
    try {
      for (const row of submittable) {
        if (row.id) await api(`/api/v1/result-sheets/${row.id}/verify`, { method: "POST" });
      }
      setNotice(`Approved ${submittable.length} marks for ${target?.name ?? "Subject"}.`);
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to approve subject marks.");
    } finally {
      setBusy(false);
    }
  }

  // Action: Confirm Publish
  async function handleConfirmPublish() {
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<PublishScope>(`/api/v1/exams/${exam.id}/publish-accepted`, { method: "POST" });
      setPreview(null);
      setNotice(result.published ? `Published ${result.studentResults} result records! Parents and students can now view them on their portals.` : "All approved marks are already published.");
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish results.");
    } finally {
      setBusy(false);
    }
  }

  // Export Section Results CSV
  function exportSectionCSV() {
    const header = ["Roll", "Student Name", "Student ID", ...subjectChoices.map((s) => `${s.name} (${s.maxMarks})`), "Total Obtained", "Max Possible", "Percentage", "Grade", "Status"];
    const lines = sectionPeople.map(([, person]) => {
      const score = sectionScore(subjectChoices, person.permanentId);
      const subjectCols = score.cells.map((cell) => {
        if (cell.absent) return "ABSENT (0)";
        if (cell.isReExam) return `${cell.marks ?? 0} [RE-EXAM]`;
        if (cell.pending || cell.marks == null) return "Pending";
        return String(cell.marks);
      });
      const avg = score.average != null ? `${score.average}%` : "—";
      const { grade } = calculateGrade(score.average);
      const passFail = !score.final ? "Provisional" : (score.average != null && score.average >= 50 ? "PASS" : "FAIL");
      return [String(person.roll), person.name, person.permanentId, ...subjectCols, String(score.obtained), String(score.possible), avg, grade, passFail];
    });

    const csvContent = [header, ...lines].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Results-${subjectClass?.label ?? "Class"}-Sec_${sectionName}-${exam?.term ?? "Term"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* EXECUTIVE HEADER & PUBLISH HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl lg:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> School Admin Results Hub
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-md">
                {years.find((y) => y.id === yearId)?.name ?? "Academic Year"} · {exam ? termLabel(exam.term) : "No Exam"}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
              Examination Results & Marks Board
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 leading-relaxed">
              Monitor teacher submissions, fill marks directly as Admin, manage student re-exams with instant average recalculation, remove obsolete subjects, and publish verified school results.
            </p>
          </div>

          {/* PROMINENT PUBLISH BUTTON CTA */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <button
              type="button"
              disabled={!exam || busy || readyCount === 0}
              onClick={() => {
                if (!exam) return;
                setBusy(true);
                api<PublishScope>(`/api/v1/exams/${exam.id}/publish-preview`)
                  .then(setPreview)
                  .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not fetch publish scope."))
                  .finally(() => setBusy(false));
              }}
              className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl px-6 py-4 text-base font-bold text-white shadow-2xl transition-all duration-300 ${
                readyCount > 0
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
              }`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white shadow-inner">
                <Send className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div className="text-left">
                <span className="block text-xs uppercase tracking-wider text-emerald-100 font-semibold">Ready To Publish</span>
                <span className="text-lg font-black tracking-wide">Publish Approved Results</span>
              </div>
              {readyCount > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-800 shadow-sm animate-pulse">
                  {readyCount} ready
                </span>
              )}
            </button>
            <p className="text-xs text-slate-400">
              {publishedCount} marks published · {readyCount} awaiting publish · {pendingCount} awaiting approval
            </p>
          </div>
        </div>

        {/* METRIC PILLS */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4 border-t border-white/10 pt-6">
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <p className="text-xs font-medium text-slate-400">Total Enrolled</p>
            <p className="text-2xl font-bold text-white mt-0.5">{sectionPeople.length} <span className="text-xs font-normal text-slate-400">students in sec</span></p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <p className="text-xs font-medium text-slate-400">Subjects on Exam</p>
            <p className="text-2xl font-bold text-indigo-300 mt-0.5">{subjectChoices.length} <span className="text-xs font-normal text-slate-400">subjects</span></p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <p className="text-xs font-medium text-emerald-400">Approved Marks</p>
            <p className="text-2xl font-bold text-emerald-300 mt-0.5">{readyCount + publishedCount} <span className="text-xs font-normal text-slate-400">marks</span></p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <p className="text-xs font-medium text-amber-400">Needs Review / Entry</p>
            <p className="text-2xl font-bold text-amber-300 mt-0.5">{pendingCount + notEnteredCount} <span className="text-xs font-normal text-slate-400">pending</span></p>
          </div>
        </div>
      </section>

      {/* FEEDBACK BANNERS */}
      {notice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold">{notice}</p>
          </div>
          <button type="button" onClick={() => setNotice("")} className="text-emerald-700 hover:text-emerald-950 p-1"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
          <button type="button" onClick={() => setError("")} className="text-rose-700 hover:text-rose-950 p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* FILTER CONTROLS BAR */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Academic Year
          <select className={`${inputCls} mt-1.5 w-full font-medium`} value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((item) => (
              <option key={item.id} value={item.id}>{item.name} {item.isCurrent ? "★ Active" : ""}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Exam Term
          <select className={`${inputCls} mt-1.5 w-full font-medium`} value={exam?.term ?? ""} onChange={(e) => setTerm(e.target.value)}>
            {yearExams.map((item) => (
              <option key={item.id} value={item.term}>{termLabel(item.term)}</option>
            ))}
            {!yearExams.length && <option value="">No exam created yet</option>}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Class / Form
          <select className={`${inputCls} mt-1.5 w-full font-medium`} value={classId} onChange={(e) => { setClassId(e.target.value); setSectionName(""); setSubjectId(""); }}>
            <option value="">All Classes</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Section
          <select className={`${inputCls} mt-1.5 w-full font-medium`} value={sectionName} onChange={(e) => setSectionName(e.target.value)}>
            <option value="">Select section</option>
            {sections.map((name) => (
              <option key={name} value={name}>Section {name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === "matrix"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="h-4 w-4" /> Full Class Results Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("submissions")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === "submissions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Submissions & Subject Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin_entry")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === "admin_entry"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Pencil className="h-4 w-4" /> Direct Admin Marks Entry
          </button>
        </div>

        {activeTab === "matrix" && sectionPeople.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportSectionCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> Print Sheet
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-600">Loading student marks and statistics...</p>
          </div>
        </div>
      ) : !exam ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-800">No Exam Created for Selected Term</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Please configure the exam in the Exams management tab first, select the subjects, and then teachers and admins can enter marks.
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: FULL RESULTS MATRIX */}
          {activeTab === "matrix" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {subjectClass?.label ?? "Class"} · Section {sectionName || "All"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Calculated with the school policy: Absent marks count as 0 against the student's average. Re-exams immediately restore their score.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student or roll..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 w-12">#</th>
                        <th className="px-4 py-3.5 min-w-[200px]">Student Details</th>
                        {subjectChoices.map((s) => (
                          <th key={s.id} className="px-3 py-3.5 text-center min-w-[110px]">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-900 truncate max-w-[120px]">{s.name}</span>
                              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">Max {s.maxMarks}</span>
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3.5 text-center font-bold text-slate-800">Total Marks</th>
                        <th className="px-3 py-3.5 text-center font-bold text-slate-800">Average %</th>
                        <th className="px-3 py-3.5 text-center font-bold text-slate-800">Grade</th>
                        <th className="px-3 py-3.5 text-center font-bold text-slate-800">Status</th>
                        <th className="px-4 py-3.5 text-right font-bold text-slate-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPeople.map(([enrollmentId, person], idx) => {
                        const score = sectionScore(subjectChoices, enrollmentId);
                        const { grade, color: gradeColor } = calculateGrade(score.average);
                        const isPassing = score.average != null && score.average >= 50;
                        const hasAbsent = score.cells.some((c) => c.absent);
                        const hasFailingSubject = score.cells.some((c) => c.marks != null && c.marks < (c.subject.minMarks || c.maxMarks * 0.5));

                        return (
                          <tr key={enrollmentId} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-400">{person.roll || idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm">
                                  {person.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{person.name}</p>
                                  <p className="text-[11px] font-mono text-slate-500">ID: {person.permanentId}</p>
                                </div>
                              </div>
                            </td>

                            {/* SUBJECT COLUMNS */}
                            {score.cells.map((cell) => {
                              const isSubAbsent = cell.absent;
                              const isReExam = cell.isReExam;
                              const isPassSub = cell.marks != null && cell.marks >= (cell.subject.minMarks || cell.maxMarks * 0.5);

                              return (
                                <td key={cell.subject.id} className="px-3 py-3 text-center">
                                  {isSubAbsent ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-0.5 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                        ABS (0)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReExamTarget({
                                            studentName: person.name,
                                            permanentId: person.permanentId,
                                            enrollmentId,
                                            subjectId: cell.subject.id,
                                            subjectName: cell.subject.name,
                                            maxMarks: cell.maxMarks,
                                            currentMarks: null,
                                            isAbsent: true,
                                          });
                                          setReExamMarks("");
                                        }}
                                        className="mt-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                      >
                                        Take Re-Exam
                                      </button>
                                    </div>
                                  ) : isReExam ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200 shadow-sm">
                                        <Sparkles className="h-3 w-3 text-purple-600" /> {cell.marks}
                                      </span>
                                      <span className="text-[9px] font-semibold text-purple-500 mt-0.5">
                                        Re-Exam {cell.originalMarks != null ? `(prev: ${cell.originalMarks})` : "(was absent)"}
                                      </span>
                                    </div>
                                  ) : cell.marks != null ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className={`text-sm font-bold ${isPassSub ? "text-slate-900" : "text-rose-600"}`}>
                                        {cell.marks}
                                      </span>
                                      {!isPassSub && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReExamTarget({
                                              studentName: person.name,
                                              permanentId: person.permanentId,
                                              enrollmentId,
                                              subjectId: cell.subject.id,
                                              subjectName: cell.subject.name,
                                              maxMarks: cell.maxMarks,
                                              currentMarks: cell.marks,
                                              isAbsent: false,
                                            });
                                            setReExamMarks(String(cell.marks));
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                                        >
                                          Re-Exam
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs italic text-slate-400">Pending</span>
                                  )}
                                </td>
                              );
                            })}

                            {/* TOTAL */}
                            <td className="px-3 py-3 text-center">
                              <span className="font-bold text-slate-900">
                                {score.possible > 0 ? `${score.obtained} / ${score.possible}` : "—"}
                              </span>
                            </td>

                            {/* AVERAGE */}
                            <td className="px-3 py-3 text-center">
                              {score.average != null ? (
                                <span className={`text-sm font-extrabold ${score.average >= 50 ? "text-slate-900" : "text-rose-600"}`}>
                                  {score.average.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* GRADE */}
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold border ${gradeColor}`}>
                                {grade}
                              </span>
                            </td>

                            {/* STATUS */}
                            <td className="px-3 py-3 text-center">
                              {!score.final ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                  Provisional
                                </span>
                              ) : isPassing ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                  <Check className="h-3 w-3" /> Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                  Failed
                                </span>
                              )}
                            </td>

                            {/* ACTIONS */}
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {(hasAbsent || hasFailingSubject) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // pick first absent or failing subject
                                      const badCell = score.cells.find((c) => c.absent || (c.marks != null && c.marks < 50)) ?? score.cells[0];
                                      setReExamTarget({
                                        studentName: person.name,
                                        permanentId: person.permanentId,
                                        enrollmentId,
                                        subjectId: badCell.subject.id,
                                        subjectName: badCell.subject.name,
                                        maxMarks: badCell.maxMarks,
                                        currentMarks: badCell.marks,
                                        isAbsent: badCell.absent,
                                      });
                                      setReExamMarks(badCell.marks != null ? String(badCell.marks) : "");
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" /> Re-Exam
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {!filteredPeople.length && (
                        <tr>
                          <td colSpan={7 + subjectChoices.length} className="px-4 py-12 text-center text-slate-500">
                            No students match your criteria in this section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLASS & SUBJECT SUBMISSIONS DASHBOARD */}
          {activeTab === "submissions" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Class & Section Submission Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect which subjects teachers have submitted. As an Admin, you can directly enter missing marks, approve submitted sheets, or remove subjects entirely from the exam.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {subjectChoices.map((subj) => {
                  const subjectRows = subj.rows.filter((r) => !sectionName || r.section === sectionName);
                  const totalCount = subjectRows.length;
                  const enteredCount = subjectRows.filter((r) => r.marks != null || r.isAbsent).length;
                  const approvedCount = subjectRows.filter((r) => r.state === "VERIFIED" || r.state === "PUBLISHED").length;
                  const absentCount = subjectRows.filter((r) => r.isAbsent).length;
                  const reExamCount = subjectRows.filter((r) => r.isReExam || r.comment?.startsWith("RE_EXAM")).length;
                  const isFullySubmitted = totalCount > 0 && enteredCount === totalCount;
                  const isFullyApproved = totalCount > 0 && approvedCount === totalCount;

                  return (
                    <article key={subj.id} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                              <BookOpen className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900">{subj.name}</h3>
                              <p className="text-xs text-slate-500">
                                Assigned Teacher: <span className="font-semibold text-slate-700">{subj.teacher ?? "Not Assigned"}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* STATUS BADGE */}
                        <div>
                          {isFullyApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                            </span>
                          ) : isFullySubmitted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
                              <Clock className="h-3.5 w-3.5" /> Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                              <Clock className="h-3.5 w-3.5" /> Pending ({totalCount - enteredCount} left)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* STATS PROGRESS */}
                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>Progress: {enteredCount} / {totalCount} Students</span>
                          <span>{totalCount > 0 ? Math.round((enteredCount / totalCount) * 100) : 0}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-500 ${isFullyApproved ? "bg-emerald-500" : isFullySubmitted ? "bg-indigo-600" : "bg-amber-500"}`}
                            style={{ width: `${totalCount > 0 ? (enteredCount / totalCount) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 pt-1">
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 border border-slate-200">Max: <strong>{subj.maxMarks}</strong></span>
                          {absentCount > 0 && (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 border border-rose-200">
                              <strong>{absentCount}</strong> Absent
                            </span>
                          )}
                          {reExamCount > 0 && (
                            <span className="rounded-md bg-purple-50 px-2 py-0.5 text-purple-700 border border-purple-200">
                              <strong>{reExamCount}</strong> Re-Exams
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSubjectId(subj.id);
                              setActiveTab("admin_entry");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Fill as Admin
                          </button>
                          {enteredCount > approvedCount && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleApproveEntireSubject(subj.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve Sheet
                            </button>
                          )}
                        </div>

                        {/* REMOVE SUBJECT FROM EXAM BUTTON */}
                        <button
                          type="button"
                          onClick={() => setSubjectToDelete({ id: subj.id, name: subj.name, classLabel: subjectClass?.label ?? "Class" })}
                          title="Remove this subject from the exam and clear marks"
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove Subject
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT ADMIN MARKS ENTRY */}
          {activeTab === "admin_entry" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                      <Pencil className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Direct Marks Entry: {pickedSubject?.name ?? "Subject"}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter or modify marks directly as School Admin. Check "Absent" to mark 0 (this will count in the denominator towards student's average).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveAdminMarks(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Save className="h-4 w-4" /> Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveAdminMarks(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                  >
                    <CheckCheck className="h-4 w-4" /> Save & Approve Now
                  </button>
                </div>
              </div>

              {/* SUBJECT SELECTOR PILLS */}
              <div className="flex flex-wrap gap-2">
                {subjectChoices.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectId(s.id)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      s.id === pickedSubject?.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {s.name} <span className="text-[10px] opacity-75 font-normal">({s.maxMarks})</span>
                  </button>
                ))}
              </div>

              {/* ENTRY TABLE */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 w-12">#</th>
                        <th className="px-4 py-3 min-w-[220px]">Student Details</th>
                        <th className="px-4 py-3 text-center">Max Marks</th>
                        <th className="px-4 py-3 text-center min-w-[140px]">Enter Marks</th>
                        <th className="px-4 py-3 text-center">Absent?</th>
                        <th className="px-4 py-3 text-center">Percentage</th>
                        <th className="px-4 py-3 text-center">Calculated Grade</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roster.map((row, idx) => {
                        const currentDraft = drafts[row.enrollmentId] ?? { marks: "", isAbsent: false };
                        const num = Number(currentDraft.marks);
                        const hasScore = !currentDraft.isAbsent && currentDraft.marks !== "" && Number.isFinite(num);
                        const pct = hasScore && pickedSubject ? Math.round((num / pickedSubject.maxMarks) * 100) : null;
                        const { grade, color: gradeColor } = calculateGrade(pct);

                        return (
                          <tr key={row.enrollmentId} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-xs font-bold text-slate-400">{row.rollNumber || idx + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{row.student}</p>
                              <p className="text-xs font-mono text-slate-500">{row.permanentId}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {pickedSubject?.maxMarks ?? 100}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={pickedSubject?.maxMarks ?? 100}
                                disabled={currentDraft.isAbsent}
                                placeholder={currentDraft.isAbsent ? "ABS" : "0"}
                                value={currentDraft.isAbsent ? "" : currentDraft.marks}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.enrollmentId]: { ...prev[row.enrollmentId], marks: val, isAbsent: false },
                                  }));
                                }}
                                className={`w-28 text-center font-extrabold text-base ${inputCls} ${
                                  currentDraft.isAbsent ? "bg-slate-100 cursor-not-allowed text-slate-400" : ""
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={currentDraft.isAbsent}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [row.enrollmentId]: { marks: checked ? "" : prev[row.enrollmentId]?.marks ?? "", isAbsent: checked },
                                    }));
                                  }}
                                  className="h-4 w-4 rounded accent-rose-600"
                                />
                                <span className={currentDraft.isAbsent ? "text-rose-700 font-bold" : ""}>Absent</span>
                              </label>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {currentDraft.isAbsent ? (
                                <span className="text-xs text-rose-600 font-bold">0% (Absent)</span>
                              ) : pct != null ? (
                                `${pct}%`
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold border ${gradeColor}`}>
                                {grade}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                row.state === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                row.state === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                row.state === "SUBMITTED" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {row.state === "PUBLISHED" ? "Published" : row.state === "VERIFIED" ? "Approved" : row.state === "SUBMITTED" ? "Submitted" : "Not Entered"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* RE-EXAM MODAL */}
      {reExamTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-700 border border-purple-100">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Record Re-Exam Mark</h3>
                  <p className="text-xs text-slate-500">Makeup / improvement exam entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReExamTarget(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-bold text-slate-900">{reExamTarget.studentName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Student ID:</span>
                  <span className="font-mono text-slate-700">{reExamTarget.permanentId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-bold text-slate-900">{reExamTarget.subjectName} (Max: {reExamTarget.maxMarks})</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Previous Record:</span>
                  <span className={`font-bold ${reExamTarget.isAbsent ? "text-rose-600" : "text-amber-600"}`}>
                    {reExamTarget.isAbsent ? "Marked ABSENT (0 Marks)" : `${reExamTarget.currentMarks} Marks (Failed)`}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  New Re-Exam Marks Obtained
                  <div className="relative mt-1.5">
                    <input
                      type="number"
                      autoFocus
                      min={0}
                      max={reExamTarget.maxMarks}
                      placeholder={`0 - ${reExamTarget.maxMarks}`}
                      value={reExamMarks}
                      onChange={(e) => setReExamMarks(e.target.value)}
                      className={`w-full text-lg font-bold ${inputCls}`}
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                      / {reExamTarget.maxMarks}
                    </span>
                  </div>
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Submitting a re-exam mark replaces the previous absent/failed mark, sets it as approved, and recalculates the student's total and average immediately.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReExamTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || reExamMarks === ""}
                onClick={() => void handleSubmitReExam()}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-500 shadow-md shadow-purple-600/20 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Save Re-Exam Mark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE SUBJECT CONFIRMATION MODAL */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 border border-rose-200">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Remove Subject from Exam?</h3>
                <p className="text-xs text-rose-600 font-semibold">Admin Authority Removal Action</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                Are you sure you want to remove <strong className="text-slate-900">{subjectToDelete.name}</strong> from this examination in <strong className="text-slate-900">{subjectToDelete.classLabel}</strong>?
              </p>
              <div className="rounded-2xl bg-rose-50/80 p-4 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                <strong>Warning:</strong> All entered and published marks for this subject will be cleared from this exam. The students' totals, averages, and ranks will be immediately recalculated without this subject.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemoveSubject()}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Yes, Remove Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Send className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xl">Publish Examination Results</h3>
                <p className="text-xs text-slate-500">Make approved marks visible to students & parents</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                This action publishes every approved mark across all classes in this exam. Parents and students will be able to view their marks, totals, percentages, and report cards.
              </p>

              <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-xs">
                <div>
                  <dt className="text-slate-500">Academic Year</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{preview.year}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Exam Term</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{preview.term}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Total Classes</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{preview.classes}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Total Subjects</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{preview.subjects}</dd>
                </div>
                <div className="col-span-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                  <dt className="text-emerald-700 font-bold">Marks Ready to Publish Now:</dt>
                  <dd className="text-base font-extrabold text-emerald-700">{preview.ready} marks</dd>
                </div>
                {preview.awaiting > 0 && (
                  <div className="col-span-2 text-amber-700">
                    * {preview.awaiting} marks are still awaiting approval and will stay hidden.
                  </div>
                )}
              </dl>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || preview.ready === 0}
                onClick={() => void handleConfirmPublish()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-bold text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarksSubmissionPage() {
  return <ResultsBoardPage />;
}
