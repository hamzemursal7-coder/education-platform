import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileCheck2,
  FileDown,
  FilePlus,
  Filter,
  GraduationCap,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Table,
  Undo2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { AdminAvatar } from "../components/AdminAvatar";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  actor: string;
  actorEmail: string;
  actorRole?: string;
  actorPhotoUrl?: string | null;
};

type CategoryFilter = "ALL" | "TRANSFERS" | "STUDENTS" | "DOCUMENTS" | "ACADEMICS" | "ADMIN";
type DateFilter = "ALL" | "TODAY" | "7DAYS" | "30DAYS";
type ViewMode = "FEED" | "TABLE";

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return `Yesterday at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRoleLabel(role?: string) {
  if (!role) return "School Admin";
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "SCHOOL_ADMIN") return "School Admin";
  if (role === "TEACHER") return "Teacher";
  if (role === "ACCOUNTANT") return "Accountant";
  return role.replace(/_/g, " ");
}

function getActionMeta(action: string) {
  const upper = action.toUpperCase();

  if (upper === "STUDENT_REENROLLED") {
    return {
      title: "Student Re-enrolled",
      badgeColor: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20",
      icon: CheckCircle2,
      iconBg: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper === "STUDENT_RETURN_INITIATED") {
    return {
      title: "Return Request Initiated",
      badgeColor: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
      icon: RotateCcw,
      iconBg: "bg-blue-100 text-blue-700 ring-blue-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper === "EXTERNAL_TRANSFER_CONFIRMED") {
    return {
      title: "External Transfer Confirmed",
      badgeColor: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
      icon: ArrowRightLeft,
      iconBg: "bg-amber-100 text-amber-700 ring-amber-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper === "EXTERNAL_TRANSFER_DRAFT_CREATED") {
    return {
      title: "Transfer Draft Created",
      badgeColor: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
      icon: FilePlus,
      iconBg: "bg-sky-100 text-sky-700 ring-sky-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper === "EXTERNAL_TRANSFER_REVERSED") {
    return {
      title: "Transfer Reversal",
      badgeColor: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
      icon: Undo2,
      iconBg: "bg-rose-100 text-rose-700 ring-rose-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper === "TRANSFER_CERTIFICATE_DOCX_DOWNLOADED") {
    return {
      title: "Transfer Certificate (TC) Downloaded",
      badgeColor: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
      icon: Download,
      iconBg: "bg-indigo-100 text-indigo-700 ring-indigo-200",
      category: "DOCUMENTS" as CategoryFilter,
    };
  }

  if (upper === "STUDENT_TRANSCRIPT_DOCX_DOWNLOADED") {
    return {
      title: "Academic Transcript Downloaded",
      badgeColor: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20",
      icon: FileCheck2,
      iconBg: "bg-purple-100 text-purple-700 ring-purple-200",
      category: "DOCUMENTS" as CategoryFilter,
    };
  }

  if (upper.includes("SECTION_MOVE")) {
    return {
      title: "Section Move",
      badgeColor: "bg-teal-50 text-teal-700 ring-1 ring-teal-600/20",
      icon: ArrowRight,
      iconBg: "bg-teal-100 text-teal-700 ring-teal-200",
      category: "TRANSFERS" as CategoryFilter,
    };
  }

  if (upper.includes("PROMOTION")) {
    return {
      title: "Student Promotion",
      badgeColor: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
      icon: GraduationCap,
      iconBg: "bg-violet-100 text-violet-700 ring-violet-200",
      category: "ACADEMICS" as CategoryFilter,
    };
  }

  if (upper.includes("STUDENT") || upper.includes("ENROLL")) {
    return {
      title: action.replace(/_/g, " "),
      badgeColor: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
      icon: UserPlus,
      iconBg: "bg-blue-100 text-blue-700 ring-blue-200",
      category: "STUDENTS" as CategoryFilter,
    };
  }

  if (upper.includes("SCHOOL_ENTER") || upper.includes("SCHOOL_EXIT") || upper.includes("AUTH") || upper.includes("PORTAL")) {
    return {
      title: action.replace(/_/g, " "),
      badgeColor: "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
      icon: Shield,
      iconBg: "bg-slate-100 text-slate-700 ring-slate-200",
      category: "ADMIN" as CategoryFilter,
    };
  }

  return {
    title: action.replace(/_/g, " "),
    badgeColor: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    icon: Activity,
    iconBg: "bg-slate-100 text-slate-600 ring-slate-200",
    category: "ADMIN" as CategoryFilter,
  };
}

function parseSummary(summary: string) {
  // Extract technical parameters inside (key=val, key=val...)
  const match = summary.match(/\(([^)]+)\)$/);
  let cleanText = summary;
  const techParams: Record<string, string> = {};

  if (match && match[1]?.includes("=")) {
    cleanText = summary.slice(0, match.index).trim();
    const parts = match[1].split(",");
    for (const part of parts) {
      const [key, ...vals] = part.split("=");
      if (key && vals.length) {
        techParams[key.trim()] = vals.join("=").trim();
      }
    }
  }

  // Extract certificate numbers like #TC-SAAMALAY-00015
  const tcMatch = summary.match(/#?TC-[A-Z0-9-]+/i);
  const tcNumber = tcMatch ? tcMatch[0].replace(/^#/, "") : null;

  // Extract Student ID like STU-26-P-000001
  const stuIdMatch = summary.match(/STU-[A-Z0-9-]+/i);
  const stuId = stuIdMatch ? stuIdMatch[0] : null;

  // Extract Student Name if present
  let studentName: string | null = null;
  const studentNameMatch = summary.match(/for student ([^(.#]+)/i) || summary.match(/\(([^)]+)\)\s+into/i);
  if (studentNameMatch && studentNameMatch[1]) {
    studentName = studentNameMatch[1].trim();
  }

  return {
    cleanText,
    tcNumber,
    stuId,
    studentName,
    reason: techParams.reason || null,
    techParams,
  };
}

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters & State
  const [q, setQ] = useState("");
  const [categoryTab, setCategoryTab] = useState<CategoryFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedActor, setSelectedActor] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("FEED");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  async function loadData(showSpin = false) {
    if (showSpin) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = await api<AuditRow[]>("/api/v1/audit");
      setRows(data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load audit log.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Unique actions and actors for filter dropdowns
  const availableActions = useMemo(() => {
    const set = new Set(rows.map((r) => r.action));
    return Array.from(set).sort();
  }, [rows]);

  const availableActors = useMemo(() => {
    const set = new Set(rows.map((r) => r.actor));
    return Array.from(set).sort();
  }, [rows]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = rows.length;
    const transfers = rows.filter((r) => getActionMeta(r.action).category === "TRANSFERS").length;
    const documents = rows.filter((r) => getActionMeta(r.action).category === "DOCUMENTS").length;
    const uniqueActors = new Set(rows.map((r) => r.actor)).size;
    return { total, transfers, documents, uniqueActors };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const meta = getActionMeta(row.action);

      // Category Filter
      if (categoryTab !== "ALL" && meta.category !== categoryTab) return false;

      // Action Filter
      if (selectedAction !== "ALL" && row.action !== selectedAction) return false;

      // Actor Filter
      if (selectedActor !== "ALL" && row.actor !== selectedActor) return false;

      // Date Filter
      if (dateFilter !== "ALL") {
        const itemDate = new Date(row.createdAt);
        const now = new Date();
        const diffHours = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60);

        if (dateFilter === "TODAY" && diffHours > 24) return false;
        if (dateFilter === "7DAYS" && diffHours > 24 * 7) return false;
        if (dateFilter === "30DAYS" && diffHours > 24 * 30) return false;
      }

      // Query Search
      if (q.trim()) {
        const hay = `${row.action} ${row.entityType} ${row.actor} ${row.actorEmail} ${row.summary}`.toLowerCase();
        const needle = q.toLowerCase().trim();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [rows, categoryTab, selectedAction, selectedActor, dateFilter, q]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: rows.length,
      TRANSFERS: 0,
      STUDENTS: 0,
      DOCUMENTS: 0,
      ACADEMICS: 0,
      ADMIN: 0,
    };
    for (const r of rows) {
      const cat = getActionMeta(r.action).category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [rows]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [q, categoryTab, dateFilter, selectedAction, selectedActor, pageSize]);

  // CSV Export
  function exportCSV() {
    const headers = ["Timestamp", "Action", "Entity Type", "Actor Name", "Actor Email", "Actor Role", "Summary"];
    const csvLines = [headers.join(",")];

    for (const r of filteredRows) {
      const line = [
        `"${new Date(r.createdAt).toISOString()}"`,
        `"${r.action.replace(/"/g, '""')}"`,
        `"${r.entityType.replace(/"/g, '""')}"`,
        `"${r.actor.replace(/"/g, '""')}"`,
        `"${r.actorEmail.replace(/"/g, '""')}"`,
        `"${formatRoleLabel(r.actorRole).replace(/"/g, '""')}"`,
        `"${r.summary.replace(/"/g, '""')}"`,
      ];
      csvLines.push(line.join(","));
    }

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setQ("");
    setCategoryTab("ALL");
    setDateFilter("ALL");
    setSelectedAction("ALL");
    setSelectedActor("ALL");
    setPage(1);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Immutable Governance & Activity Trail</span>
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Monitoring
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              School Audit & Compliance Log
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
              Complete, tamper-evident audit record tracking student re-enrollments, internal/external transfers, document downloads, examination adjustments, and administrator actions.
            </p>
          </div>

          {/* Top Actions: Export CSV & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              title="Refresh audit events"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!filteredRows.length}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* Metric / KPI Cards */}
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
        {/* Total Events */}
        <div className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Audit Logs</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Captured in this school</p>
        </div>

        {/* Transfers & Returns */}
        <div className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Student Movements</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <ArrowRightLeft className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">{stats.transfers}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Returns & Transfers</p>
        </div>

        {/* Documents Downloaded */}
        <div className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Official Docs</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <FileCheck2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-indigo-700">{stats.documents}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">TC & Transcript prints</p>
        </div>

        {/* Unique Administrators */}
        <div className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Staff</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-violet-700">{stats.uniqueActors}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Logged administrators</p>
        </div>
      </section>

      {/* Main Container */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm space-y-5">
        {/* Category Tabs Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/90 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCategoryTab("ALL")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Events ({categoryCounts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("TRANSFERS")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "TRANSFERS" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Transfers & Returns ({categoryCounts.TRANSFERS})
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("DOCUMENTS")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "DOCUMENTS" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Documents ({categoryCounts.DOCUMENTS})
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("STUDENTS")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "STUDENTS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Students ({categoryCounts.STUDENTS})
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("ACADEMICS")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "ACADEMICS" ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Academics ({categoryCounts.ACADEMICS})
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("ADMIN")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                categoryTab === "ADMIN" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              System ({categoryCounts.ADMIN})
            </button>
          </div>

          {/* View Mode Toggle: Feed vs Table */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-0.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("FEED")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === "FEED" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Feed View with Actor Profile Details"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Feed</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === "TABLE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Compact Table View"
            >
              <Table className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Field */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search student, TC#, admin, note..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-3.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today (Last 24 Hours)</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-3.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Action Types ({availableActions.length})</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {getActionMeta(action).title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Actor Profile Filter */}
          <div className="relative">
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-3.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Staff & Administrators ({availableActors.length})</option>
              {availableActors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Filter status row */}
        {(q || categoryTab !== "ALL" || dateFilter !== "ALL" || selectedAction !== "ALL" || selectedActor !== "ALL") && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50/80 px-3.5 py-2 text-xs text-blue-900 border border-blue-200/60">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              <span>
                Showing <strong>{filteredRows.length}</strong> matching events (filtered from {rows.length})
              </span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-96 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty State */}
        {!loading && !filteredRows.length && !error ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
              <ShieldAlert className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-900">No matching audit events found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {q || categoryTab !== "ALL" || dateFilter !== "ALL" || selectedAction !== "ALL" || selectedActor !== "ALL"
                ? "Try adjusting your search criteria or resetting filters to see previous audit activity."
                : "No audit events have been logged yet for this school."}
            </p>
            {(q || categoryTab !== "ALL" || dateFilter !== "ALL" || selectedAction !== "ALL" || selectedActor !== "ALL") && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : null}

        {/* FEED VIEW (Rich, Modern Cards with Actor Profile and Structured Parsed Details) */}
        {!loading && viewMode === "FEED" && pagedRows.length > 0 ? (
          <div className="space-y-3.5">
            {pagedRows.map((row) => {
              const meta = getActionMeta(row.action);
              const ActionIcon = meta.icon;
              const parsed = parseSummary(row.summary);
              const isExpanded = expandedRowId === row.id;
              const hasTechParams = Object.keys(parsed.techParams).length > 0;

              return (
                <article
                  key={row.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:border-blue-300/80 hover:shadow-md"
                >
                  <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Action Icon & Details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 shadow-2xs ${meta.iconBg}`}
                      >
                        <ActionIcon className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Action Header Pill & Entity Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeColor}`}
                          >
                            {meta.title}
                          </span>

                          <span className="rounded-md bg-slate-150 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
                            {row.entityType}
                          </span>

                          {parsed.tcNumber && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 ring-1 ring-amber-300">
                              TC #{parsed.tcNumber}
                            </span>
                          )}

                          {parsed.stuId && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 ring-1 ring-blue-200">
                              {parsed.stuId}
                            </span>
                          )}
                        </div>

                        {/* Clean Main Description Text */}
                        <p className="text-xs sm:text-sm font-medium text-slate-800 leading-snug break-words">
                          {parsed.cleanText}
                        </p>

                        {/* Parsed Reason Box */}
                        {parsed.reason && (
                          <div className="mt-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 text-xs text-slate-700">
                            <span className="font-bold text-slate-900">Reason: </span>
                            <span className="italic text-slate-700 font-medium">"{parsed.reason}"</span>
                          </div>
                        )}

                        {/* Expandable Technical Audit Params */}
                        {hasTechParams && (
                          <div className="mt-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3" /> Hide audit parameters
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" /> View {Object.keys(parsed.techParams).length} audit parameters (IDs, timestamps)
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-slate-900 p-3 text-slate-200 font-mono text-[10px] shadow-inner">
                                {Object.entries(parsed.techParams).map(([key, value]) => (
                                  <div key={key} className="flex flex-col truncate">
                                    <span className="text-slate-400 capitalize font-bold">{key}</span>
                                    <span className="text-emerald-400 truncate" title={value}>
                                      {value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actor Profile (Profiilka) Card */}
                    <div className="flex shrink-0 items-center justify-between sm:flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                      {/* Actor Profile Container with Avatar */}
                      <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 p-2 border border-slate-200/70 shadow-2xs">
                        <AdminAvatar
                          photoUrl={row.actorPhotoUrl}
                          name={row.actor}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="text-left leading-tight min-w-0 max-w-[140px] sm:max-w-[180px]">
                          <p className="text-xs font-bold text-slate-900 truncate" title={row.actor}>
                            {row.actor}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate" title={row.actorEmail}>
                            {row.actorEmail || "System"}
                          </p>
                          <span className="mt-0.5 inline-block rounded bg-blue-100/70 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-blue-800">
                            {formatRoleLabel(row.actorRole)}
                          </span>
                        </div>
                      </div>

                      {/* Timestamp with Calendar Icon */}
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{formatRelativeTime(row.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {/* TABLE VIEW (Dense, High-Throughput Compliance Table) */}
        {!loading && viewMode === "TABLE" && pagedRows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor Profile</th>
                  <th className="px-4 py-3">Summary & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {pagedRows.map((row) => {
                  const meta = getActionMeta(row.action);
                  const parsed = parseSummary(row.summary);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500 font-mono text-[11px]">
                        <div>{new Date(row.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badgeColor}`}>
                          {meta.title}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] font-bold text-slate-600">
                        {row.entityType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AdminAvatar photoUrl={row.actorPhotoUrl} name={row.actor} size="xs" />
                          <div>
                            <div className="font-bold text-slate-900">{row.actor}</div>
                            <div className="text-[10px] text-slate-400">{row.actorEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-md">
                        <div className="truncate font-medium">{parsed.cleanText}</div>
                        {parsed.tcNumber && (
                          <span className="mr-2 inline-block font-mono text-[10px] font-bold text-amber-700">
                            #{parsed.tcNumber}
                          </span>
                        )}
                        {parsed.reason && (
                          <span className="italic text-[10px] text-slate-500">Reason: "{parsed.reason}"</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Pagination Bar */}
        {filteredRows.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-150 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Showing</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                of <strong>{filteredRows.length}</strong> events
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-700">
                <span>Page</span>
                <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-blue-700 font-black">{page}</span>
                <span>of {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
