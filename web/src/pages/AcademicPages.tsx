import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Layers,
  Plus,
  School,
  Search,
  Sparkles,
  Users,
  AlertCircle,
  Eye,
  UserCheck,
  IdCard,
  Hash,
  X,
  UserRound,
  Mail,
  Phone,
  Edit2,
  Trash2,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { api } from "../lib/api";
import { Avatar, DataTable } from "../components/PeopleList";
import { ConfirmModal } from "../components/ConfirmModal";

type YearCard = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  classes: Array<{ id: string; sections: unknown[]; subjects: unknown[] }>;
};

type Level = { code: string; label: string };
type Subject = { id: string; name: string; code: string };
type YearDetail = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  levels: Level[];
  classes: Array<{
    id: string;
    level: string;
    label: string;
    band: string;
    sectionCount: number;
    studentCount: number;
    sections: Array<{ id: string; name: string; studentCount: number }>;
    subjects: Array<{ subject: Subject }>;
  }>;
};

type ClassDetail = {
  id: string;
  level: string;
  label: string;
  band: string;
  academicYear: { id: string; name: string };
  subjects: Subject[];
  sections: Array<{ id: string; name: string; studentCount: number }>;
};

type SectionDetail = {
  id: string;
  name: string;
  label: string;
  classLabel: string;
  classGroupId: string;
  academicYear: { id: string; name: string };
  totals: { students: number; teachers: number; subjects: number };
  students: Array<{
    id: string;
    permanentId: string;
    name: string;
    gender: string;
    photoUrl: string | null;
    rollNumber: number;
    studentNumber: string;
    parent: string | null;
  }>;
  teachers: Array<{
    id: string;
    publicId: string;
    name: string;
    phone: string;
    email: string;
    subjects: string[];
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    teacher: { id: string; publicId: string; name: string; phone: string } | null;
  }>;
  availableSubjects: Subject[];
};

const blue = "#2563eb";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" style={{ color: blue }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function GradCapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" style={{ color: blue }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12v5c2 2 4 3 6 3s4-1 6-3v-5" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" style={{ color: blue }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </svg>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Academic year", "Class / Form", "Section", "Student list"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = number === current;
        const done = number < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 font-medium ${active ? "bg-blue-600 text-white" : done ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
              {number}. {label}
            </span>
            {number < steps.length ? <span className="text-slate-300">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function sectionCount(year: YearCard) {
  return year.classes.reduce((sum, item) => sum + (item.sections?.length ?? 0), 0);
}

export function AcademicYearsPage() {
  const [years, setYears] = useState<YearCard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"years" | "subjects" | "exams">("years");

  // Edit Academic Year State
  const [editYear, setEditYear] = useState<YearCard | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "", isCurrent: false });

  // Delete Academic Year State
  const [deleteYear, setDeleteYear] = useState<YearCard | null>(null);

  async function load() {
    const [yearData, subjectList] = await Promise.all([
      api<{ years: YearCard[] }>("/api/v1/academic-years"),
      api<Subject[]>("/api/v1/subjects"),
    ]);
    setYears(yearData.years);
    setSubjects(subjectList);
  }

  useEffect(() => {
    load()
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load academic years."))
      .finally(() => setLoading(false));
  }, []);

  function closeModal() {
    setOpen(false);
    setFormError("");
    setName("");
    setStartDate("");
    setEndDate("");
  }

  async function createYear(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api("/api/v1/academic-years", {
        method: "POST",
        body: JSON.stringify({ name, startDate, endDate, isCurrent: years.length === 0 }),
      });
      closeModal();
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create the academic year.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditYear(event: React.FormEvent) {
    event.preventDefault();
    if (!editYear) return;
    setFormError("");
    setSaving(true);
    try {
      await api(`/api/v1/academic-years/${editYear.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditYear(null);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not update the academic year.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteYear() {
    if (!deleteYear) return;
    await api(`/api/v1/academic-years/${deleteYear.id}`, { method: "DELETE" });
    setDeleteYear(null);
    await load();
  }

  async function makeCurrent(id: string) {
    await api(`/api/v1/academic-years/${id}/current`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <School className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Academic Years & Structure</h1>
                <p className="text-xs text-slate-500">Configure academic calendar terms, grade levels, and classes.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition"
              onClick={() => { setOpen(true); setFormError(""); }}
            >
              <Plus className="h-4 w-4" />
              <span>Create Academic Year</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          type="button"
          onClick={() => setTab("years")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "years"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Academic Years</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === "years" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
            {years.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("subjects")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "subjects"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Curriculum Subjects</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === "subjects" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
            {subjects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("exams")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "exams"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span>Exams Setup</span>
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Tab: Academic Years */}
      {tab === "years" && !loading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {years.map((year) => (
              <div
                key={year.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                      <CalendarDays className="h-6 w-6" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          year.isCurrent
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {year.isCurrent ? "Current Year" : "Previous Year"}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditYear(year);
                          setEditForm({
                            name: year.name,
                            startDate: year.startDate.slice(0, 10),
                            endDate: year.endDate.slice(0, 10),
                            isCurrent: year.isCurrent,
                          });
                        }}
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="Edit Academic Year"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteYear(year);
                        }}
                        className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete Academic Year"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <Link to={`/school/academic-years/${year.id}`} className="block mt-4">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition">
                      {year.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(year.startDate)} – {formatDate(year.endDate)}</span>
                    </p>
                  </Link>

                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-slate-700 flex items-center gap-1.5">
                      <School className="h-3.5 w-3.5 text-slate-400" />
                      {year.classes.length} Classes
                    </span>
                    <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-slate-700 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      {sectionCount(year)} Sections
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/school/academic-years/${year.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition"
                  >
                    <span>Manage Classes</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  {!year.isCurrent && (
                    <button
                      type="button"
                      onClick={() => void makeCurrent(year.id)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-blue-600 transition"
                    >
                      Set as Current
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!years.length && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">No academic years added yet.</p>
              <p className="text-xs text-slate-400 mt-0.5">Click "Create Academic Year" above to start.</p>
            </div>
          )}
        </>
      ) : null}

      {/* Tab: Subjects */}
      {tab === "subjects" && !loading ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link to="/school/subjects" className="rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500">
              Manage Subjects
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {subjects.map((subject) => (
              <div key={subject.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="font-bold text-slate-900 text-sm">{subject.name}</div>
                <div className="font-mono text-xs text-slate-400 mt-0.5">{subject.code}</div>
              </div>
            ))}
            {!subjects.length ? <p className="text-slate-500">No subjects yet.</p> : null}
          </div>
        </div>
      ) : null}

      {/* Tab: Exams */}
      {tab === "exams" && !loading ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Exams & Assessment Setup</h2>
          <p className="text-sm text-slate-500">Open exams module to create examination terms, subjects, and publish marks.</p>
          <Link to="/school/exams" className="inline-flex rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500">
            Open Exams Module →
          </Link>
        </div>
      ) : null}

      {/* Create Academic Year Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={closeModal}>
          <form
            onSubmit={createYear}
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Academic Year</h3>
                <p className="text-xs text-slate-500">Add a new academic session for this school.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Academic Year Name *
                <input
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 2026-2027"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Start Date *
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  End Date *
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    required
                  />
                </label>
              </div>
            </div>

            {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Academic Year"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Edit Academic Year Modal */}
      {editYear ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setEditYear(null)}>
          <form
            onSubmit={saveEditYear}
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Academic Year</h3>
                <p className="text-xs text-slate-500">Update calendar period and active status.</p>
              </div>
              <button type="button" onClick={() => setEditYear(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Academic Year Name *
                <input
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Start Date *
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  End Date *
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    required
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  className="rounded accent-blue-600"
                  checked={editForm.isCurrent}
                  onChange={(e) => setEditForm({ ...editForm, isCurrent: e.target.checked })}
                />
                <span className="text-xs font-semibold text-slate-700">Set as Current Active Academic Year</span>
              </label>
            </div>

            {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setEditYear(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Delete Academic Year Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteYear)}
        onClose={() => setDeleteYear(null)}
        onConfirm={confirmDeleteYear}
        title="Digniin Culus: Tirtiridda Sanad-Dugsiyeedka"
        targetName={deleteYear?.name}
        targetType="Academic Year / Sanad-Dugsiyeed"
        description={`Tirtiridda sanad-dugsiyeedkan (${deleteYear?.name}) waxay tirtiri doontaa dhammaan fasallada, qeybaha (sections), diiwaanka ardayda ku xidhan, natiijooyinka imtixaanaadka, iyo xilsaarka macallimiinta ee sanadkan. Tallaabadan dib looma soo celin karo.`}
        confirmText="Haa, Tirtir Sanadkan"
        cancelText="Ka Noqo"
        isDestructive={true}
        requireKeyword="DELETE"
      />
    </div>
  );
}

export function AcademicYearPage() {
  const { academicYearId } = useParams();
  const [year, setYear] = useState<YearDetail | null>(null);
  const [level, setLevel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const detail = await api<YearDetail>(`/api/v1/academic-years/${academicYearId}`);
    setYear(detail);
    const taken = new Set(detail.classes.map((item) => item.level));
    const open = detail.levels.filter((item) => !taken.has(item.code));
    setLevel((current) => (open.some((item) => item.code === current) ? current : open[0]?.code ?? ""));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load this year."));
  }, [academicYearId]);

  async function addClass(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(`/api/v1/academic-years/${academicYearId}/classes`, {
        method: "POST",
        body: JSON.stringify({ level }),
      });
      setShowCreate(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the class.");
    }
  }

  const remainingLevels = (year?.levels ?? []).filter((item) => !year?.classes.some((group) => group.level === item.code));

  const bands = useMemo(() => {
    const groups = new Map<string, YearDetail["classes"]>();
    for (const item of year?.classes ?? []) {
      const list = groups.get(item.band) ?? [];
      list.push(item);
      groups.set(item.band, list);
    }
    return [...groups.entries()];
  }, [year]);

  if (!year && !error) return <p className="text-slate-500">Loading year...</p>;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/school/academic-years"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Academic Years
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                <GraduationCap className="h-3.5 w-3.5" />
                Classes & Forms
              </span>
              {year?.isCurrent && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                  Current Year
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Classes & Forms · {year?.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a class or form to manage its sections, enrollments, and teacher assignments.
            </p>
          </div>

          <button
            type="button"
            disabled={!remainingLevels.length}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition active:scale-95"
            onClick={() => setShowCreate((current) => !current)}
          >
            <Plus className="h-4 w-4" />
            {showCreate ? "Close Form" : "Create Class / Form"}
          </button>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Total Classes</span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{year?.classes.length ?? 0}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Total Sections</span>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-600">
              {(year?.classes ?? []).reduce((sum, item) => sum + item.sectionCount, 0)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Enrolled Students</span>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600">
              {(year?.classes ?? []).reduce((sum, item) => sum + (item.studentCount || 0), 0)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Available Levels</span>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600">{remainingLevels.length}</div>
          </div>
        </div>
      </div>

      {/* Create Class Form */}
      {showCreate && remainingLevels.length ? (
        <form onSubmit={addClass} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" /> Create New Class / Form
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Select a curriculum level to activate for this academic year.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-700 min-w-[260px] flex-1">
              Class / Form Level *
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              >
                {remainingLevels.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2 self-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Create Class
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Classes by Band */}
      <div className="space-y-6">
        {bands.map(([band, classes]) => (
          <div key={band} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <School className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">{band} Classes</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {classes.length} {classes.length === 1 ? "Class" : "Classes"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {classes.map((item) => (
                <Link
                  key={item.id}
                  to={`/school/classes/${item.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-5 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white font-black text-sm shadow-sm group-hover:scale-105 transition">
                        {item.label.split(" ")[0][0]}
                        {item.label.split(" ")[1] ?? ""}
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {item.sectionCount} {item.sectionCount === 1 ? "Section" : "Sections"}
                      </span>
                    </div>

                    <h4 className="mt-3.5 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                      {item.label}
                    </h4>

                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {item.studentCount || 0} Students
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        {item.subjects?.length ?? 0} Subjects
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition">
                    <span>Manage Sections</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {!bands.length && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400">
            <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">No classes created for this academic year yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">Click the "Create Class / Form" button above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClassGroupPage() {
  const { classGroupId } = useParams();
  const [data, setData] = useState<ClassDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [error, setError] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSubjects, setShowSubjects] = useState(false);
  const [editSection, setEditSection] = useState<{ id: string; name: string } | null>(null);
  const [deleteSection, setDeleteSection] = useState<{ id: string; name: string } | null>(null);
  const [editSectionName, setEditSectionName] = useState("");
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);
  const [savingSection, setSavingSection] = useState(false);

  async function load() {
    const [detail, subjectList] = await Promise.all([
      api<ClassDetail>(`/api/v1/class-groups/${classGroupId}`),
      api<Subject[]>("/api/v1/subjects"),
    ]);
    setData(detail);
    setSubjects(subjectList);
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load class."));
  }, [classGroupId]);

  async function handleUpdateSection(e: React.FormEvent) {
    e.preventDefault();
    if (!editSection) return;
    setSavingSection(true);
    setError("");
    try {
      await api(`/api/v1/sections/${editSection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editSectionName, subjectIds: editSubjectIds }),
      });
      setEditSection(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update section.");
    } finally {
      setSavingSection(false);
    }
  }

  async function handleDeleteSection() {
    if (!deleteSection) return;
    setError("");
    try {
      await api(`/api/v1/sections/${deleteSection.id}`, { method: "DELETE" });
      setDeleteSection(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete section.");
    }
  }

  async function addSection(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setError("");
    try {
      await api(`/api/v1/class-groups/${data.id}/sections`, {
        method: "POST",
        body: JSON.stringify({ name: sectionName, subjectIds: selectedSubjectIds }),
      });
      setSectionName("");
      setSelectedSubjectIds([]);
      setNewSubject("");
      setShowSubjects(false);
      setShowAdd(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add section.");
    }
  }

  async function createSubject() {
    const name = newSubject.trim();
    if (name.length < 2) {
      setError("Enter a subject name.");
      return;
    }
    setError("");
    try {
      const created = await api<Subject>("/api/v1/subjects", { method: "POST", body: JSON.stringify({ name }) });
      setSubjects((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSubjectIds((current) => current.includes(created.id) ? current : [...current, created.id]);
      setNewSubject("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the subject.");
    }
  }

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading class...</p>;

  const totalStudents = data.sections.reduce((sum, s) => sum + s.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Link
              to={`/school/academic-years/${data.academicYear.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to {data.academicYear.name} Classes</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Class {data.label} · Sections
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                <School className="h-3 w-3" />
                {data.academicYear.name}
              </span>
              {data.band ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {data.band}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              Manage sections, curriculum subjects, and student cohorts for {data.label}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdd((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Section</span>
          </button>
        </div>

        {/* 3 Metrics Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100/70 text-blue-700">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{data.sections.length}</div>
              <div className="text-xs font-semibold text-slate-500">Active Sections</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100/70 text-emerald-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{totalStudents}</div>
              <div className="text-xs font-semibold text-slate-500">Enrolled Students</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100/70 text-purple-700">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{data.subjects.length}</div>
              <div className="text-xs font-semibold text-slate-500">Assigned Subjects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Section Form Modal/Card */}
      {showAdd ? (
        <form
          onSubmit={addSection}
          className="rounded-3xl border border-blue-200/80 bg-white p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Section to {data.label}</h3>
                <p className="text-xs text-slate-500">Specify section identifier and assign subjects</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Section Name / Letter
              <input
                className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g. A, B, Green, or North"
                value={sectionName}
                onChange={(event) => setSectionName(event.target.value)}
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowSubjects((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                {showSubjects ? "Hide Subject Assignment" : `Assign Subjects (${selectedSubjectIds.length} selected)`}
              </button>
            </div>
          </div>

          {showSubjects ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Select Subjects to Include</p>
                {selectedSubjectIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectIds([])}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => {
                  const isChecked = selectedSubjectIds.includes(subject.id);
                  return (
                    <label
                      key={subject.id}
                      className={`inline-flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        isChecked
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-blue-600"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedSubjectIds((curr) =>
                            curr.includes(subject.id) ? curr.filter((id) => id !== subject.id) : [...curr, subject.id]
                          )
                        }
                      />
                      <span>{subject.name}</span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <input
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Or create new subject..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void createSubject()}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  + Add & Assign
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Save Section
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Sections Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Sections in {data.label}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {data.sections.length} {data.sections.length === 1 ? "Section" : "Sections"}
          </span>
        </div>

        {data.sections.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.sections.map((section) => (
              <div
                key={section.id}
                className="group flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white font-black text-lg shadow-sm group-hover:scale-105 transition">
                      {section.name}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        Section {section.name}
                      </span>
                      <button
                        type="button"
                        title="Edit Section"
                        onClick={() => {
                          setEditSection({ id: section.id, name: section.name });
                          setEditSectionName(section.name);
                          setEditSubjectIds([]);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete Section"
                        onClick={() => {
                          setDeleteSection({ id: section.id, name: section.name });
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <Link to={`/school/sections/${section.id}`} className="block mt-3.5">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                      Section {section.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Class {data.label}</p>
                  </Link>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 font-semibold">
                    <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1 text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {section.studentCount} Students
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                  <Link
                    to={`/school/sections/${section.id}`}
                    className="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition"
                  >
                    <span>Open Section Roster</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400">
            <Layers className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">No sections created for this class yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">Click "Add Section" above to add Section A, B, etc.</p>
          </div>
        )}
      </div>

      {/* Edit Section Modal */}
      {editSection ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setEditSection(null)}>
          <form
            onSubmit={handleUpdateSection}
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Section {editSection.name}</h3>
                <p className="text-xs text-slate-500">Update section name or curriculum subjects</p>
              </div>
              <button type="button" onClick={() => setEditSection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Section Name / Letter *
                <input
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  value={editSectionName}
                  onChange={(e) => setEditSectionName(e.target.value)}
                  placeholder="e.g. A, B, East, West..."
                  required
                />
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Update Assigned Subjects (optional)
                </label>
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 flex flex-wrap gap-1.5">
                  {subjects.map((sub) => {
                    const active = editSubjectIds.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() =>
                          setEditSubjectIds((curr) =>
                            curr.includes(sub.id) ? curr.filter((id) => id !== sub.id) : [...curr, sub.id]
                          )
                        }
                        className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                  {!subjects.length && <p className="text-xs text-slate-400 p-1">No subjects available.</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setEditSection(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSection}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {savingSection ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Delete Section ConfirmModal */}
      <ConfirmModal
        isOpen={Boolean(deleteSection)}
        onClose={() => setDeleteSection(null)}
        onConfirm={handleDeleteSection}
        title="Digniin Culus: Tirtiridda Qeybta (Section)"
        targetName={`Section ${deleteSection?.name}`}
        targetType="Class Section"
        description={`Tirtiridda qeybta (Section ${deleteSection?.name}) waxay tirtiri doontaa dhammaan ardayda ku qoran qeybtan, xaadirintooda, xilsaarka macallimiinta, iyo natiijooyinka imtixaanaadka ee qeybtan. Tallaabadan dib looma soo celin karo.`}
        confirmText="Haa, Tirtir Qeybta"
        cancelText="Ka Noqo"
        isDestructive={true}
        requireKeyword="DELETE"
      />
    </div>
  );
}

export function SectionPage() {
  const { sectionId } = useParams();
  const [data, setData] = useState<SectionDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"students" | "teachers" | "subjects">("students");
  const [showSubjectAssign, setShowSubjectAssign] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; publicId: string }>>([]);
  const [teacherMode, setTeacherMode] = useState<"existing" | "new">("existing");
  const [teacherId, setTeacherId] = useState("");
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([]);
  const [newTeacher, setNewTeacher] = useState({ firstName: "", lastName: "", email: "", phone: "", qualification: "" });
  const [savingTeacher, setSavingTeacher] = useState(false);

  async function loadSection() {
    const section = await api<SectionDetail>(`/api/v1/sections/${sectionId}`);
    setData(section);
    setTeacherSubjectIds((current) => current.filter((id) => section.subjects.some((subject) => subject.id === id)));
    try {
      const teacherRows = await api<Array<{ id: string; name: string; publicId: string }>>("/api/v1/teachers");
      setTeachers(teacherRows);
      if (!teacherRows.length) setTeacherMode("new");
      setTeacherId((current) => current || teacherRows[0]?.id || "");
    } catch (caught) {
      setTeachers([]);
      setTeacherMode("new");
      setError(caught instanceof Error ? caught.message : "Could not load teachers.");
    }
  }

  useEffect(() => {
    loadSection()
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load section."));
  }, [sectionId]);

  async function assignTeacher(event: React.FormEvent) {
    event.preventDefault();
    if (!teacherSubjectIds.length) {
      setError("Choose a subject assigned to this section.");
      return;
    }
    setSavingTeacher(true);
    setError("");
    try {
      if (teacherMode === "new") {
        await api("/api/v1/teachers", {
          method: "POST",
          body: JSON.stringify({ ...newTeacher, assignment: { sectionId, subjectIds: teacherSubjectIds } }),
        });
        setNewTeacher({ firstName: "", lastName: "", email: "", phone: "", qualification: "" });
      } else {
        await api("/api/v1/teacher-assignments", {
          method: "POST",
          body: JSON.stringify({ teacherId, sectionId, subjectIds: teacherSubjectIds }),
        });
      }
      setTeacherSubjectIds([]);
      await loadSection();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign the teacher.");
    } finally {
      setSavingTeacher(false);
    }
  }

  async function assignSubjects(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSubjectIds.length) {
      setError("Choose at least one subject.");
      return;
    }
    setSavingSubjects(true);
    setError("");
    try {
      await api(`/api/v1/sections/${sectionId}/subjects`, {
        method: "POST",
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      });
      setSelectedSubjectIds([]);
      setShowSubjectAssign(false);
      await loadSection();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign subjects.");
    } finally {
      setSavingSubjects(false);
    }
  }

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading section...</p>;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <Link
            to={`/school/classes/${data.classGroupId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {data.classLabel} Sections</span>
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {data.classLabel} · Section {data.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  <School className="h-3 w-3" />
                  {data.academicYear.name}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  Section {data.name}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Student roster, subject curriculum, and assigned teaching faculty for Section {data.name}.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100/70 text-emerald-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{data.totals.students}</div>
              <div className="text-xs font-semibold text-slate-500">Enrolled Students</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100/70 text-blue-700">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{data.totals.teachers}</div>
              <div className="text-xs font-semibold text-slate-500">Assigned Teachers</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100/70 text-purple-700">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{data.totals.subjects}</div>
              <div className="text-xs font-semibold text-slate-500">Active Subjects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          type="button"
          onClick={() => setTab("students")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "students"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Students</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              tab === "students" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {data.totals.students}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("teachers")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "teachers"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span>Teachers</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              tab === "teachers" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {data.totals.teachers}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("subjects")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "subjects"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Subjects</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              tab === "subjects" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {data.totals.subjects}
          </span>
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Tab 1: Students */}
      {tab === "students" ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Enrolled Students</h2>
                <p className="text-xs text-slate-500">Active roster for Section {data.name}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.students.length} Learners
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-6">Student</th>
                    <th className="py-3.5 px-4">Student ID</th>
                    <th className="py-3.5 px-4">Roll No</th>
                    <th className="py-3.5 px-4">Parent / Guardian</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} seed={student.permanentId} photoUrl={student.photoUrl} />
                          <div>
                            <Link
                              to={`/school/students/${student.id}`}
                              className="font-bold text-slate-900 hover:text-blue-600 transition"
                            >
                              {student.name}
                            </Link>
                            <div className="text-xs text-slate-400 capitalize">{student.gender || "Student"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {student.permanentId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {student.rollNumber ?? "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {student.parent || "—"}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          to={`/school/students/${student.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Profile</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!data.students.length && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Users className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-600">No students enrolled in this section yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tab 2: Teachers */}
      {tab === "teachers" ? (
        <div className="space-y-6">
          {/* Assign Teacher Card */}
          <form onSubmit={assignTeacher} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Assign Section Teacher</h2>
                <p className="text-xs text-slate-500">Link an instructor to specific subjects taught in Section {data.name}</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 transition ${teacherMode === "existing" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"}`}
                  onClick={() => setTeacherMode("existing")}
                >
                  Saved Teacher
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 transition ${teacherMode === "new" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"}`}
                  onClick={() => setTeacherMode("new")}
                >
                  New Teacher
                </button>
              </div>
            </div>

            {teacherMode === "existing" ? (
              <label className="block text-sm font-semibold text-slate-700 md:max-w-md">
                Select Instructor
                <select
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} · {teacher.publicId}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="First name"
                  value={newTeacher.firstName}
                  onChange={(event) => setNewTeacher({ ...newTeacher, firstName: event.target.value })}
                  required
                />
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="Last name"
                  value={newTeacher.lastName}
                  onChange={(event) => setNewTeacher({ ...newTeacher, lastName: event.target.value })}
                  required
                />
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="Email address"
                  type="email"
                  value={newTeacher.email}
                  onChange={(event) => setNewTeacher({ ...newTeacher, email: event.target.value })}
                  required
                />
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="Phone number"
                  value={newTeacher.phone}
                  onChange={(event) => setNewTeacher({ ...newTeacher, phone: event.target.value })}
                  required
                />
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-500 focus:outline-none sm:col-span-2"
                  placeholder="Academic Qualification (e.g. B.Ed, M.Sc Mathematics)"
                  value={newTeacher.qualification}
                  onChange={(event) => setNewTeacher({ ...newTeacher, qualification: event.target.value })}
                  required
                />
              </div>
            )}

            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Assign to Section Subjects
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {data.subjects.map((subject) => {
                  const selected = teacherSubjectIds.includes(subject.id);
                  return (
                    <label
                      key={subject.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-blue-600"
                        checked={selected}
                        onChange={() =>
                          setTeacherSubjectIds((curr) =>
                            selected ? curr.filter((id) => id !== subject.id) : [...curr, subject.id]
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{subject.name}</span>
                        {subject.teacher ? (
                          <span className="text-[11px] text-slate-400">Current: {subject.teacher.name}</span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">Unassigned</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              {!data.subjects.length ? (
                <p className="text-xs text-amber-600 mt-2">No subjects assigned to this section yet. Assign subjects in the Subjects tab first.</p>
              ) : null}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                disabled={savingTeacher || !teacherSubjectIds.length}
                className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
              >
                {savingTeacher ? "Saving..." : "Assign Teacher"}
              </button>
            </div>
          </form>

          {/* Teacher Roster */}
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Assigned Faculty</h2>
              <p className="text-xs text-slate-500">Teachers instructing Section {data.name}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-6">Faculty Member</th>
                    <th className="py-3.5 px-4">Staff ID</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-6">Assigned Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6">
                        <Link
                          to={`/school/teachers/${teacher.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {teacher.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {teacher.publicId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 text-xs font-semibold">{teacher.phone}</div>
                        <div className="text-slate-400 text-xs">{teacher.email}</div>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.subjects.map((subj) => (
                            <span key={subj} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                              {subj}
                            </span>
                          ))}
                          {!teacher.subjects.length && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.teachers.length && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-600">No teachers assigned to this section yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tab 3: Subjects */}
      {tab === "subjects" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Section Curriculum Subjects</h2>
              <p className="text-xs text-slate-500">Subjects taught in Section {data.name}</p>
            </div>
            <button
              type="button"
              disabled={!data.availableSubjects.length}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition"
              onClick={() => {
                setShowSubjectAssign((current) => !current);
                setError("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Assign Subjects</span>
            </button>
          </div>

          {showSubjectAssign ? (
            <form onSubmit={assignSubjects} className="rounded-3xl border border-blue-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Subjects to Section {data.name}</h3>
                  <p className="text-xs text-slate-500">Select from available school curriculum subjects</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectAssign(false);
                    setSelectedSubjectIds([]);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.availableSubjects.map((subject) => {
                  const selected = selectedSubjectIds.includes(subject.id);
                  return (
                    <label
                      key={subject.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                        selected
                          ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-blue-600"
                        checked={selected}
                        onChange={() =>
                          setSelectedSubjectIds((curr) =>
                            selected ? curr.filter((id) => id !== subject.id) : [...curr, subject.id]
                          )
                        }
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900">{subject.name}</span>
                        <span className="font-mono text-xs text-slate-400">{subject.code}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setShowSubjectAssign(false);
                    setSelectedSubjectIds([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  disabled={savingSubjects || !selectedSubjectIds.length}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingSubjects ? "Assigning..." : `Assign ${selectedSubjectIds.length || ""} Subject${selectedSubjectIds.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          ) : null}

          {/* Subjects Table */}
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-6">Code</th>
                    <th className="py-3.5 px-4">Subject Name</th>
                    <th className="py-3.5 px-6">Assigned Instructor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {subject.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {subject.name}
                      </td>
                      <td className="py-3.5 px-6">
                        {subject.teacher ? (
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                              {subject.teacher.name[0]}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-900">{subject.teacher.name}</span>
                              <span className="block font-mono text-[10px] text-slate-400">{subject.teacher.publicId}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            Unassigned
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data.subjects.length && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400">
                        <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-600">No subjects assigned to this section yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const subjectPastels = ["bg-emerald-50", "bg-rose-50", "bg-pink-50", "bg-amber-50", "bg-violet-50", "bg-sky-50"];

function pastelFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash + id.charCodeAt(index) * (index + 1)) % subjectPastels.length;
  return subjectPastels[hash];
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setSubjects(await api<Subject[]>("/api/v1/subjects"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load subjects."));
  }, []);

  async function createSubject(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/v1/subjects", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      setAdding(false);
      setMessage("Subject saved. Assign it from a section.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the subject.");
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/v1/subjects/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) });
      setEditing(null);
      setMessage("Subject updated.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the subject.");
    }
  }

  const visible = subjects.filter((subject) => `${subject.name} ${subject.code}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <BookOpen className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Curriculum Subjects</h1>
            </div>
            <p className="text-sm text-slate-500">
              Manage school-wide subjects and assign them to classes and sections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-64 rounded-2xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                placeholder="Search subjects or code..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              onClick={() => {
                setAdding(true);
                setName("");
                setError("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Subject</span>
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((subject) => (
          <button
            key={subject.id}
            type="button"
            className="group flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
            onClick={() => {
              setEditing(subject);
              setEditName(subject.name);
              setError("");
            }}
          >
            <div>
              <div className="flex items-start justify-between">
                <span className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                  {subject.code}
                </span>
                <span className="text-slate-300 group-hover:text-blue-600 transition">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                {subject.name}
              </h3>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>Click to edit</span>
            </div>
          </button>
        ))}
      </div>

      {!visible.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400">
          <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {subjects.length ? "No subjects match your search." : "No subjects added yet."}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Click "Add Subject" above to add your first course.</p>
        </div>
      ) : null}

      {adding ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <form
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4"
            onSubmit={createSubject}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Add New Subject</h2>
                <p className="text-xs text-slate-500">Create a curriculum subject</p>
              </div>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              placeholder="Subject name, e.g. Biology or History"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">
                Save Subject
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <form
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4"
            onSubmit={saveEdit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Subject</h2>
                <p className="font-mono text-xs text-slate-400">{editing.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              required
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">
                Update Subject
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
