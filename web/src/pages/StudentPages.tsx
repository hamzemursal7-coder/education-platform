import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Camera,
  ClipboardList,
  Download,
  Eye,
  GraduationCap,
  Hash,
  IdCard,
  Info,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { PasswordLinkDialog, passwordLinkUrl } from "../components/PasswordLinkDialog";
import { Avatar, DataTable, FeeBadge, initials, avatarTone } from "../components/PeopleList";

type TermSnapshot = {
  average: number | null;
  status: string;
  obtained: number;
  possible: number;
  subjects: Array<{ name: string; marks: number | null; maxMarks: number; pending: boolean; absent: boolean }>;
};

function averageText(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function outcomeTone(code: string) {
  if (code === "RETAINED") return "bg-amber-50 text-amber-800";
  if (code === "PASSED") return "bg-emerald-50 text-emerald-800";
  if (code === "TRANSFERRED") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function statusCaption(status?: string) {
  if (status === "final") return "Final";
  if (status === "provisional") return "Provisional";
  return "Not available";
}

function AverageCard({ label, value, status, tone }: { label: string; value: number | null; status?: string; tone: string }) {
  const caption = status === "final" ? "Final" : status === "provisional" ? "Provisional" : value == null ? "Not available" : "";
  return (
    <article className={`min-w-0 rounded-xl border px-3 py-3 shadow-sm xl:px-4 ${tone}`}>
      <p className="text-[13px] font-medium">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none xl:text-2xl">{value == null ? "—" : `${value}%`}</p>
      {caption ? <p className="mt-1 text-xs font-medium opacity-80">{caption}</p> : null}
    </article>
  );
}

function studentAge(dateOfBirth: string) {
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? `${age}` : "—";
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 text-[13px] text-slate-700">
      <span className="text-blue-600">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function ProfileField({ label, value, wide, tone }: { label: string; value: string; wide?: boolean; tone?: "blue" }) {
  return (
    <div className={`min-w-0 rounded-lg px-2.5 py-2 ${wide ? "col-span-2 xl:col-span-4" : ""} ${tone === "blue" ? "bg-blue-50 ring-1 ring-blue-100" : "bg-slate-50"}`}>
      <dt className={`text-[11px] leading-4 ${tone === "blue" ? "text-blue-700" : "text-slate-500"}`}>{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] font-semibold leading-5 ${tone === "blue" ? "text-blue-950" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}

type Placement = {
  id: string;
  name: string;
  classes: Array<{ id: string; label: string; sections: Array<{ id: string; name: string }> }>;
};

type StudentRow = {
  id: string;
  permanentId: string;
  name: string;
  gender: string;
  status: string;
  enrollmentStatus?: string;
  listStatus?: "ACTIVE" | "RETAINED" | "TRANSFERRED" | "INACTIVE";
  photoUrl: string | null;
  level: string;
  levelCode?: string;
  classGroupId?: string | null;
  sectionId?: string | null;
  section: string;
  year: string;
  rollNumber: number | null;
  parent: string | null;
  parentEmail?: string | null;
  parentPhone: string | null;
  feeBalance: number;
  feeStatus: string;
};

type GuardianHit = { id: string; publicId: string; firstName: string; lastName: string; phone: string; email: string | null };

type StudentListResponse = {
  total: number;
  male: number;
  female: number;
  students: StudentRow[];
};

type YearOption = {
  id: string;
  name: string;
  isCurrent?: boolean;
  classes: Array<{ id: string; level: string; sections: Array<{ id: string; name: string }> }>;
};

type ListFilters = { yearId: string; classId: string; sectionId: string; status: string };

const listStatusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  RETAINED: "bg-orange-50 text-orange-700",
  TRANSFERRED: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-600",
};

const listStatusLabel: Record<string, string> = {
  ACTIVE: "Active",
  RETAINED: "Retained",
  TRANSFERRED: "Transferred",
  INACTIVE: "Inactive",
};

function StudentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${listStatusTone[status] ?? "bg-slate-100 text-slate-600"}`}>
      {listStatusLabel[status] ?? status}
    </span>
  );
}

export function StudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);
  const [levelLabels, setLevelLabels] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<ListFilters>({ yearId: "", classId: "ALL", sectionId: "ALL", status: "ALL" });
  const [applied, setApplied] = useState<ListFilters>({ yearId: "", classId: "ALL", sectionId: "ALL", status: "ALL" });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{ created: number; skipped: Array<{ row: number; name: string; reason: string }> } | null>(null);

  useEffect(() => {
    api<{ years: YearOption[]; levels: Array<{ code: string; label: string }> }>("/api/v1/academic-years")
      .then((data) => {
        setYears(data.years);
        setLevelLabels(Object.fromEntries(data.levels.map((level) => [level.code, level.label])));
        const current = data.years.find((year) => year.isCurrent) ?? data.years[0];
        const next = { yearId: current?.id ?? "", classId: "ALL", sectionId: "ALL", status: "ALL" };
        setDraft(next);
        setApplied(next);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load years."));
  }, []);

  useEffect(() => {
    if (!applied.yearId) return;
    let active = true;
    setRows([]);
    api<StudentListResponse>(`/api/v1/students?academicYearId=${encodeURIComponent(applied.yearId)}`)
      .then((data) => {
        if (active) setRows(data.students);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load students.");
      });
    return () => {
      active = false;
    };
  }, [applied.yearId, reloadKey]);

  const draftYear = years.find((year) => year.id === draft.yearId);
  const classOptions = draftYear?.classes ?? [];
  const sectionOptions = classOptions.find((item) => item.id === draft.classId)?.sections ?? [];
  const scoped = rows.filter((row) => {
    if (applied.classId !== "ALL" && row.classGroupId !== applied.classId) return false;
    if (applied.sectionId !== "ALL" && row.sectionId !== applied.sectionId) return false;
    if (applied.status !== "ALL" && (row.listStatus ?? "ACTIVE") !== applied.status) return false;
    return true;
  });
  const filtered = scoped.filter((row) => {
    const hay = `${row.name} ${row.permanentId} ${row.parent ?? ""} ${row.parentEmail ?? ""} ${row.parentPhone ?? ""}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  }).sort((a, b) => a.level.localeCompare(b.level) || a.section.localeCompare(b.section) || (a.rollNumber ?? 0) - (b.rollNumber ?? 0) || a.name.localeCompare(b.name));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const count = (status: string) => scoped.filter((row) => (row.listStatus ?? "ACTIVE") === status).length;
  const summaryCards = [
    { label: "Total students", value: scoped.length, icon: <Users className="h-4 w-4" />, tone: "bg-blue-50 text-blue-600" },
    { label: "Active", value: count("ACTIVE"), icon: <BadgeCheck className="h-4 w-4" />, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Retained", value: count("RETAINED"), icon: <ClipboardList className="h-4 w-4" />, tone: "bg-orange-50 text-orange-600" },
    { label: "Transferred", value: count("TRANSFERRED"), icon: <ArrowLeftRight className="h-4 w-4" />, tone: "bg-amber-50 text-amber-600" },
    { label: "Inactive", value: count("INACTIVE"), icon: <UserRound className="h-4 w-4" />, tone: "bg-slate-100 text-slate-500" },
  ];
  const appliedYear = years.find((year) => year.id === applied.yearId);
  const appliedClass = appliedYear?.classes.find((item) => item.id === applied.classId);
  const appliedSection = appliedClass?.sections.find((item) => item.id === applied.sectionId);

  function resetFilters() {
    const current = years.find((year) => year.isCurrent) ?? years[0];
    const next = { yearId: current?.id ?? "", classId: "ALL", sectionId: "ALL", status: "ALL" };
    setDraft(next);
    setApplied(next);
    setQ("");
    setPage(1);
  }

  async function downloadSheet(kind: "export" | "template") {
    setError("");
    const sessionKey = sessionStorage.getItem("emp_session") ?? "";
    const params = new URLSearchParams();
    if (kind === "export") {
      if (!applied.yearId) return;
      params.set("academicYearId", applied.yearId);
      if (applied.classId !== "ALL") params.set("classGroupId", applied.classId);
      if (applied.sectionId !== "ALL") params.set("sectionId", applied.sectionId);
    }
    const response = await fetch(kind === "export" ? `/api/v1/students/export?${params}` : "/api/v1/students/import-template", {
      credentials: "include",
      headers: sessionKey ? { "X-Session-Key": sessionKey } : undefined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Could not download the file.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = kind === "export" ? "students.xlsx" : "student-import-template.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importSheet(file: File) {
    setImporting(true);
    setError("");
    setImportReport(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const sessionKey = sessionStorage.getItem("emp_session") ?? "";
      const response = await fetch("/api/v1/students/import", {
        method: "POST",
        credentials: "include",
        headers: sessionKey ? { "X-Session-Key": sessionKey } : undefined,
        body,
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; created?: number; skipped?: Array<{ row: number; name: string; reason: string }> } | null;
      if (!response.ok || !payload || typeof payload.created !== "number" || !payload.skipped) {
        throw new Error(payload?.message ?? "Could not import students.");
      }
      setImportReport({ created: payload.created, skipped: payload.skipped });
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import students.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Student list</h2>
          <p className="mt-1 text-sm text-slate-500">Students and their parents in {appliedYear?.name ?? "the selected year"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => downloadSheet("template")}>
            <Download className="h-4 w-4" />
            Template
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => downloadSheet("export")}>
            <Download className="h-4 w-4" />
            Export
          </button>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 ${importing ? "pointer-events-none opacity-60" : ""}`}>
            <Upload className="h-4 w-4" />
            {importing ? "Importing..." : "Import"}
            <input className="hidden" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importSheet(file);
            }} />
          </label>
          <Link className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500" to="/school/students/new">
            <Plus className="h-4 w-4" />
            Add student
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <article key={card.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${card.tone}`}>{card.icon}</div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-5 text-slate-950">{card.value}</p>
              <p className="truncate text-[11px] font-medium text-slate-500">{card.label}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
        <label className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
          <select className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700" value={draft.yearId} onChange={(event) => { setDraft({ yearId: event.target.value, classId: "ALL", sectionId: "ALL", status: draft.status }); }}>
            {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
          </select>
        </label>
        <label className="relative">
          <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
          <select className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700" value={draft.classId} onChange={(event) => setDraft({ ...draft, classId: event.target.value, sectionId: "ALL" })}>
            <option value="ALL">All classes</option>
            {classOptions.map((item) => <option key={item.id} value={item.id}>{levelLabels[item.level] ?? item.level}</option>)}
          </select>
        </label>
        <label className="relative">
          <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
          <select className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700" value={draft.sectionId} disabled={draft.classId === "ALL"} onChange={(event) => setDraft({ ...draft, sectionId: event.target.value })}>
            <option value="ALL">All sections</option>
            {sectionOptions.map((item) => <option key={item.id} value={item.id}>Section {item.name}</option>)}
          </select>
        </label>
        <label className="relative">
          <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
          <select className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="ALL">All students</option>
            <option value="ACTIVE">Active</option>
            <option value="RETAINED">Retained</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => { setApplied(draft); setPage(1); }}>Apply filter</button>
        <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={resetFilters}>Clear</button>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {importReport ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{importReport.created} students added</h3>
              <p className="mt-1 text-sm text-slate-500">{importReport.skipped.length ? `${importReport.skipped.length} rows were skipped.` : "Every row was imported. Parents on the same row were linked, and an existing parent phone was reused."}</p>
            </div>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setImportReport(null)} aria-label="Close import result"><X className="h-4 w-4" /></button>
          </div>
          {importReport.skipped.length ? (
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm text-rose-700">
              {importReport.skipped.map((item) => <li key={`${item.row}-${item.name}`}>Row {item.row}: {item.name} — {item.reason}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="font-semibold text-slate-900">Students ({filtered.length})</h3>
            <p className="text-xs text-slate-500">{appliedClass ? (levelLabels[appliedClass.level] ?? appliedClass.level) : "All classes"}{appliedSection ? ` · Section ${appliedSection.name}` : ""}</p>
          </div>
          <label className="flex min-w-64 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Search name, ID, parent..." value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-sky-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {["Profile", "Student ID", "Roll no.", "Name", "Class / Form", "Section", "Parent / Contact", "Enrollment status", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    {row.photoUrl ? (
                      <button type="button" className="rounded-full ring-2 ring-transparent transition hover:ring-blue-200" title="View photo" onClick={() => setPhotoPreview({ url: row.photoUrl!, name: row.name })}>
                        <Avatar name={row.name} seed={row.permanentId} photoUrl={row.photoUrl} size="sm" />
                      </button>
                    ) : (
                      <Avatar name={row.name} seed={row.permanentId} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600">{row.permanentId}</td>
                  <td className="px-4 py-3 text-slate-600">{row.rollNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-700">{row.level}</td>
                  <td className="px-4 py-3 text-slate-700">{row.section}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.parent ?? "—"}</p>
                    <p className="text-xs text-slate-500">{row.parentPhone || row.parentEmail || "—"}</p>
                  </td>
                  <td className="px-4 py-3"><StudentStatusBadge status={row.listStatus ?? "ACTIVE"} /></td>
                  <td className="px-4 py-3">
                    <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700" to={`/school/students/${row.id}`}>
                      <Eye className="h-4 w-4" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="px-4 py-10 text-center text-sm text-slate-500">No students match these filters.</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{filtered.length ? `Showing ${(currentPage - 1) * 10 + 1} to ${Math.min(currentPage * 10, filtered.length)} of ${filtered.length} students` : "Showing 0 students"}</span>
          <div className="flex items-center gap-1">
            <span className="mr-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">10 per page</span>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">‹</button>
            {listPages(currentPage, pageCount).map((item, index) => (
              item === "…" ? (
                <span key={`gap-${index}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button key={item} type="button" className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold ${item === currentPage ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`} onClick={() => setPage(item)}>{item}</button>
              )
            ))}
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page">›</button>
          </div>
        </div>
      </section>
      {photoPreview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" onClick={() => setPhotoPreview(null)}>
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">{photoPreview.name}</p>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setPhotoPreview(null)} aria-label="Close photo"><X className="h-5 w-5" /></button>
            </div>
            <img src={photoPreview.url} alt={photoPreview.name} className="max-h-[75vh] w-full bg-slate-100 object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function listPages(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const items: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

function FormCard({
  icon,
  title,
  subtitle,
  extra,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">{icon}</div>
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400";

export function NewStudentPage() {
  const navigate = useNavigate();
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    fatherName: "",
    grandfatherName: "",
    gender: "",
    dateOfBirth: "",
    phone: "",
    nationalId: "",
  });
  const [parentMode, setParentMode] = useState<"skip" | "search" | "new">("search");
  const [guardianQuery, setGuardianQuery] = useState("");
  const [hits, setHits] = useState<GuardianHit[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [guardian, setGuardian] = useState({
    firstName: "",
    lastName: "",
    relationship: "MOTHER",
    phone: "",
    email: "",
    nationalId: "",
  });
  const [previousSchools, setPreviousSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [previousSchoolId, setPreviousSchoolId] = useState("");
  const [previous, setPrevious] = useState({
    className: "",
    leavingYear: "",
    transferNo: "",
  });
  const [notes, setNotes] = useState("");
  const [isTransfer, setIsTransfer] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Array<{ id: string; name: string; code: string }>>("/api/v1/previous-schools").then(setPreviousSchools).catch(() => setPreviousSchools([]));
    api<Placement[]>("/api/v1/placement").then((years) => {
      setPlacement(years);
      const current = years[0];
      if (current) setYearId(current.id);
    });
  }, []);

  const year = placement.find((item) => item.id === yearId);
  const classGroup = year?.classes.find((item) => item.id === classId);

  useEffect(() => {
    if (parentMode !== "search" || guardianId || guardianQuery.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      api<GuardianHit[]>(`/api/v1/guardians?q=${encodeURIComponent(guardianQuery)}`).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [guardianQuery, guardianId, parentMode]);

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      let guardianPayload: Record<string, string> | null = null;
      if (parentMode === "search" && !guardianId) {
        setError("Choose a parent, or select Skip for now.");
        return;
      }
      if (parentMode === "search" && guardianId) {
        guardianPayload = { id: guardianId, relationship: guardian.relationship || "GUARDIAN" };
      } else if (parentMode === "new") {
        if (!guardian.firstName || !guardian.lastName) {
          setError("Fill the parent first and last name, or skip the parent for now.");
          return;
        }
        guardianPayload = guardian;
      }
      const localPhone = form.phone.trim();
      const phone = localPhone ? (localPhone.startsWith("+") ? localPhone : `+252${localPhone.replace(/\s/g, "")}`) : "";
      const created = await api<{ id: string }>("/api/v1/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          phone,
          academicYearId: yearId,
          sectionId,
          guardian: guardianPayload,
          previousSchoolId: isTransfer ? previousSchoolId : "",
          previousClass: isTransfer ? previous.className : "",
          leavingYear: isTransfer ? previous.leavingYear : "",
          transferCertificateNo: isTransfer ? previous.transferNo : "",
          notes,
        }),
      });
      if (photoFile) {
        const body = new FormData();
        body.append("file", photoFile);
        const sessionKey = sessionStorage.getItem("emp_session") ?? "";
        const uploaded = await fetch(`/api/v1/students/${created.id}/photo`, {
          method: "POST",
          credentials: "include",
          headers: sessionKey ? { "X-Session-Key": sessionKey } : undefined,
          body,
        });
        if (!uploaded.ok) {
          navigate(`/school/students/${created.id}`);
          return;
        }
      }
      navigate(`/school/students/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register the student.");
    }
  }

  const parentLabel = guardian.relationship === "FATHER" ? "Father" : guardian.relationship === "MOTHER" ? "Mother" : "Guardian";
  const parentInitials = `${guardian.firstName[0] ?? ""}${guardian.lastName[0] ?? ""}`.toUpperCase() || "P";

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Student</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Add New Student</h2>
          <p className="mt-1 text-sm text-slate-500">Enter student details and assign an academic placement. Student ID and roll number are assigned automatically.</p>
        </div>
        <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm" to="/school/students">
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
      </div>

      <FormCard icon={<UserRound className="h-5 w-5" />} title="Student Information" subtitle="Basic identity details for the student record.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">First Name <span className="text-rose-500">*</span>
            <input className={inputClass} placeholder="Enter first name" value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">Father's Name <span className="text-rose-500">*</span>
            <input className={inputClass} placeholder="Enter father's name" value={form.fatherName} onChange={(event) => setField("fatherName", event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">Grandfather's Name <span className="text-rose-500">*</span>
            <input className={inputClass} placeholder="Enter grandfather's name" value={form.grandfatherName} onChange={(event) => setField("grandfatherName", event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">Gender <span className="text-rose-500">*</span>
            <select className={inputClass} value={form.gender} onChange={(event) => setField("gender", event.target.value)} required>
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Date of birth <span className="text-rose-500">*</span>
            <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(event) => setField("dateOfBirth", event.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">NIRA (optional)
            <input className={inputClass} placeholder="Enter NIRA number" value={form.nationalId} onChange={(event) => setField("nationalId", event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Phone Number (optional)
            <span className="mt-1.5 flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-blue-400">
              <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">+252</span>
              <input className="w-full bg-white px-3 py-2.5 text-sm text-slate-800 outline-none" placeholder="Enter phone number" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
            </span>
          </label>
          <div className="text-sm font-medium text-slate-700">Profile Photo (optional)
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-3 py-3">
              {photoPreviewUrl ? <img src={photoPreviewUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-400"><UserRound className="h-5 w-5" /></span>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Upload student photo</p>
                <p className="text-xs font-normal text-slate-400">JPG, PNG (Max 2MB)</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <Upload className="h-3.5 w-3.5" /> Choose File
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                  setPhotoFile(file);
                  setPhotoPreviewUrl(file ? URL.createObjectURL(file) : "");
                }} />
              </label>
            </div>
          </div>
        </div>
      </FormCard>

      <FormCard icon={<GraduationCap className="h-5 w-5" />} title="Academic Placement" subtitle="Place the student in the selected academic year.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Academic Year <span className="text-rose-500">*</span>
            <select className={inputClass} value={yearId} onChange={(event) => { setYearId(event.target.value); setClassId(""); setSectionId(""); }}>
              {placement.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Class / Form <span className="text-rose-500">*</span>
            <select className={inputClass} value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); }} required>
              <option value="">Select class</option>
              {year?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Section <span className="text-rose-500">*</span>
            <select className={inputClass} value={sectionId} onChange={(event) => setSectionId(event.target.value)} required>
              <option value="">Select section</option>
              {classGroup?.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </FormCard>

      <FormCard icon={<Users className="h-5 w-5" />} title="Parent / Guardian Information" subtitle="Link an existing parent or add a new parent. You can also skip this for now.">
        <div className="grid gap-3 md:grid-cols-3">
          {([
            ["search", "Link Existing Parent", "Search and link an existing parent", <Search className="h-4 w-4" />],
            ["new", "Add New Parent", "Create a new parent account", <Plus className="h-4 w-4" />],
            ["skip", "Skip for Now", "Add parent later", <X className="h-4 w-4" />],
          ] as const).map(([mode, title, caption, icon]) => (
            <button key={mode} type="button" className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${parentMode === mode ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`} onClick={() => { setParentMode(mode); if (mode !== "search") setGuardianId(""); }}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${parentMode === mode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="block text-xs text-slate-500">{caption}</span>
              </span>
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${parentMode === mode ? "border-blue-600" : "border-slate-300"}`}>{parentMode === mode ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}</span>
            </button>
          ))}
        </div>
        {parentMode === "skip" ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Parent will not be linked. You can attach one from the student profile later.</p> : null}
        {parentMode === "search" ? (
          <div className="mt-4 space-y-3">
            <label className="text-sm font-medium text-slate-700">Search Parent <span className="text-rose-500">*</span>
              <input className={inputClass} placeholder="Search by parent name, phone number or email..." value={guardianQuery} onChange={(event) => { setGuardianQuery(event.target.value); setGuardianId(""); }} />
            </label>
            {hits.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {hits.map((hit) => (
                  <button type="button" key={hit.id} className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-slate-50" onClick={() => { setGuardianId(hit.id); setGuardian((current) => ({ ...current, firstName: hit.firstName, lastName: hit.lastName, phone: hit.phone, email: hit.email ?? "" })); }}>
                    <span className="font-semibold text-slate-900">{hit.firstName} {hit.lastName}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{hit.publicId} · {hit.phone}{hit.email ? ` · ${hit.email}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {guardianId ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">{parentInitials}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{guardian.firstName} {guardian.lastName}</p>
                  <p className="text-sm text-slate-500">{[guardian.phone, guardian.email].filter(Boolean).join(" · ") || "No contact yet"}</p>
                </div>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" value={guardian.relationship} onChange={(event) => setGuardian({ ...guardian, relationship: event.target.value })}>
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="GUARDIAN">Guardian</option>
                </select>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{parentLabel}</span>
                <button type="button" className="text-sm font-semibold text-blue-600" onClick={() => { setGuardianId(""); setGuardianQuery(""); }}>Change</button>
              </div>
            ) : null}
          </div>
        ) : null}
        {parentMode === "new" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">First name<input className={inputClass} value={guardian.firstName} onChange={(event) => setGuardian({ ...guardian, firstName: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Last name<input className={inputClass} value={guardian.lastName} onChange={(event) => setGuardian({ ...guardian, lastName: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Phone (optional)<input className={inputClass} value={guardian.phone} onChange={(event) => setGuardian({ ...guardian, phone: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Email<input className={inputClass} value={guardian.email} onChange={(event) => setGuardian({ ...guardian, email: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Relationship
              <select className={inputClass} value={guardian.relationship} onChange={(event) => setGuardian({ ...guardian, relationship: event.target.value })}>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">NIRA (optional)<input className={inputClass} placeholder="Leave empty if you do not have it" value={guardian.nationalId} onChange={(event) => setGuardian({ ...guardian, nationalId: event.target.value })} /></label>
          </div>
        ) : null}
      </FormCard>

      <FormCard
        icon={<BookOpen className="h-5 w-5" />}
        title="Previous School (Optional)"
        subtitle="Fill this information if the student is transferring from another school."
        extra={(
          <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600" onClick={() => {
            setIsTransfer((current) => !current);
            setPreviousSchoolId("");
            setPrevious({ className: "", leavingYear: "", transferNo: "" });
          }}>
            <span className={`relative h-6 w-11 rounded-full ${isTransfer ? "bg-blue-600" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${isTransfer ? "left-5" : "left-0.5"}`} /></span>
            This is a transfer student
          </button>
        )}
      >
        {isTransfer ? (
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Previous School Name
              <select className={inputClass} value={previousSchoolId} onChange={(event) => setPreviousSchoolId(event.target.value)}>
                <option value="">Select previous school</option>
                {previousSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Last Class / Form
              <input className={inputClass} placeholder="Enter last class" value={previous.className} onChange={(event) => setPrevious({ ...previous, className: event.target.value })} />
            </label>
            <label className="text-sm font-medium text-slate-700">Leaving year
              <input className={inputClass} placeholder="Enter leaving year" value={previous.leavingYear} onChange={(event) => setPrevious({ ...previous, leavingYear: event.target.value })} />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Transfer certificate no.
              <input className={inputClass} placeholder="Optional" value={previous.transferNo} onChange={(event) => setPrevious({ ...previous, transferNo: event.target.value })} />
            </label>
          </div>
        ) : <p className="text-sm text-slate-400">Turn this on only when the student is coming from another school.</p>}
        <label className="mt-4 block text-sm font-medium text-slate-700">Notes (optional)
          <textarea className={`${inputClass} min-h-20`} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Additional notes..." />
        </label>
      </FormCard>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <Link className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700" to="/school/students">Cancel</Link>
        <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Create Student</button>
      </div>
    </form>
  );
}

type Profile = {
  id: string;
  permanentId: string;
  secondaryPermanentId: string | null;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  gender: string;
  dateOfBirth: string;
  phone: string | null;
  nationalId: string | null;
  previousSchool: { id: string; name: string; code: string } | null;
  previousClass: string | null;
  leavingYear: string | null;
  transferCertificateNo: string | null;
  staffNotes: string | null;
  status: string;
  school?: { id: string; name: string };
  portalStatus: string;
  hasLogin: boolean;
  photoUrl: string | null;
  guardians: Array<{
    relationship: string;
    guardian: {
      id: string;
      publicId: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
      nationalId: string | null;
      dateOfBirth?: string | null;
      photoUrl?: string | null;
      user: { email: string; status: string } | null;
    };
  }>;
  attendanceStats: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    rate: number | null;
  };
  averages: { term1: number | null; term2: number | null; combined: number | null; term1Status?: string; term2Status?: string; combinedStatus?: string; year?: string | null; level?: string | null; section?: string | null; outcome?: string | null };
  placement: { enrollmentId: string; year: string; sectionId: string; sections: Array<{ id: string; label: string }> } | null;
  fees: Array<{
    id: string;
    title: string;
    type: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
    year: string;
    payments: Array<{ receiptNumber: string; amount: number }>;
  }>;
  transfers: Array<{ id: string; status: string; note: string | null; createdAt: string }>;
  alumniRecords: Array<{ fromLevel: string; schoolName: string; reason: string; createdAt: string }>;
  timeline: Array<{ at: string; type: string; label: string }>;
  enrollments: Array<{
    id: string;
    schoolName: string;
    status: string;
    outcome?: { code: string; label: string; detail: string };
    examination?: {
      term1: TermSnapshot;
      term2: TermSnapshot;
      overall: { average: number | null; status: string; obtained: number; possible: number };
    } | null;
    level: string;
    rollNumber: number;
    studentNumber: string;
    academicYear: { name: string };
    section: { id: string; name: string };
    subjects: Array<{
      id: string;
      name: string;
      teacher: string | null;
      result: string;
      terms: Array<{ term: string; result: string }>;
    }>;
    attendance: Array<{ date: string; session: string; status: string }>;
  }>;
};

const tabs = ["Overview", "Academics", "Attendance", "Finances", "Documents", "Timeline"] as const;

type DocRow = {
  id: string;
  kind: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  rejectReason: string | null;
};

type AssignableTeacher = {
  id: string;
  publicId: string;
  name: string;
  isActive: boolean;
  status: string;
};

export function StudentProfilePage() {
  const { studentId } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docKind, setDocKind] = useState("BIRTH_CERTIFICATE");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState<{ url: string; email?: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [placementSection, setPlacementSection] = useState("");
  const [moveClass, setMoveClass] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState(false);
  const [assignableTeachers, setAssignableTeachers] = useState<AssignableTeacher[]>([]);
  const [assignTarget, setAssignTarget] = useState<{ sectionId: string; subjectId: string; subjectName: string } | null>(null);
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previousSchools, setPreviousSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [editForm, setEditForm] = useState({
    firstName: "",
    fatherName: "",
    grandfatherName: "",
    phone: "",
    nationalId: "",
    gender: "MALE",
    dateOfBirth: "",
    notes: "",
    previousClass: "",
    leavingYear: "",
    transferCertificateNo: "",
    previousSchoolId: "",
  });
  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianHits, setGuardianHits] = useState<Array<{ id: string; publicId: string; firstName: string; lastName: string; phone: string; email: string | null; portalStatus?: string; photoUrl?: string | null }>>([]);
  const [parentAssignMode, setParentAssignMode] = useState<"search" | "new">("search");
  const [relationship, setRelationship] = useState("GUARDIAN");
  const [newGuardian, setNewGuardian] = useState({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", nationalId: "" });
  const [parentPhoto, setParentPhoto] = useState<File | null>(null);
  const [parentPhotoPreview, setParentPhotoPreview] = useState("");

  async function loadProfile() {
    if (!studentId) return;
    const data = await api<Profile>(`/api/v1/students/${studentId}`);
    setProfile(data);
    setEditForm({
      firstName: data.firstName,
      fatherName: data.fatherName,
      grandfatherName: data.grandfatherName,
      phone: data.phone ?? "",
      nationalId: data.nationalId ?? "",
      gender: data.gender,
      dateOfBirth: data.dateOfBirth.slice(0, 10),
      notes: data.staffNotes ?? "",
      previousClass: data.previousClass ?? "",
      leavingYear: data.leavingYear ?? "",
      transferCertificateNo: data.transferCertificateNo ?? "",
      previousSchoolId: data.previousSchool?.id ?? "",
    });
  }

  async function loadDocs() {
    if (!studentId) return;
    setDocs(await api<DocRow[]>(`/api/v1/students/${studentId}/documents`));
  }

  useEffect(() => {
    loadProfile().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the student."));
    loadDocs().catch(() => undefined);
    api<Array<{ id: string; name: string; code: string }>>("/api/v1/previous-schools").then(setPreviousSchools).catch(() => setPreviousSchools([]));
  }, [studentId]);

  async function uploadPhoto(file: File | null) {
    if (!file || !studentId) return;
    setPhotoBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/v1/students/${studentId}/photo`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Photo upload failed.");
      }
      setMessage("Photo updated.");
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo upload failed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function openTeacherAssignment(sectionId: string, subjectId: string, subjectName: string) {
    setError("");
    try {
      const teachers = assignableTeachers.length
        ? assignableTeachers
        : await api<AssignableTeacher[]>("/api/v1/teachers");
      const available = teachers.filter((teacher) => teacher.isActive);
      setAssignableTeachers(teachers);
      setAssignTeacherId(available[0]?.id ?? "");
      setAssignTarget({ sectionId, subjectId, subjectName });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load teachers.");
    }
  }

  async function assignTeacher(event: React.FormEvent) {
    event.preventDefault();
    if (!assignTarget || !assignTeacherId) return;
    setAssigningTeacher(true);
    setError("");
    try {
      await api("/api/v1/teacher-assignments", {
        method: "POST",
        body: JSON.stringify({
          teacherId: assignTeacherId,
          sectionId: assignTarget.sectionId,
          subjectId: assignTarget.subjectId,
        }),
      });
      setAssignTarget(null);
      setMessage("Teacher assigned successfully.");
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign the teacher.");
    } finally {
      setAssigningTeacher(false);
    }
  }

  if (error && !profile) return <p className="text-red-600">{error}</p>;
  if (!profile) return <p className="text-slate-500">Loading student...</p>;
  const current = profile.enrollments.find((item) => item.status === "ACTIVE") ?? profile.enrollments[0];
  const age = studentAge(profile.dateOfBirth);
  const fullName = `${profile.firstName} ${profile.fatherName} ${profile.grandfatherName}`;

  const iconSm = "h-4 w-4";

  return (
    <div className="w-full min-w-0 space-y-4">
      <article className="flex min-h-[120px] flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm xl:min-h-[140px]">
        <div className="relative shrink-0">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className={`grid h-16 w-16 place-items-center rounded-full text-lg font-semibold text-white ${avatarTone(profile.permanentId)}`}>
              {initials(fullName)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-slate-950">{fullName}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetaChip icon={<IdCard className="h-3.5 w-3.5" />} label={profile.permanentId} />
            <MetaChip icon={<BadgeCheck className="h-3.5 w-3.5" />} label={profile.status} />
            {current ? <MetaChip icon={<BookOpen className="h-3.5 w-3.5" />} label={`${current.level} · ${current.section.name}`} /> : null}
            {current ? <MetaChip icon={<Hash className="h-3.5 w-3.5" />} label={`Roll ${current.rollNumber}`} /> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-9 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700" onClick={() => {
              const email = profile.hasLogin ? undefined : window.prompt("Student email for portal invite:") || undefined;
              if (!profile.hasLogin && profile.portalStatus === "NONE" && !email) return;
              api<{ setPasswordPath: string }>(`/api/v1/students/${studentId}/access`, { method: "POST", body: JSON.stringify({ email }) })
                .then((result) => setPasswordLink({ url: passwordLinkUrl(result.setPasswordPath), email }))
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
            }}>{profile.hasLogin ? "Reset password" : "Invite login"}</button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500">
            <Upload className={iconSm} />
            {photoBusy ? "Uploading..." : "Upload photo"}
            <input
              className="hidden"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={photoBusy}
              onChange={(event) => {
                void uploadPhoto(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          </div>
        </div>
      </article>

      <div className="grid gap-4">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-800 shadow-sm md:p-5">
          <h3 className="text-base font-semibold text-slate-950">Student profile</h3>
          <p className="mt-1 text-[13px] text-slate-500">ID, age, roll, class, and the rest of this student's record. Edit the details here.</p>
          {editing ? (
            <form className="mt-4" onSubmit={(event) => {
              event.preventDefault();
              api(`/api/v1/students/${studentId}`, { method: "PATCH", body: JSON.stringify(editForm) })
                .then(() => { setEditing(false); setMessage("Student details updated."); return loadProfile(); })
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update the student."));
            }}>
              <div className="grid grid-cols-1 gap-x-3 gap-y-3 md:grid-cols-2 md:gap-x-5 xl:grid-cols-4">
                <label className="text-sm text-slate-600">First name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required /></label>
                <label className="text-sm text-slate-600">Father name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.fatherName} onChange={(event) => setEditForm({ ...editForm, fatherName: event.target.value })} required /></label>
                <label className="text-sm text-slate-600">Grandfather name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.grandfatherName} onChange={(event) => setEditForm({ ...editForm, grandfatherName: event.target.value })} required /></label>
                <label className="text-sm text-slate-600">Phone<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Phone" /></label>
                <label className="text-sm text-slate-600">Gender
                  <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.gender} onChange={(event) => setEditForm({ ...editForm, gender: event.target.value })}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </label>
                <label className="text-sm text-slate-600">Date of birth<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" type="date" value={editForm.dateOfBirth} onChange={(event) => setEditForm({ ...editForm, dateOfBirth: event.target.value })} required /></label>
                <label className="text-sm text-slate-600">NIRA (optional)<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.nationalId} onChange={(event) => setEditForm({ ...editForm, nationalId: event.target.value })} placeholder="Leave empty if you do not have it" /></label>
                <label className="text-sm text-slate-600">Previous school
                  <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.previousSchoolId} onChange={(event) => setEditForm({ ...editForm, previousSchoolId: event.target.value })}>
                    <option value="">None</option>
                    {previousSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-600">Previous class<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.previousClass} onChange={(event) => setEditForm({ ...editForm, previousClass: event.target.value })} /></label>
                <label className="text-sm text-slate-600">Leaving year<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.leavingYear} onChange={(event) => setEditForm({ ...editForm, leavingYear: event.target.value })} /></label>
                <label className="text-sm text-slate-600">Transfer certificate<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.transferCertificateNo} onChange={(event) => setEditForm({ ...editForm, transferCertificateNo: event.target.value })} /></label>
                <label className="text-[13px] text-slate-600 md:col-span-2 xl:col-span-4">Notes<textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 md:gap-3 xl:grid-cols-4">
              <ProfileField label="Student ID" value={profile.permanentId} />
              {profile.secondaryPermanentId ? <ProfileField label="Secondary ID" value={profile.secondaryPermanentId} tone="blue" /> : null}
              <ProfileField label="Age" value={age} />
              <ProfileField label="Roll" value={current ? String(current.rollNumber) : "—"} />
              <ProfileField label="Student number" value={current?.studentNumber || "—"} />
              <ProfileField label="Class" value={current?.level || "—"} />
              <ProfileField label="Section" value={current ? current.section.name : "—"} />
              <ProfileField label="Academic year" value={current?.academicYear.name || "—"} />
              <ProfileField label="School" value={profile.school?.name || "—"} />
              <ProfileField label="Status" value={profile.status} />
              <ProfileField label="First name" value={profile.firstName} />
              <ProfileField label="Father name" value={profile.fatherName} />
              <ProfileField label="Grandfather name" value={profile.grandfatherName} />
              <ProfileField label="Gender" value={profile.gender} />
              <ProfileField label="Date of birth" value={profile.dateOfBirth.slice(0, 10)} />
              <ProfileField label="Phone" value={profile.phone || "—"} />
              <ProfileField label="NIRA" value={profile.nationalId || "—"} />
              <ProfileField label="Parent" value={profile.guardians.length ? profile.guardians.map((link) => `${link.guardian.firstName} ${link.guardian.lastName}`).join(", ") : "Not linked"} />
              {profile.previousSchool ? <ProfileField label="Previous school" value={profile.previousSchool.name} tone="blue" /> : null}
              {profile.previousSchool && profile.previousClass ? <ProfileField label="Previous class" value={profile.previousClass} tone="blue" /> : null}
              {profile.previousSchool && profile.leavingYear ? <ProfileField label="Leaving year" value={profile.leavingYear} tone="blue" /> : null}
              {profile.previousSchool && profile.transferCertificateNo ? <ProfileField label="Transfer certificate" value={profile.transferCertificateNo} tone="blue" /> : null}
              {profile.staffNotes ? <ProfileField label="Notes" value={profile.staffNotes} wide /> : null}
            </dl>
          )}
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Users className="h-4 w-4" /></span>
              <div>
                <h3 className="text-base font-semibold text-slate-950">Parent</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">Link an existing parent, or add a new parent.</p>
              </div>
            </div>
            <p className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-700"><Info className="h-3.5 w-3.5" /> A student can be linked to one or more parents or guardians.</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button type="button" className={`min-h-16 rounded-xl border px-3 py-2 text-left ${parentAssignMode === "search" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`} onClick={() => setParentAssignMode("search")}>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Search className="h-4 w-4 text-blue-600" /> Link to an existing parent</span>
              <span className="mt-0.5 block text-[13px] text-slate-500">Search and link an existing parent.</span>
            </button>
            <button type="button" className={`min-h-16 rounded-xl border px-3 py-2 text-left ${parentAssignMode === "new" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`} onClick={() => { setParentAssignMode("new"); setGuardianHits([]); }}>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Plus className="h-4 w-4 text-blue-600" /> Add new parent</span>
              <span className="mt-0.5 block text-[13px] text-slate-500">Create a new parent and link to this student.</span>
            </button>
          </div>
          {parentAssignMode === "search" ? (
            <section className="mt-4 rounded-2xl border border-slate-200 p-4">
              <h4 className="flex items-center gap-2 font-semibold text-slate-950"><Search className="h-4 w-4 text-blue-600" /> Link to an existing parent</h4>
              <p className="mt-1 text-sm text-slate-500">Search by name, email, parent ID, or phone number to link an existing parent.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <input className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3" placeholder="Name, email, parent ID, or phone number..." value={guardianQuery} onChange={(event) => setGuardianQuery(event.target.value)} />
                <select className="h-10 rounded-xl border border-slate-200 px-3" value={relationship} onChange={(event) => setRelationship(event.target.value)}>
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="GUARDIAN">Guardian</option>
                </select>
                <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" onClick={async () => {
                  setError("");
                  try {
                    const hits = await api<typeof guardianHits>(`/api/v1/guardians?q=${encodeURIComponent(guardianQuery)}`);
                    setGuardianHits(hits);
                    if (!hits.length) setError("No parent matched that search.");
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Could not search parents.");
                  }
                }}><Search className="h-4 w-4" /> Search</button>
              </div>
              <div className="mt-3 space-y-2">
                {guardianHits.map((hit) => (
                  <div key={hit.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                    {hit.photoUrl
                      ? <img src={hit.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white ${avatarTone(hit.publicId)}`}>{initials(`${hit.firstName} ${hit.lastName}`)}</span>}
                    <div className="min-w-0 flex-1">
                      <Link to={`/school/parents/${hit.id}`} className="font-semibold text-slate-950 hover:text-blue-700 hover:underline">{hit.firstName} {hit.lastName}</Link>
                      <p className="text-sm text-slate-500">{hit.publicId} · {hit.phone}{hit.email ? ` · ${hit.email}` : ""}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Portal {hit.portalStatus ?? "NONE"}</span>
                    <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={async () => {
                      setError("");
                      try {
                        await api(`/api/v1/students/${profile.id}/guardians`, { method: "POST", body: JSON.stringify({ guardianId: hit.id, relationship }) });
                        setMessage("Parent linked.");
                        setGuardianHits([]);
                        setGuardianQuery("");
                        await loadProfile();
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Could not link the parent.");
                      }
                    }}>Link</button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-4">
                {parentPhotoPreview
                  ? <img src={parentPhotoPreview} alt="" className="h-16 w-16 rounded-full object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-200 text-slate-500"><UserRound className="h-7 w-7" /></span>}
                <div>
                  <p className="text-sm font-semibold text-slate-900">Parent photo</p>
                  <p className="text-xs text-slate-500">Upload a profile image (optional).</p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-700">
                    <Camera className="h-4 w-4" /> Upload photo
                    <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > 2 * 1024 * 1024) {
                        setError("Photo must be 2 MB or smaller.");
                        return;
                      }
                      setParentPhoto(file);
                      setParentPhotoPreview(file ? URL.createObjectURL(file) : "");
                    }} />
                  </label>
                  <p className="text-xs text-slate-400">JPG, PNG (max 2MB)</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">First name *
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Enter parent first name" value={newGuardian.firstName} onChange={(event) => setNewGuardian({ ...newGuardian, firstName: event.target.value })} required />
                </label>
                <label className="text-sm font-medium text-slate-700">Last name *
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Enter parent last name" value={newGuardian.lastName} onChange={(event) => setNewGuardian({ ...newGuardian, lastName: event.target.value })} required />
                </label>
                <label className="text-sm font-medium text-slate-700">Date of birth (optional)
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" type="date" value={newGuardian.dateOfBirth} onChange={(event) => setNewGuardian({ ...newGuardian, dateOfBirth: event.target.value })} />
                </label>
                <label className="text-sm font-medium text-slate-700">NIRA number (optional)
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Enter NIRA number" value={newGuardian.nationalId} onChange={(event) => setNewGuardian({ ...newGuardian, nationalId: event.target.value })} />
                </label>
                <label className="text-sm font-medium text-slate-700">Mobile number (optional)
                  <span className="mt-1.5 flex overflow-hidden rounded-xl border border-slate-200">
                    <span className="grid place-items-center bg-slate-50 px-3 text-sm text-slate-600">+252</span>
                    <input className="w-full px-3 py-2.5" placeholder="61 234 5678" value={newGuardian.phone} onChange={(event) => setNewGuardian({ ...newGuardian, phone: event.target.value })} />
                  </span>
                </label>
                <label className="text-sm font-medium text-slate-700">Email address (optional)
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Enter email address" value={newGuardian.email} onChange={(event) => setNewGuardian({ ...newGuardian, email: event.target.value })} />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">Relationship *
                  <select className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={relationship} onChange={(event) => setRelationship(event.target.value)}>
                    <option value="GUARDIAN">Guardian</option>
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                  </select>
                </label>
                <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white sm:col-span-2" onClick={async () => {
                  setError("");
                  const localPhone = newGuardian.phone.replace(/\s+/g, "").replace(/^\+?252/, "");
                  const phone = localPhone ? `+252${localPhone}` : "";
                  try {
                    const created = await api<{ id: string }>("/api/v1/parents", {
                      method: "POST",
                      body: JSON.stringify({
                        firstName: newGuardian.firstName,
                        lastName: newGuardian.lastName,
                        phone,
                        email: newGuardian.email,
                        dateOfBirth: newGuardian.dateOfBirth,
                        nationalId: newGuardian.nationalId,
                      }),
                    });
                    if (parentPhoto) {
                      const body = new FormData();
                      body.append("file", parentPhoto);
                      const uploaded = await fetch(`/api/v1/parents/${created.id}/photo`, { method: "POST", credentials: "include", body });
                      if (!uploaded.ok) {
                        const payload = (await uploaded.json().catch(() => null)) as { message?: string } | null;
                        throw new Error(payload?.message ?? "Parent was created, but the photo was not saved.");
                      }
                    }
                    await api(`/api/v1/students/${profile.id}/guardians`, { method: "POST", body: JSON.stringify({ guardianId: created.id, relationship }) });
                    setNewGuardian({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", nationalId: "" });
                    setParentPhoto(null);
                    setParentPhotoPreview("");
                    setMessage("Parent added and linked.");
                    await loadProfile();
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Could not add the parent.");
                  }
                }}><Plus className="h-4 w-4" /> Create and link parent</button>
              </div>
            </section>
          )}
          <section className="mt-3 rounded-xl border border-slate-200 p-3">
            <h4 className="text-base font-semibold text-slate-950">Linked parent{profile.guardians.length === 1 ? "" : "s"} <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{profile.guardians.length}</span></h4>
            <p className="mt-0.5 text-[13px] text-slate-500">Parent(s) linked to this student.</p>
            <div className="mt-2 space-y-2">
              {profile.guardians.map((link) => (
                <div key={link.guardian.publicId} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-3 py-3">
                  <Link to={`/school/parents/${link.guardian.id}`} className="shrink-0">
                    {link.guardian.photoUrl
                      ? <img src={link.guardian.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white ${avatarTone(link.guardian.publicId)}`}>{initials(`${link.guardian.firstName} ${link.guardian.lastName}`)}</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/school/parents/${link.guardian.id}`} className="font-semibold text-slate-950 hover:text-blue-700 hover:underline">{link.guardian.firstName} {link.guardian.lastName}</Link>
                    <p className="text-sm text-slate-500">{[link.guardian.publicId, link.guardian.phone || null, link.guardian.email || link.guardian.user?.email || null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${link.guardian.user ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>Portal {link.guardian.user?.status ?? "NONE"}</span>
                  <select
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    value={["FATHER", "MOTHER", "GUARDIAN"].includes(link.relationship.toUpperCase()) ? link.relationship.toUpperCase() : "GUARDIAN"}
                    onChange={async (event) => {
                      setError("");
                      try {
                        await api(`/api/v1/students/${profile.id}/guardians/${link.guardian.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ relationship: event.target.value }),
                        });
                        await loadProfile();
                        setMessage("Guardian relationship updated.");
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Could not update relationship.");
                      }
                    }}
                  >
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="GUARDIAN">Guardian</option>
                  </select>
                  {!link.guardian.user ? (
                    <button
                      type="button"
                      className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700"
                      onClick={async () => {
                        const email = window.prompt("Parent portal email", link.guardian.email ?? "") ?? "";
                        if (!email) return;
                        try {
                          const invited = await api<{ setPasswordPath: string }>(`/api/v1/guardians/${link.guardian.id}/invite`, {
                            method: "POST",
                            body: JSON.stringify({ email }),
                          });
                          setPasswordLink({ url: passwordLinkUrl(invited.setPasswordPath), email });
                          await loadProfile();
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "Could not invite the parent.");
                        }
                      }}
                    >
                      Invite
                    </button>
                  ) : null}
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-rose-100 text-rose-600" aria-label={`Remove ${link.guardian.firstName}`} onClick={async () => {
                    setError("");
                    try {
                      await api(`/api/v1/students/${profile.id}/guardians/${link.guardian.id}`, { method: "DELETE" });
                      setMessage("Parent unlinked.");
                      await loadProfile();
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "Could not unlink the parent.");
                    }
                  }}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {!profile.guardians.length ? <p className="text-sm text-slate-500">No parent is linked yet.</p> : null}
            </div>
          </section>
        </article>
      </div>

      <div>
        <p className="mb-2 text-[13px] text-slate-500">{profile.averages?.year ? `${profile.averages.year} · ${profile.averages.level} · Section ${profile.averages.section}${profile.averages.outcome ? ` · ${profile.averages.outcome}` : ""}` : "No published year average yet."}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AverageCard label="Term 1 average" value={profile.averages?.term1 ?? null} status={profile.averages?.term1Status} tone="border-blue-100 bg-blue-50 text-blue-800" />
          <AverageCard label="Term 2 average" value={profile.averages?.term2 ?? null} status={profile.averages?.term2Status} tone="border-violet-100 bg-violet-50 text-violet-800" />
          <AverageCard label="Overall academic year average" value={profile.averages?.combined ?? null} status={profile.averages?.combinedStatus} tone="border-emerald-100 bg-emerald-50 text-emerald-800" />
        </div>
      </div>
      {profile.placement && current ? (
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Move within this school</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">Now {current.level} · Section {current.section.name}. Nothing changes until you confirm.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{profile.school?.name} · {profile.placement.year}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="min-w-0 text-[13px] font-medium text-slate-700">Class / Form
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={moveClass} onChange={(event) => { setMoveClass(event.target.value); setPlacementSection(""); }}>
                <option value="">Select class</option>
                {[...new Set(profile.placement.sections.filter((section) => section.id !== profile.placement?.sectionId).map((section) => section.label.split(" · Section ")[0]))].map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[13px] font-medium text-slate-700">Section
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={placementSection} onChange={(event) => setPlacementSection(event.target.value)} disabled={!moveClass}>
                <option value="">Select section</option>
                {profile.placement.sections.filter((section) => section.id !== profile.placement?.sectionId && section.label.startsWith(`${moveClass} · Section `)).map((section) => <option key={section.id} value={section.id}>{section.label.split(" · Section ")[1] ?? section.label}</option>)}
              </select>
            </label>
            <button type="button" className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!placementSection || placementSection === profile.placement.sectionId} onClick={() => setMoveOpen(true)}>Move student</button>
          </div>
          {!profile.placement.sections.some((section) => section.id !== profile.placement?.sectionId) ? <p className="mt-2 text-[13px] text-amber-800">This year has no other class or section to move to.</p> : null}
        </section>
      ) : null}
      {moveOpen && profile.placement && current ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Confirm this move</h3>
            <p className="mt-1 text-sm text-slate-500">{fullName}</p>
            <p className="text-xs text-slate-400">{profile.permanentId}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
                <p className="mt-2 font-semibold text-slate-950">{current.level}</p>
                <p className="text-sm text-slate-600">Section {current.section.name}</p>
                <p className="mt-1 text-xs text-slate-500">{profile.placement.year}</p>
              </article>
              <article className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Destination</p>
                <p className="mt-2 font-semibold text-slate-950">{profile.placement.sections.find((section) => section.id === placementSection)?.label}</p>
                <p className="mt-1 text-xs text-slate-500">{profile.school?.name} · {profile.placement.year}</p>
              </article>
            </div>
            <p className="mt-4 text-sm text-slate-600">The student stays at this school. Press Move student only after the destination is correct.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setMoveOpen(false)}>Cancel</button>
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={movingStudent || !placementSection} onClick={() => {
                setMovingStudent(true);
                setError("");
                api(`/api/v1/students/${studentId}/placement`, { method: "POST", body: JSON.stringify({ sectionId: placementSection }) })
                  .then(() => {
                    setMoveOpen(false);
                    setPlacementSection("");
                    setMessage("Student moved.");
                    return loadProfile();
                  })
                  .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not move the student."))
                  .finally(() => setMovingStudent(false));
              }}>{movingStudent ? "Moving…" : "Move student"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {message ? <p className="text-blue-600">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      {passwordLink ? <PasswordLinkDialog url={passwordLink.url} email={passwordLink.email} onClose={() => setPasswordLink(null)} /> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === item ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm">
            <p className="text-[13px] text-slate-500">Attendance rate</p>
            <p className="mt-1 text-[22px] font-bold leading-none">{profile.attendanceStats.rate == null ? "—" : `${profile.attendanceStats.rate}%`}</p>
          </article>
          <article className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm">
            <p className="text-[13px] text-slate-500">Fee balance</p>
            <p className="mt-1 text-[22px] font-bold leading-none">{profile.fees.reduce((sum, fee) => sum + fee.balance, 0)}</p>
          </article>
          <article className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm">
            <p className="text-[13px] text-slate-500">Enrollments</p>
            <p className="mt-1 text-[22px] font-bold leading-none">{profile.enrollments.length}</p>
          </article>
          {profile.alumniRecords.map((row) => (
            <article key={row.createdAt} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm sm:col-span-2 xl:col-span-3">
              Alumni: {row.schoolName} · {row.fromLevel} · {row.reason}
            </article>
          ))}
        </div>
      ) : null}

      {tab === "Academics" ? (
        <div className="space-y-6">
          {profile.enrollments.map((enrollment) => {
            const exam = enrollment.examination;
            const markNames = [...new Set([...(exam?.term1.subjects ?? []), ...(exam?.term2.subjects ?? [])].map((subject) => subject.name))].sort((left, right) => left.localeCompare(right));
            const outcome = enrollment.outcome ?? { code: enrollment.status, label: enrollment.status, detail: "" };
            return (
            <div key={enrollment.id} className="space-y-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{enrollment.academicYear.name} · {enrollment.level} · Section {enrollment.section.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{enrollment.schoolName}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${outcomeTone(outcome.code)}`}>{outcome.label}</span>
                </div>
                {outcome.detail ? <p className="mt-3 text-sm text-slate-600">{outcome.detail}</p> : null}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <article className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Term 1 average</p>
                    <p className="mt-1 text-[22px] font-bold leading-none text-slate-950">{averageText(exam?.term1.average ?? null)}</p>
                    <p className="mt-1 text-xs text-slate-500">{exam && exam.term1.possible > 0 ? `${exam.term1.obtained} / ${exam.term1.possible} · ${statusCaption(exam.term1.status)}` : statusCaption(exam?.term1.status)}</p>
                  </article>
                  <article className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Term 2 average</p>
                    <p className="mt-1 text-[22px] font-bold leading-none text-slate-950">{averageText(exam?.term2.average ?? null)}</p>
                    <p className="mt-1 text-xs text-slate-500">{exam && exam.term2.possible > 0 ? `${exam.term2.obtained} / ${exam.term2.possible} · ${statusCaption(exam.term2.status)}` : statusCaption(exam?.term2.status)}</p>
                  </article>
                  <article className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Year average</p>
                    <p className="mt-1 text-[22px] font-bold leading-none text-slate-950">{averageText(exam?.overall.average ?? null)}</p>
                    <p className="mt-1 text-xs text-slate-500">{exam && exam.overall.possible > 0 ? `${exam.overall.obtained} / ${exam.overall.possible} · ${statusCaption(exam.overall.status)}` : statusCaption(exam?.overall.status)}</p>
                  </article>
                </div>
              </section>
              <div className="grid gap-4 xl:grid-cols-2">
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><BookOpen className="h-5 w-5" /></span>
                      <div>
                        <h3 className="font-semibold text-slate-950">Subjects & Teachers</h3>
                        <p className="text-xs text-slate-500">Subjects enrolled for {enrollment.academicYear.name} ({enrollment.level} {enrollment.section.name}) and their assigned teachers.</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">{enrollment.subjects.length} subjects</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                        <tr><th className="px-5 py-3">#</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Teacher</th><th className="px-3 py-3">Actions</th></tr>
                      </thead>
                      <tbody>
                        {enrollment.subjects.map((subject, index) => (
                          <tr key={subject.id} className="border-t border-slate-100">
                            <td className="px-5 py-4 text-slate-400">{index + 1}</td>
                            <td className="px-3 py-4 font-semibold text-slate-900">{subject.name}</td>
                            <td className="px-3 py-4">
                              {subject.teacher
                                ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{subject.teacher}</span>
                                : <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500">No teacher assigned</span>}
                            </td>
                            <td className="px-3 py-4">
                              {!subject.teacher ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                                  onClick={() => void openTeacherAssignment(enrollment.section.id, subject.id, subject.name)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Assign
                                </button>
                              ) : <span className="text-xs text-slate-400">Assigned</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!enrollment.subjects.length ? <p className="px-5 py-8 text-sm text-slate-500">No subjects assigned to this section.</p> : null}
                  </div>
                </article>

                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><ClipboardList className="h-5 w-5" /></span>
                      <div>
                        <h3 className="font-semibold text-slate-950">Exams & Term Status</h3>
                        <p className="text-xs text-slate-500">Publication status for each subject&apos;s results.</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">2 terms</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                        <tr><th className="px-5 py-3">#</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Term 1</th><th className="px-3 py-3">Term 2</th></tr>
                      </thead>
                      <tbody>
                        {(markNames.length ? markNames : enrollment.subjects.map((subject) => subject.name)).map((name, index) => {
                          const subject = enrollment.subjects.find((item) => item.name === name);
                          const termMark = (term: "term1" | "term2") => exam?.[term].subjects.find((item) => item.name === name);
                          return (
                          <tr key={name} className="border-t border-slate-100">
                            <td className="px-5 py-4 text-slate-400">{index + 1}</td>
                            <td className="px-3 py-4 font-semibold text-slate-900">{name}</td>
                            {(["term1", "term2"] as const).map((termCode) => {
                              const fromExam = termMark(termCode);
                              const stored = subject?.terms.find((item) => item.term === (termCode === "term1" ? "TERM_1" : "TERM_2"));
                              const pending = fromExam ? fromExam.pending : !stored || stored.result === "Not published yet";
                              const absent = Boolean(fromExam?.absent);
                              const label = fromExam ? (fromExam.absent ? "Absent" : fromExam.pending ? "Not published" : fromExam.marks == null ? "—" : String(fromExam.marks)) : pending ? "Not published" : stored?.result;
                              return (
                                <td key={termCode} className="px-3 py-4">
                                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${pending || absent ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${pending || absent ? "bg-amber-400" : "bg-emerald-500"}`} />
                                    {label}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!markNames.length && !enrollment.subjects.length ? <p className="px-5 py-8 text-sm text-slate-500">No exam subjects available.</p> : null}
                  </div>
                </article>
              </div>
            </div>
            );
          })}
        </div>
      ) : null}

      {tab === "Attendance" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">Present {profile.attendanceStats.present}</article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">Absent {profile.attendanceStats.absent}</article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">Late {profile.attendanceStats.late}</article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">Excused {profile.attendanceStats.excused}</article>
          </div>
          {profile.enrollments.map((enrollment) => (
            <article key={enrollment.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
              <p className="font-semibold">{enrollment.schoolName} · {enrollment.academicYear.name} · {enrollment.level}</p>
              {enrollment.attendance.length ? enrollment.attendance.map((row) => (
                <p key={`${row.date}-${row.session}`} className="mt-1 text-sm">{row.date.slice(0, 10)} · {row.session} · {row.status}</p>
              )) : <p className="mt-2 text-sm">No attendance yet.</p>}
            </article>
          ))}
        </div>
      ) : null}

      {tab === "Finances" ? (
        <div className="space-y-4">
          {profile.fees.map((fee) => (
            <article key={fee.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
              <p className="font-semibold">{fee.year} · {fee.type} · {fee.title}</p>
              <p className="mt-1">Amount {fee.amount} · Paid {fee.paidAmount} · Balance {fee.balance} · {fee.status}</p>
              {fee.payments.map((payment) => (
                <p key={payment.receiptNumber} className="text-sm text-slate-500">{payment.receiptNumber}: {payment.amount}</p>
              ))}
            </article>
          ))}
          {!profile.fees.length ? <p className="text-slate-500">No fees on record.</p> : null}
        </div>
      ) : null}

      {tab === "Documents" ? (
        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm md:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!docFile || !studentId) return;
              setError("");
              try {
                const body = new FormData();
                body.append("file", docFile);
                body.append("kind", docKind);
                body.append("title", docTitle || docFile.name);
                const response = await fetch(`/api/v1/students/${studentId}/documents`, {
                  method: "POST",
                  credentials: "include",
                  body,
                });
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                  throw new Error(payload?.message ?? "Upload failed.");
                }
                setDocTitle("");
                setDocFile(null);
                setMessage("Document uploaded.");
                await loadDocs();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Upload failed.");
              }
            }}
          >
            <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={docKind} onChange={(event) => setDocKind(event.target.value)}>
              {["BIRTH_CERTIFICATE", "NATIONAL_ID", "TRANSFER_CERTIFICATE", "PREVIOUS_SCHOOL", "EDUCATION_CERTIFICATE", "PASSPORT", "OTHER"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Title" value={docTitle} onChange={(event) => setDocTitle(event.target.value)} />
            <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setDocFile(event.target.files?.[0] ?? null)} required />
            <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 md:col-span-3">Upload document</button>
          </form>
          {docs.map((doc) => (
            <article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
              <p className="font-semibold">{doc.title} · {doc.kind}</p>
              <p className="text-sm text-slate-500">{doc.originalName} · {doc.mimeType} · {Math.round(doc.sizeBytes / 1024)} KB · {doc.status}</p>
              {doc.rejectReason ? <p className="text-sm">Rejected: {doc.rejectReason}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" href={`/api/v1/documents/${doc.id}/download`}>Download</a>
                {doc.status !== "VERIFIED" ? (
                  <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => api(`/api/v1/documents/${doc.id}/verify`, { method: "POST" }).then(loadDocs).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Verify failed."))}>Verify</button>
                ) : null}
                {doc.status !== "REJECTED" ? (
                  <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => {
                    const reason = window.prompt("Rejection reason", "Unclear scan") ?? "";
                    if (!reason) return;
                    api(`/api/v1/documents/${doc.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }).then(loadDocs).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Reject failed."));
                  }}>Reject</button>
                ) : null}
                <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => {
                  const reason = window.prompt("Archive reason", "Superseded") ?? "";
                  if (!reason) return;
                  api(`/api/v1/documents/${doc.id}/archive`, { method: "POST", body: JSON.stringify({ reason }) }).then(loadDocs).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Archive failed."));
                }}>Archive</button>
              </div>
            </article>
          ))}
          {!docs.length ? <p className="text-slate-500">No documents yet.</p> : null}
          {message ? <p className="text-blue-600">{message}</p> : null}
        </div>
      ) : null}

      {tab === "Timeline" ? (
        <div className="space-y-3">
          {profile.timeline.map((event, index) => (
            <article key={`${event.type}-${event.at}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
              <p className="text-sm text-slate-500">{new Date(event.at).toLocaleString()} · {event.type}</p>
              <p className="mt-1">{event.label}</p>
            </article>
          ))}
          {profile.transfers.map((transfer) => (
            <article key={transfer.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
              <ArrowLeftRight className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">Transfer · {transfer.status}</p>
                {transfer.note ? <p className="text-sm text-slate-500">{transfer.note}</p> : null}
              </div>
            </article>
          ))}
          {!profile.timeline.length ? <p className="text-slate-500">No timeline events yet.</p> : null}
        </div>
      ) : null}

      {assignTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form onSubmit={assignTeacher} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Assign Teacher</h3>
            <p className="mt-1 text-sm text-slate-500">Choose a teacher for {assignTarget.subjectName}.</p>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Teacher
              <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" value={assignTeacherId} onChange={(event) => setAssignTeacherId(event.target.value)}>
                {assignableTeachers.filter((teacher) => teacher.isActive).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.publicId} · {teacher.name}</option>
                ))}
              </select>
            </label>
            {!assignableTeachers.some((teacher) => teacher.isActive) ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">No active teachers are available.</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setAssignTarget(null)}>Cancel</button>
              <button disabled={!assignTeacherId || assigningTeacher} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {assigningTeacher ? "Assigning..." : "Assign Teacher"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
