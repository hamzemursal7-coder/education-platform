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
  EyeOff,
  FileText,
  Filter,
  Flame,
  GraduationCap,
  HelpCircle,
  Lock,
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
  Unlock,
  User,
  UserCheck,
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

export function ResultsBoardPage() {
  const [years, setYears] = useState<Placement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [yearId, setYearId] = useState("");
  const [term, setTerm] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [review, setReview] = useState<ReviewClass[]>([]);

  // Filtering states - strictly separating classes & sections
  const [classId, setClassId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [activeTab, setActiveTab] = useState<"subjects_table" | "results_matrix">("subjects_table");

  // Detailed single subject inspection & marks editing
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { marks: string; isAbsent: boolean }>>({});

  // Modals & triggers
  const [preview, setPreview] = useState<PublishScope | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // Search in matrix
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

  // Load initial placements & exams
  useEffect(() => {
    Promise.all([
      api<Placement[]>("/api/v1/placement"),
      api<{ exams: Exam[] }>("/api/v1/exams"),
    ]).then(([yearRows, payload]) => {
      setYears(yearRows);
      setExams(payload.exams);
      setYearId((current) => current || yearRows.find((year) => year.isCurrent)?.id || yearRows[0]?.id || "");
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load examination data.");
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load marks data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exam?.id, tick]);

  // Derived Classes for the selected exam
  const classes = review.map((item) => ({ id: item.id, label: item.label }));

  // Set default class if not set
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  // Available sections for the currently selected class ONLY (never mixed up)
  const sections = useMemo(() => {
    if (!classId) return [];
    return [...new Set((board?.rows ?? []).filter((row) => row.classGroupId === classId).map((row) => row.section))];
  }, [board, classId]);

  // Automatically select first section if not selected or invalid for this class
  useEffect(() => {
    if (sections.length > 0 && (!sectionName || !sections.includes(sectionName))) {
      setSectionName(sections[0]);
    }
  }, [sections, sectionName]);

  // Currently selected class group and its specific subjects
  const currentClass = review.find((item) => item.id === classId);
  const sectionAssignment = currentClass?.sections?.find((s) => s.name === sectionName);
  const sectionSubjects = (currentClass?.subjects ?? []).filter((subject) => {
    if (!sectionAssignment?.subjectIds?.length || !subject.subjectId) return true;
    return sectionAssignment.subjectIds.includes(subject.subjectId);
  });

  // Students enrolled in this specific class & section
  const sectionPeople = useMemo(() => {
    const people = new Map<string, { name: string; permanentId: string; roll: number }>();
    sectionSubjects.forEach((subject) => {
      subject.rows.filter((row) => row.section === sectionName).forEach((row) => {
        people.set(row.enrollmentId, { name: row.student, permanentId: row.permanentId, roll: row.rollNumber });
      });
    });
    return [...people.entries()].sort((a, b) => a[1].roll - b[1].roll);
  }, [sectionSubjects, sectionName]);

  // Global counts across the entire exam
  const allReviewRows = review.flatMap((item) => item.subjects.flatMap((subject) => subject.rows));
  const readyCount = allReviewRows.filter((row) => row.state === "VERIFIED").length;
  const publishedCount = allReviewRows.filter((row) => row.state === "PUBLISHED").length;
  const pendingCount = allReviewRows.filter((row) => row.state === "SUBMITTED").length;
  const waitingCount = allReviewRows.filter((row) => row.state === "WAITING").length;

  // Selected subject for detailed marksheet
  const activeSubject = sectionSubjects.find((s) => s.id === selectedSubjectId) ?? null;
  const activeSubjectRoster = useMemo(() => {
    if (!activeSubject) return [];
    return activeSubject.rows.filter((row) => row.section === sectionName).sort((a, b) => a.rollNumber - b.rollNumber);
  }, [activeSubject, sectionName]);

  // Initialize drafts when editing active subject
  useEffect(() => {
    if (!activeSubjectRoster.length) return;
    const next: Record<string, { marks: string; isAbsent: boolean }> = {};
    activeSubjectRoster.forEach((r) => {
      next[r.enrollmentId] = {
        marks: r.marks != null ? String(r.marks) : "",
        isAbsent: Boolean(r.isAbsent),
      };
    });
    setDrafts(next);
  }, [selectedSubjectId, isEditingMarks, activeSubjectRoster]);

  // Action: Save marks entered/modified by Admin
  async function handleSaveMarks(approveImmediately = false) {
    if (!exam || !activeSubject) return;
    const rows: Array<{ enrollmentId: string; marks: number | null; isAbsent: boolean; comment: string }> = [];
    for (const row of activeSubjectRoster) {
      const draft = drafts[row.enrollmentId];
      if (!draft) continue;
      if (draft.isAbsent) {
        rows.push({ enrollmentId: row.enrollmentId, marks: null, isAbsent: true, comment: "" });
        continue;
      }
      if (draft.marks === "" || draft.marks == null) continue;
      const num = Number(draft.marks);
      if (!Number.isFinite(num) || num < 0 || num > activeSubject.maxMarks) continue;
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
        body: JSON.stringify({ examSubjectId: activeSubject.id, rows }),
      });

      if (approveImmediately) {
        const freshReview = await api<{ classes: ReviewClass[] }>(`/api/v1/exams/${exam.id}/review`);
        const freshSubject = freshReview.classes.flatMap((c) => c.subjects).find((s) => s.id === activeSubject.id);
        const submittable = freshSubject?.rows.filter((r) => r.section === sectionName && r.state === "SUBMITTED" && r.id) ?? [];
        for (const item of submittable) {
          if (item.id) await api(`/api/v1/result-sheets/${item.id}/verify`, { method: "POST" });
        }
        setNotice(`Marks saved and APPROVED. (Note: These stay private and hidden from students & parents until you click 'Publish Results').`);
      } else {
        setNotice(`Saved ${result.saved} student marks for ${activeSubject.name}.`);
      }

      setIsEditingMarks(false);
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save marks.");
    } finally {
      setBusy(false);
    }
  }

  // Action: Approve Entire Subject
  async function handleApproveSubject(subjId: string) {
    const target = currentClass?.subjects.find((s) => s.id === subjId);
    const submittable = target?.rows.filter((r) => r.section === sectionName && r.state === "SUBMITTED" && r.id && !r.issue) ?? [];
    if (!submittable.length) {
      setError("No submitted marks are awaiting approval for this subject.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      for (const row of submittable) {
        if (row.id) await api(`/api/v1/result-sheets/${row.id}/verify`, { method: "POST" });
      }
      setNotice(`Approved ${submittable.length} marks for ${target?.name}. They are now ready for publication!`);
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to approve subject marks.");
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
      setNotice(`Re-exam mark of ${score}/${reExamTarget.maxMarks} saved for ${reExamTarget.studentName}. Recalculated total and average!`);
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
      setNotice(`Subject "${subjectToDelete.name}" removed from exam. Student marks deleted and averages recalculated.`);
      setSubjectToDelete(null);
      if (selectedSubjectId === subjectToDelete.id) {
        setSelectedSubjectId(null);
      }
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to remove subject from exam.");
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
      setNotice(result.published ? `Successfully published ${result.studentResults} result records! Parents and students can now view them on their portals.` : "All approved marks are already published.");
      setTick((t) => t + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish results.");
    } finally {
      setBusy(false);
    }
  }

  // Filter students in Results Matrix
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return sectionPeople;
    const q = searchQuery.toLowerCase();
    return sectionPeople.filter(([, p]) => p.name.toLowerCase().includes(q) || p.permanentId.toLowerCase().includes(q) || String(p.roll).includes(q));
  }, [sectionPeople, searchQuery]);

  // Export Section CSV
  function exportSectionCSV() {
    const header = ["Roll", "Student Name", "Student ID", ...sectionSubjects.map((s) => `${s.name} (${s.maxMarks})`), "Total Obtained", "Max Possible", "Percentage", "Grade", "Status"];
    const lines = sectionPeople.map(([, person]) => {
      const score = sectionScore(sectionSubjects, person.permanentId);
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
    link.download = `Results-${currentClass?.label ?? "Class"}-Sec_${sectionName}-${exam?.term ?? "Term"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-16">
      {/* 1. TOP EXECUTIVE HEADER WITH PROMINENT VIBRANT PUBLISH BUTTON */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Exam Results Management
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {years.find((y) => y.id === yearId)?.name ?? "Academic Year"} · {exam ? termLabel(exam.term) : "No Exam"}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
              School Examination Board
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Inspect submitted subjects per class and section, review teacher entries, edit marks with full admin authority, and publish verified school results.
            </p>
          </div>

          {/* COMPACT & ELEGANT BLUE PUBLISH BUTTON */}
          <div className="flex flex-col items-start gap-2 sm:items-end">
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
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                readyCount > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-95"
                  : "bg-blue-50 text-blue-700 border border-blue-200 cursor-not-allowed hover:bg-blue-100/70"
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Publish Results to Portal</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                readyCount > 0 ? "bg-white text-blue-700 shadow-sm" : "bg-blue-200/80 text-blue-800"
              }`}>
                {readyCount} ready
              </span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span><strong>{publishedCount}</strong> Published</span>
              <span className="text-slate-300">|</span>
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              <span><strong>{readyCount}</strong> Approved (Private)</span>
              <span className="text-slate-300">|</span>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span><strong>{pendingCount + waitingCount}</strong> Pending Entry/Review</span>
            </div>
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

      {/* 2. STRICT SELECTION FILTERS (Year -> Term -> Class/Form -> Section) */}
      <div className="grid gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          1. Academic Year
          <select
            className={`${inputCls} mt-1.5 w-full font-semibold`}
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setSelectedSubjectId(null);
            }}
          >
            {years.map((item) => (
              <option key={item.id} value={item.id}>{item.name} {item.isCurrent ? "★ Active" : ""}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          2. Exam Term
          <select
            className={`${inputCls} mt-1.5 w-full font-semibold`}
            value={exam?.term ?? ""}
            onChange={(e) => {
              setTerm(e.target.value);
              setSelectedSubjectId(null);
            }}
          >
            {yearExams.map((item) => (
              <option key={item.id} value={item.term}>{termLabel(item.term)}</option>
            ))}
            {!yearExams.length && <option value="">No exam created yet</option>}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          3. Class / Form
          <select
            className={`${inputCls} mt-1.5 w-full font-semibold`}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionName("");
              setSelectedSubjectId(null);
            }}
          >
            <option value="">Select a Class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          4. Section
          <select
            className={`${inputCls} mt-1.5 w-full font-semibold`}
            value={sectionName}
            onChange={(e) => {
              setSectionName(e.target.value);
              setSelectedSubjectId(null);
            }}
          >
            <option value="">Select a Section</option>
            {sections.map((name) => (
              <option key={name} value={name}>Section {name}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-600">Loading class examination data...</p>
          </div>
        </div>
      ) : !exam ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-800">No Exam Created for Selected Term</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Please configure the exam in the Exams tab first.
          </p>
        </div>
      ) : !classId || !sectionName ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Filter className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-800">Select Class and Section</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Please choose a Class / Form and Section from the filters above to inspect its specific subjects and results.
          </p>
        </div>
      ) : selectedSubjectId && activeSubject ? (
        /* 3. DEDICATED SINGLE SUBJECT MARKSHEET (VIEW-ONLY BY DEFAULT, MUST CLICK EDIT TO MODIFY) */
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId(null);
                  setIsEditingMarks(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Subjects Table
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeSubject.name} <span className="text-slate-400 font-normal">({currentClass?.label} · Section {sectionName})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Teacher: <strong className="text-slate-700">{activeSubject.teacher ?? "No teacher assigned"}</strong> · Max Marks: <strong>{activeSubject.maxMarks}</strong>
                </p>
              </div>
            </div>

            {/* EDIT LOCK TOGGLE & ACTIONS */}
            <div className="flex flex-wrap items-center gap-2">
              {!isEditingMarks ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingMarks(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-sm transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Marks as Admin
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleApproveSubject(activeSubject.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition-all disabled:opacity-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Approve Subject Marks
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingMarks(false)}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveMarks(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Changes
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveMarks(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Save & Approve Now
                  </button>
                </>
              )}
            </div>
          </div>

          {/* NOTICE ABOUT PRIVATE APPROVED STATUS UNTIL PUBLISH */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs text-slate-600 border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Privacy Rule:</strong> When you enter or approve marks, they remain <em>confidential and hidden</em> from students and parents until you click the <strong>Publish Results</strong> button above.
            </span>
          </div>

          {/* STUDENT ROWS TABLE */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5 w-12">Roll</th>
                    <th className="px-4 py-3.5 min-w-[220px]">Student Details</th>
                    <th className="px-4 py-3.5 text-center">Marks (Max {activeSubject.maxMarks})</th>
                    <th className="px-4 py-3.5 text-center">Absent?</th>
                    <th className="px-4 py-3.5 text-center">Percentage</th>
                    <th className="px-4 py-3.5 text-center">Grade</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSubjectRoster.map((row) => {
                    const currentDraft = drafts[row.enrollmentId] ?? { marks: row.marks != null ? String(row.marks) : "", isAbsent: Boolean(row.isAbsent) };
                    const isAbsent = isEditingMarks ? currentDraft.isAbsent : row.isAbsent;
                    const displayMarks = isEditingMarks ? (isAbsent ? "" : currentDraft.marks) : (row.isAbsent ? null : row.marks);
                    const num = Number(isEditingMarks ? currentDraft.marks : row.marks);
                    const hasValidNum = !isAbsent && Number.isFinite(num) && (isEditingMarks ? currentDraft.marks !== "" : row.marks != null);
                    const pct = hasValidNum ? Math.round((num / activeSubject.maxMarks) * 100) : null;
                    const { grade, color: gradeColor } = calculateGrade(isAbsent ? 0 : pct);

                    return (
                      <tr key={row.enrollmentId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs font-bold text-slate-400">{row.rollNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{row.student}</p>
                          <p className="text-[11px] font-mono text-slate-500">ID: {row.permanentId}</p>
                        </td>

                        {/* MARKS DISPLAY / INPUT */}
                        <td className="px-4 py-3 text-center">
                          {isEditingMarks ? (
                            <input
                              type="number"
                              min={0}
                              max={activeSubject.maxMarks}
                              disabled={isAbsent}
                              placeholder={isAbsent ? "ABS" : "0"}
                              value={displayMarks ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.enrollmentId]: { ...prev[row.enrollmentId], marks: val, isAbsent: false },
                                }));
                              }}
                              className={`w-24 text-center font-bold text-base ${inputCls} ${
                                isAbsent ? "bg-slate-100 cursor-not-allowed text-slate-400" : ""
                              }`}
                            />
                          ) : isAbsent ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                              ABS (0)
                            </span>
                          ) : row.isReExam ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 border border-purple-200">
                              <Sparkles className="h-3 w-3 text-purple-600" /> {row.marks} <span className="text-[9px] text-purple-600 font-normal">(Re-Exam)</span>
                            </span>
                          ) : row.marks != null ? (
                            <span className="font-bold text-slate-900 text-base">{row.marks}</span>
                          ) : (
                            <span className="text-xs italic text-slate-400">Not entered</span>
                          )}
                        </td>

                        {/* ABSENT TOGGLE */}
                        <td className="px-4 py-3 text-center">
                          {isEditingMarks ? (
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={isAbsent}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.enrollmentId]: { marks: checked ? "" : prev[row.enrollmentId]?.marks ?? "", isAbsent: checked },
                                  }));
                                }}
                                className="h-4 w-4 rounded accent-rose-600"
                              />
                              <span className={isAbsent ? "text-rose-700 font-bold" : ""}>Absent</span>
                            </label>
                          ) : isAbsent ? (
                            <span className="text-xs font-bold text-rose-600">Yes (0 Marks)</span>
                          ) : (
                            <span className="text-xs text-slate-400">No</span>
                          )}
                        </td>

                        {/* PERCENTAGE */}
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          {isAbsent ? (
                            <span className="text-xs text-rose-600 font-bold">0%</span>
                          ) : pct != null ? (
                            `${pct}%`
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* GRADE */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold border ${gradeColor}`}>
                            {grade}
                          </span>
                        </td>

                        {/* STATE */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.state === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            row.state === "VERIFIED" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                            row.state === "SUBMITTED" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {row.state === "PUBLISHED" ? "Published" : row.state === "VERIFIED" ? "Approved" : row.state === "SUBMITTED" ? "Submitted" : "Draft"}
                          </span>
                        </td>

                        {/* ROW ACTIONS */}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setReExamTarget({
                                studentName: row.student,
                                permanentId: row.permanentId,
                                enrollmentId: row.enrollmentId,
                                subjectId: activeSubject.id,
                                subjectName: activeSubject.name,
                                maxMarks: activeSubject.maxMarks,
                                currentMarks: row.marks,
                                isAbsent: row.isAbsent,
                              });
                              setReExamMarks(row.marks != null ? String(row.marks) : "");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" /> Re-Exam
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        /* 4. MAIN WORKSPACE: TABBED INTERFACE (1. SUBJECTS TABLE, 2. CLASS RESULTS MATRIX) */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("subjects_table")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  activeTab === "subjects_table"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <BookOpen className="h-4 w-4" /> Section Subjects Table ({sectionSubjects.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("results_matrix")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  activeTab === "results_matrix"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Users className="h-4 w-4" /> Class Results Matrix ({sectionPeople.length} Students)
              </button>
            </div>

            {activeTab === "results_matrix" && sectionPeople.length > 0 && (
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

          {/* TAB 1: SECTION SUBJECTS TABLE (REPLACES CARDS AS REQUESTED) */}
          {activeTab === "subjects_table" && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Subjects in {currentClass?.label} · Section {sectionName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click "Open Marksheet" on any subject to inspect, lock/unlock edit mode, or approve marks.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 rounded-lg bg-slate-100 px-3 py-1">
                  Total: {sectionSubjects.length} Subjects
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5 w-12">#</th>
                      <th className="px-5 py-3.5 min-w-[180px]">Subject Name</th>
                      <th className="px-5 py-3.5 min-w-[180px]">Assigned Teacher</th>
                      <th className="px-4 py-3.5 text-center">Max Marks</th>
                      <th className="px-4 py-3.5 text-center">Progress / Submissions</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right min-w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sectionSubjects.map((subj, idx) => {
                      const subjectRows = subj.rows.filter((r) => r.section === sectionName);
                      const totalStudents = subjectRows.length;
                      const enteredCount = subjectRows.filter((r) => r.marks != null || r.isAbsent).length;
                      const approvedCount = subjectRows.filter((r) => r.state === "VERIFIED" || r.state === "PUBLISHED").length;
                      const publishedRowsCount = subjectRows.filter((r) => r.state === "PUBLISHED").length;
                      const absentCount = subjectRows.filter((r) => r.isAbsent).length;
                      const isFullyApproved = totalStudents > 0 && approvedCount === totalStudents;
                      const isFullyPublished = totalStudents > 0 && publishedRowsCount === totalStudents;
                      const isFullySubmitted = totalStudents > 0 && enteredCount === totalStudents;

                      return (
                        <tr key={subj.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-5 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-5 py-4">
                            <span className="font-extrabold text-slate-900 text-base">{subj.name}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
                                <User className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-semibold text-slate-800 text-sm">
                                {subj.teacher ?? <span className="text-slate-400 font-normal italic">No teacher assigned</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-slate-700">
                            {subj.maxMarks}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-xs text-slate-800">
                                {enteredCount} / {totalStudents} Entered
                              </span>
                              {absentCount > 0 && (
                                <span className="text-[10px] font-bold text-rose-600">
                                  ({absentCount} Absent)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {isFullyPublished ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                <Eye className="h-3 w-3" /> Published
                              </span>
                            ) : isFullyApproved ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
                                <CheckCircle2 className="h-3 w-3" /> Approved (Private)
                              </span>
                            ) : isFullySubmitted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                                <Clock className="h-3 w-3" /> Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" /> In Progress ({totalStudents - enteredCount} left)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubjectId(subj.id);
                                  setIsEditingMarks(false);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" /> Open Marksheet
                              </button>
                              {enteredCount > approvedCount && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleApproveSubject(subj.id)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" /> Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSubjectToDelete({ id: subj.id, name: subj.name, classLabel: currentClass?.label ?? "Class" })}
                                title="Remove subject from this exam"
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!sectionSubjects.length && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                          No subjects assigned to this section yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FULL CLASS RESULTS MATRIX */}
          {activeTab === "results_matrix" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Results Matrix: {currentClass?.label} · Section {sectionName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Absent subjects yield 0 and count in the denominator towards the average.
                  </p>
                </div>
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

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 w-12">#</th>
                        <th className="px-4 py-3.5 min-w-[200px]">Student Details</th>
                        {sectionSubjects.map((s) => (
                          <th key={s.id} className="px-3 py-3.5 text-center min-w-[100px]">
                            <span className="font-bold text-slate-900 block truncate max-w-[110px]">{s.name}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">Max {s.maxMarks}</span>
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
                        const score = sectionScore(sectionSubjects, enrollmentId);
                        const { grade, color: gradeColor } = calculateGrade(score.average);
                        const isPassing = score.average != null && score.average >= 50;
                        const hasAbsent = score.cells.some((c) => c.absent);
                        const hasFailingSubject = score.cells.some((c) => c.marks != null && c.marks < (c.subject.minMarks || c.maxMarks * 0.5));

                        return (
                          <tr key={enrollmentId} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-400">{person.roll || idx + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{person.name}</p>
                              <p className="text-[11px] font-mono text-slate-500">ID: {person.permanentId}</p>
                            </td>

                            {score.cells.map((cell) => (
                              <td key={cell.subject.id} className="px-3 py-3 text-center">
                                {cell.absent ? (
                                  <span className="inline-flex items-center rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                    ABS (0)
                                  </span>
                                ) : cell.isReExam ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                                    <Sparkles className="h-3 w-3 text-purple-600" /> {cell.marks}
                                  </span>
                                ) : cell.marks != null ? (
                                  <span className={`text-sm font-bold ${cell.marks >= 50 ? "text-slate-900" : "text-rose-600"}`}>
                                    {cell.marks}
                                  </span>
                                ) : (
                                  <span className="text-xs italic text-slate-400">Pending</span>
                                )}
                              </td>
                            ))}

                            <td className="px-3 py-3 text-center font-bold text-slate-900">
                              {score.possible > 0 ? `${score.obtained} / ${score.possible}` : "—"}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {score.average != null ? (
                                <span className={`text-sm font-extrabold ${score.average >= 50 ? "text-slate-900" : "text-rose-600"}`}>
                                  {score.average.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold border ${gradeColor}`}>
                                {grade}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {!score.final ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                  Provisional
                                </span>
                              ) : isPassing ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                  <Check className="h-3 w-3" /> Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                  Failed
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {(hasAbsent || hasFailingSubject) && (
                                <button
                                  type="button"
                                  onClick={() => {
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
        </div>
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
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-600/25 disabled:opacity-50"
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
