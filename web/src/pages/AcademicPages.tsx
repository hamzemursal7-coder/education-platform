import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Avatar, DataTable } from "../components/PeopleList";

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
  const [menuId, setMenuId] = useState<string | null>(null);

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

  async function makeCurrent(id: string) {
    setMenuId(null);
    await api(`/api/v1/academic-years/${id}/current`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-sky-50 to-blue-100 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-6 -top-8 h-40 w-56 opacity-90">
          <svg viewBox="0 0 220 160" className="h-full w-full" aria-hidden>
            <path d="M30 120c20-40 50-70 90-78 18 22 28 48 24 78" fill="#dbeafe" />
            <path d="M150 48c18 8 28 22 24 40-20 4-40-2-52-16 6-10 16-18 28-24z" fill="#93c5fd" />
            <path d="M70 58l48-18 48 18-48 16-48-16z" fill="#2563eb" />
            <path d="M78 64v28c14 10 42 10 56 0V64" fill="#1d4ed8" />
            <path d="M166 58c16 2 22 14 16 24" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="184" cy="86" r="5" fill="#f59e0b" />
          </svg>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#2563eb] shadow-sm"><CalendarIcon /></span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Academic</h2>
              </div>
            </div>
            <div className="mt-4"><Steps current={1} /></div>
          </div>
          {tab === "years" ? (
            <button
              type="button"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              style={{ background: blue }}
              onClick={() => { setOpen(true); setFormError(""); }}
            >
              + Create Academic Year
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200">
        {([
          ["years", "Years"],
          ["subjects", "Subjects"],
          ["exams", "Exams"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium ${
              tab === key ? "text-[#2563eb]" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            style={{ borderColor: tab === key ? blue : "transparent" }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}
      {loading ? <p className="text-slate-500">Loading...</p> : null}

      {tab === "years" && !loading ? (
        <>
          {!years.length ? <p className="text-slate-500">No academic years yet. Create the first one.</p> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {years.map((year) => (
              <article key={year.id} className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(circle_at_20%_120%,#dbeafe_0,transparent_55%),radial-gradient(circle_at_80%_130%,#bfdbfe_0,transparent_50%)]" />
                <Link to={`/school/academic-years/${year.id}`} className="relative block p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-sky-50 text-[#2563eb]">
                      <CalendarIcon />
                    </div>
                    <span className={`mr-8 rounded-full px-3 py-1 text-xs font-semibold ${
                      year.isCurrent ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"
                    }`}>
                      {year.isCurrent ? "Current Year" : "Previous Year"}
                    </span>
                  </div>
                  <h3 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{year.name}</h3>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <CalendarIcon />
                    {formatDate(year.startDate)} – {formatDate(year.endDate)}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <StackIcon />
                    <span>{sectionCount(year)} Sections</span>
                  </div>
                </Link>
                <div className="absolute right-4 top-4">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/80 hover:text-slate-600"
                    onClick={() => setMenuId(menuId === year.id ? null : year.id)}
                    aria-label="Year menu"
                  >
                    ···
                  </button>
                  {menuId === year.id && !year.isCurrent ? (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => void makeCurrent(year.id)}
                      >
                        Set as current
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {tab === "subjects" && !loading ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link to="/school/subjects" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: blue }}>
              Manage subjects
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {subjects.map((subject) => (
              <article key={subject.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="font-semibold text-slate-900">{subject.name}</div>
                <div className="text-sm text-slate-500">{subject.code}</div>
              </article>
            ))}
            {!subjects.length ? <p className="text-slate-500">No subjects yet.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === "exams" && !loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Open exams to create papers and review results for the current year.</p>
          <Link to="/school/exams" className="mt-4 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: blue }}>
            Go to Exams
          </Link>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={closeModal}>
          <form
            onSubmit={createYear}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-slate-900">Create Academic Year</h3>
            <p className="mt-1 text-sm text-slate-500">Add a new academic year for this school.</p>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Academic Year Name <span className="text-rose-500">*</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="2027-2028"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Start Date <span className="text-rose-500">*</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                End Date <span className="text-rose-500">*</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
            </div>
            {formError ? <p className="mt-4 text-sm text-rose-600">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                style={{ background: blue }}
              >
                {saving ? "Creating..." : "Create Academic Year"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
    <div className="space-y-5">
      <div>
        <Link to="/school/academic-years" className="text-sm text-[#2563eb] hover:underline">← Academic years</Link>
        <div className="mt-3"><Steps current={2} /></div>
        <p className="mt-2 text-sm text-slate-500">Choose a class, for example Form 1. Sections open next.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Classes · {year?.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open a class (Form / Class). Sections open on the next screen.
            </p>
          </div>
          <button
            type="button"
            disabled={!remainingLevels.length}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: blue }}
            onClick={() => setShowCreate((current) => !current)}
          >
            + Create class
          </button>
        </div>

        {showCreate && remainingLevels.length ? (
          <form onSubmit={addClass} className="mt-5 space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <p className="text-sm text-slate-600">Create the class or form only. Add sections after you open it.</p>
            <label className="block text-sm font-medium text-slate-700 md:max-w-sm">
              Class / Form
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={level} onChange={(event) => setLevel(event.target.value)}>
                {remainingLevels.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </label>
            <button className="rounded-xl px-4 py-2.5 font-semibold text-white" style={{ background: blue }}>Create class</button>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-red-600">{error}</p> : null}

        <div className="mt-6 space-y-6">
          {bands.map(([band, classes]) => (
            <div key={band}>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">{band}</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {classes.map((item) => (
                  <Link
                    key={item.id}
                    to={`/school/classes/${item.id}`}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-50">
                        <GradCapIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-slate-900">{item.label}</div>
                        <div className="text-sm text-slate-500">
                          {item.sectionCount} section{item.sectionCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-[#2563eb]">
                      Open class →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!bands.length ? <p className="text-slate-500">No classes yet. Create Form 1 / Class 1 first.</p> : null}
        </div>
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

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-sm text-[#2563eb] hover:underline" to={`/school/academic-years/${data.academicYear.id}`}>
          ← Back to classes
        </Link>
        <div className="mt-3"><Steps current={3} /></div>
        <p className="mt-2 text-sm text-slate-500">{data.academicYear.name} → {data.label}. Choose one section to open its student list.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sections · {data.label}</h2>
            <p className="mt-1 text-sm text-slate-500">Open a section to see its students.</p>
          </div>
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: blue }}
            onClick={() => setShowAdd((current) => !current)}
          >
            + Add section
          </button>
        </div>

        {showAdd ? (
          <form onSubmit={addSection} className="mt-4 space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <label className="block text-sm font-medium text-slate-700 md:max-w-xs">
              Section name
              <input className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" placeholder="A" value={sectionName} onChange={(event) => setSectionName(event.target.value)} required />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: blue }}>Save section</button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                onClick={() => setShowSubjects((current) => !current)}
              >
                {showSubjects ? "Hide subjects" : "Add subjects now"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Subjects are optional. Save the section now and add them later.</p>
            {showSubjects ? (
              <div>
                <p className="text-sm font-medium text-slate-700">Subjects</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {subjects.map((subject) => (
                    <label key={subject.id} className={`rounded-full border px-3 py-1 text-sm ${selectedSubjectIds.includes(subject.id) ? "border-blue-300 bg-white text-[#2563eb]" : "border-slate-200 bg-white text-slate-700"}`}>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedSubjectIds.includes(subject.id)}
                        onChange={() => setSelectedSubjectIds((current) => current.includes(subject.id) ? current.filter((id) => id !== subject.id) : [...current, subject.id])}
                      />
                      {subject.name}
                    </label>
                  ))}
                  {!subjects.length ? <p className="text-sm text-slate-500">No subjects yet.</p> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    New subject
                    <input className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5" placeholder="Subject name" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} />
                  </label>
                  <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => void createSubject()}>Create subject</button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    onClick={() => setSelectedSubjectIds([])}
                  >
                    Clear subjects
                  </button>
                </div>
              </div>
            ) : null}
          </form>
        ) : null}
        {error ? <p className="mt-3 text-red-600">{error}</p> : null}

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.sections.map((section) => (
            <Link
              key={section.id}
              to={`/school/sections/${section.id}`}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-50">
                  <GradCapIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-slate-900">Section {section.name}</div>
                  <div className="text-sm text-slate-500">{section.studentCount} students</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-[#2563eb]">
                Open section →
              </div>
            </Link>
          ))}
        </div>
        {!data.sections.length ? <p className="mt-4 text-slate-500">No sections yet.</p> : null}
      </div>
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
    <div className="space-y-5">
      <div>
        <Link className="text-sm text-[#2563eb] hover:underline" to={`/school/classes/${data.classGroupId}`}>
          ← Back to sections
        </Link>
        <div className="mt-3"><Steps current={4} /></div>
        <p className="mt-2 text-sm text-slate-500">
          {data.academicYear.name} → {data.classLabel} → Section {data.name} → Student list
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">{data.label}</h2>
        <p className="mt-1 text-sm text-slate-500">Student list for this section.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm text-slate-500">Students</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{data.totals.students}</p>
          </article>
          <article className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm text-slate-500">Teachers</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{data.totals.teachers}</p>
          </article>
          <article className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm text-slate-500">Subjects</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{data.totals.subjects}</p>
          </article>
        </div>
      </div>

      <div className="flex gap-2">
        {(["students", "teachers", "subjects"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize ${tab === item ? "text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            style={tab === item ? { background: blue } : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      {tab === "students" ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Students in Section {data.name}</h3>
          <DataTable headers={["Profile", "ID", "Name", "Roll", "Parent", ""]} empty={!data.students.length ? "No students in this section yet." : undefined}>
            {data.students.map((student) => (
              <tr key={student.id} className="border-t border-slate-100">
                <td className="px-4 py-3"><Avatar name={student.name} seed={student.permanentId} photoUrl={student.photoUrl} /></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.permanentId}</td>
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">{student.parent ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-[#2563eb]" to={`/school/students/${student.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : null}

      {tab === "teachers" ? (
        <div className="space-y-4">
          <form onSubmit={assignTeacher} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Assign a teacher</h3>
                <p className="text-sm text-slate-500">Choose a teacher already saved, or create a new one, then pick a subject on this section.</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
                <button type="button" className={`rounded-lg px-3 py-1.5 ${teacherMode === "existing" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setTeacherMode("existing")}>Saved teacher</button>
                <button type="button" className={`rounded-lg px-3 py-1.5 ${teacherMode === "new" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setTeacherMode("new")}>New teacher</button>
              </div>
            </div>
            {teacherMode === "existing" ? (
              <label className="mt-4 block text-sm text-slate-600">Teacher
                <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.publicId}</option>)}
                </select>
              </label>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="First name" value={newTeacher.firstName} onChange={(event) => setNewTeacher({ ...newTeacher, firstName: event.target.value })} required />
                <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Last name" value={newTeacher.lastName} onChange={(event) => setNewTeacher({ ...newTeacher, lastName: event.target.value })} required />
                <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Email" type="email" value={newTeacher.email} onChange={(event) => setNewTeacher({ ...newTeacher, email: event.target.value })} required />
                <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Phone" value={newTeacher.phone} onChange={(event) => setNewTeacher({ ...newTeacher, phone: event.target.value })} required />
                <input className="rounded-xl border border-slate-200 px-3 py-2.5 md:col-span-2" placeholder="Qualification" value={newTeacher.qualification} onChange={(event) => setNewTeacher({ ...newTeacher, qualification: event.target.value })} required />
              </div>
            )}
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Subjects for this section</p>
              <p className="text-sm text-slate-500">Only the subjects already assigned to this section are listed.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.subjects.map((subject) => {
                  const selected = teacherSubjectIds.includes(subject.id);
                  return (
                    <label key={subject.id} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2 ${selected ? "border-blue-500" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#2563eb]"
                        checked={selected}
                        onChange={() => setTeacherSubjectIds((current) => selected ? current.filter((id) => id !== subject.id) : [...current, subject.id])}
                      />
                      <span className="text-sm font-medium text-slate-800">{subject.name}{subject.teacher ? ` · ${subject.teacher.name}` : ""}</span>
                    </label>
                  );
                })}
              </div>
              {!data.subjects.length ? <p className="mt-3 text-sm text-slate-500">Assign a subject to this section first.</p> : null}
            </div>
            <button disabled={savingTeacher || !teacherSubjectIds.length} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingTeacher ? "Saving..." : "Assign teacher"}</button>
          </form>
          <DataTable headers={["ID", "Name", "Contact", "Subjects"]} empty={!data.teachers.length ? "No teachers assigned to this section." : undefined}>
            {data.teachers.map((teacher) => (
              <tr key={teacher.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{teacher.publicId}</td>
                <td className="px-4 py-3 font-medium"><Link className="text-blue-700 hover:underline" to={`/school/teachers/${teacher.id}`}>{teacher.name}</Link></td>
                <td className="px-4 py-3">{teacher.phone}<div className="text-xs text-slate-400">{teacher.email}</div></td>
                <td className="px-4 py-3">{teacher.subjects.join(", ") || "—"}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : null}

      {tab === "subjects" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Section Subjects</h3>
              <p className="text-sm text-slate-500">Assign subjects created by the school directly to Section {data.name}.</p>
            </div>
            <button
              type="button"
              disabled={!data.availableSubjects.length}
              className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => { setShowSubjectAssign((current) => !current); setError(""); }}
            >
              + Assign Subjects
            </button>
          </div>

          {showSubjectAssign ? (
            <form onSubmit={assignSubjects} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="font-medium text-slate-900">Available subjects</p>
              <p className="text-sm text-slate-500">Only subjects not already assigned to this section are shown.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.availableSubjects.map((subject) => {
                  const selected = selectedSubjectIds.includes(subject.id);
                  return (
                    <label key={subject.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 ${selected ? "border-blue-500 ring-1 ring-blue-200" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#2563eb]"
                        checked={selected}
                        onChange={() => setSelectedSubjectIds((current) => selected ? current.filter((id) => id !== subject.id) : [...current, subject.id])}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{subject.name}</span>
                        <span className="text-xs text-slate-500">{subject.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { setShowSubjectAssign(false); setSelectedSubjectIds([]); }}>Cancel</button>
                <button disabled={savingSubjects || !selectedSubjectIds.length} className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {savingSubjects ? "Assigning..." : `Assign ${selectedSubjectIds.length || ""} Subject${selectedSubjectIds.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          ) : null}

          <DataTable headers={["Code", "Subject", "Teacher"]} empty={!data.subjects.length ? "No subjects assigned to this section." : undefined}>
            {data.subjects.map((subject) => (
              <tr key={subject.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{subject.code}</td>
                <td className="px-4 py-3 font-medium">{subject.name}</td>
                <td className="px-4 py-3">{subject.teacher ? `${subject.teacher.publicId} · ${subject.teacher.name}` : "Unassigned"}</td>
              </tr>
            ))}
          </DataTable>
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div />
        <div className="flex flex-wrap items-center gap-3">
          <input className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400" placeholder="Search subjects..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => { setAdding(true); setName(""); setError(""); }}>+ Add Subject</button>
        </div>
      </div>
      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {visible.map((subject) => (
          <button key={subject.id} type="button" className={`rounded-2xl px-4 py-8 text-left text-sm font-semibold uppercase tracking-wide text-slate-800 shadow-sm ${pastelFor(subject.id)}`} onClick={() => { setEditing(subject); setEditName(subject.name); setError(""); }}>
            {subject.name}
          </button>
        ))}
      </div>
      {!visible.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">{subjects.length ? "No subjects match that search." : "No subjects yet."}</p> : null}
      {adding ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setAdding(false)}>
          <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={createSubject} onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950">Add subject</h2>
            <p className="mt-1 text-sm text-slate-500">Enter the name of the subject.</p>
            <input className="mt-4 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400" placeholder="Subject name, for example Biology" value={name} onChange={(event) => setName(event.target.value)} required />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" onClick={() => setAdding(false)}>Cancel</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Save subject</button>
            </div>
          </form>
        </div>
      ) : null}
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setEditing(null)}>
          <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={saveEdit} onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-950">Edit subject</h2>
            <p className="mt-1 text-sm text-slate-500">{editing.code}</p>
            <input className="mt-4 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400" value={editName} onChange={(event) => setEditName(event.target.value)} required />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
