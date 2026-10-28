import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  HeartHandshake,
  Lock,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type ReportSummary = {
  id: string;
  reportNumber: string;
  studentId: string;
  studentName: string;
  studentPermanentId: string;
  studentPhotoUrl: string | null;
  classLabel: string;
  sectionName: string;
  academicYear: string;
  reporterName: string;
  assignedTo: string | null;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isPositive: boolean;
  title: string;
  incidentDate: string;
  location: string | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "RESOLVED" | "CLOSED";
  isSensitive: boolean;
  isParentVisible: boolean;
  isStudentVisible: boolean;
  actionCount: number;
  attachmentCount: number;
  createdAt: string;
};

type ReportStats = {
  total: number;
  submitted: number;
  underReview: number;
  actionRequired: number;
  resolved: number;
  closed: number;
};

type FullReportDetail = {
  id: string;
  reportNumber: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isPositive: boolean;
  incidentDate: string;
  location: string | null;
  title: string;
  description: string;
  actionsTakenByTeacher: string | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "RESOLVED" | "CLOSED";
  requestedVisibility: string;
  visibilityLevel: string;
  isParentVisible: boolean;
  isStudentVisible: boolean;
  isSensitive: boolean;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  student: {
    id: string;
    name: string;
    permanentId: string;
    photoUrl: string | null;
    guardians: Array<{
      name: string;
      relationship: string;
      phone: string;
      email: string | null;
    }>;
  };
  enrollment: {
    classLabel: string;
    sectionName: string;
    academicYear: string;
    studentNumber: string;
    rollNumber: number;
  };
  reporter: {
    name: string;
    email: string;
    phone: string | null;
  };
  assignee: {
    id: string;
    name: string;
  } | null;
  actions: Array<{
    id: string;
    actionType: string;
    previousStatus: string | null;
    newStatus: string | null;
    comment: string | null;
    isInternalOnly: boolean;
    actorName: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    title: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    isParentVisible: boolean;
    isStudentVisible: boolean;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type EligibleStudent = {
  studentId: string;
  enrollmentId: string;
  permanentId: string;
  name: string;
  studentNumber: string;
  rollNumber: number;
  sectionId: string;
  sectionName: string;
  classLabel: string;
  classGroupId: string;
  academicYearId: string;
  academicYearName: string;
  schoolId: string;
};

type EligibleSection = {
  sectionId: string;
  sectionName: string;
  classLabel: string;
  classGroupId: string;
  academicYearId: string;
  academicYearName: string;
  schoolId: string;
};

type AcademicYearOption = {
  id: string;
  name: string;
  isCurrent: boolean;
};

type StaffOption = {
  id: string;
  name: string;
};

const statusStyles: Record<string, { label: string; badge: string; dot: string }> = {
  DRAFT: { label: "Qabyo (Draft)", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  SUBMITTED: { label: "Cusub (Submitted)", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  UNDER_REVIEW: { label: "Baaris (Under Review)", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ACTION_REQUIRED: { label: "Tallaabo Baahan", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  RESOLVED: { label: "La Xalliyey (Resolved)", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  CLOSED: { label: "Xidhan (Closed)", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-500" },
};

const severityStyles: Record<string, { label: string; badge: string }> = {
  LOW: { label: "Fudud", badge: "bg-slate-50 text-slate-700 border-slate-200" },
  MEDIUM: { label: "Dhexdhexaad", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  HIGH: { label: "Culus", badge: "bg-orange-50 text-orange-800 border-orange-200" },
  URGENT: { label: "Deg-deg / Urgent", badge: "bg-rose-50 text-rose-800 border-rose-300 font-bold" },
};

export function SchoolConductPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, submitted: 0, underReview: 0, actionRequired: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [sensitiveFilter, setSensitiveFilter] = useState("ALL");

  // Selected Detail Modal
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullReportDetail | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Status Change Form
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusComment, setStatusComment] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("INTERNAL_NOTE");

  // Admin Direct Report Creation
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [eligibleSections, setEligibleSections] = useState<EligibleSection[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [adminYearId, setAdminYearId] = useState("");
  const [adminClassLabel, setAdminClassLabel] = useState("");
  const [adminSectionId, setAdminSectionId] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [adminIsPositive, setAdminIsPositive] = useState(false);
  const [adminCategory, setAdminCategory] = useState("CLASSROOM_DISRUPTION");
  const [adminSeverity, setAdminSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("LOW");
  const [adminDate, setAdminDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [adminLocation, setAdminLocation] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [adminDescription, setAdminDescription] = useState("");
  const [adminActionsTaken, setAdminActionsTaken] = useState("");
  const [adminAudience, setAdminAudience] = useState<"INTERNAL_ONLY" | "PARENT_ONLY" | "STUDENT_ONLY" | "PARENT_AND_STUDENT">("INTERNAL_ONLY");
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.append("status", statusFilter);
      if (severityFilter !== "ALL") q.append("severity", severityFilter);
      if (sensitiveFilter === "TRUE") q.append("isSensitive", "true");
      if (sensitiveFilter === "FALSE") q.append("isSensitive", "false");
      if (search.trim()) q.append("search", search.trim());

      const data = await api<{ reports: ReportSummary[]; stats: ReportStats }>(`/api/v1/school/conduct/reports?${q.toString()}`);
      setReports(data.reports);
      setStats(data.stats);
    } catch (err: any) {
      alert(err?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter, severityFilter, sensitiveFilter]);

  async function openAdminCreateModal() {
    setShowAdminCreateModal(true);
    if (eligibleStudents.length === 0) {
      try {
        const data = await api<{ students: EligibleStudent[]; sections: EligibleSection[]; academicYears: AcademicYearOption[] }>(
          "/api/v1/school/conduct/eligible-students"
        );
        setEligibleStudents(data.students);
        setEligibleSections(data.sections || []);
        setAcademicYears(data.academicYears || []);

        if (data.students.length > 0) {
          const first = data.students[0];
          setAdminYearId(first.academicYearId);
          setAdminClassLabel(first.classLabel);
          setAdminSectionId(first.sectionId);
        }
      } catch (err: any) {
        alert(err?.message || "Failed to load students.");
      }
    }
  }

  // Cascading lists for Admin Direct Creation
  const availableYears = Array.from(
    new Map(eligibleStudents.map((s) => [s.academicYearId, { id: s.academicYearId, name: s.academicYearName }])).values()
  );

  const availableClasses = Array.from(
    new Set(
      eligibleStudents
        .filter((s) => !adminYearId || s.academicYearId === adminYearId)
        .map((s) => s.classLabel)
    )
  );

  const availableSections = Array.from(
    new Map(
      eligibleStudents
        .filter(
          (s) =>
            (!adminYearId || s.academicYearId === adminYearId) &&
            (!adminClassLabel || s.classLabel === adminClassLabel)
        )
        .map((s) => [s.sectionId, { id: s.sectionId, name: s.sectionName }])
    ).values()
  );

  const filteredStudents = eligibleStudents.filter((s) => {
    if (adminYearId && s.academicYearId !== adminYearId) return false;
    if (adminClassLabel && s.classLabel !== adminClassLabel) return false;
    if (adminSectionId && s.sectionId !== adminSectionId) return false;
    return true;
  });

  const selectedStudentObj = eligibleStudents.find((s) => s.enrollmentId === selectedEnrollmentId);

  async function handleAdminCreateSubmit() {
    if (!selectedEnrollmentId) {
      alert("Fadlan dooro ardayga (Please select a student).");
      return;
    }
    if (!adminTitle.trim() || adminTitle.length < 3) {
      alert("Fadlan qor cinwaanka warbixinta (Please enter title).");
      return;
    }
    if (!adminDescription.trim() || adminDescription.length < 5) {
      alert("Fadlan qor sharraxaadda dhacdada (Please enter description).");
      return;
    }

    const st = eligibleStudents.find((s) => s.enrollmentId === selectedEnrollmentId);
    if (!st) return;

    setAdminSubmitting(true);
    try {
      await api("/api/v1/school/conduct/reports", {
        method: "POST",
        body: JSON.stringify({
          studentId: st.studentId,
          enrollmentId: st.enrollmentId,
          category: adminCategory,
          severity: adminSeverity,
          isPositive: adminIsPositive,
          incidentDate: new Date(adminDate).toISOString(),
          location: adminLocation.trim(),
          title: adminTitle.trim(),
          description: adminDescription.trim(),
          actionsTakenByTeacher: adminActionsTaken.trim(),
          sharingAudience: adminAudience,
          status: "RESOLVED",
        }),
      });

      setShowAdminCreateModal(false);
      resetAdminForm();
      await loadData();
      alert("Warbixinta si toos ah ayaa loo diiwaangeliyey loona hirgeliyey go'aanka wadaagga!");
    } catch (err: any) {
      alert(err?.message || "Failed to create report.");
    } finally {
      setAdminSubmitting(false);
    }
  }

  function resetAdminForm() {
    setSelectedEnrollmentId("");
    setAdminTitle("");
    setAdminDescription("");
    setAdminActionsTaken("");
    setAdminLocation("");
    setAdminIsPositive(false);
    setAdminCategory("CLASSROOM_DISRUPTION");
    setAdminSeverity("LOW");
    setAdminAudience("INTERNAL_ONLY");
    setAdminDate(new Date().toISOString().slice(0, 16));
  }

  async function openReportDetail(id: string) {
    setSelectedReportId(id);
    try {
      const data = await api<{ report: FullReportDetail; staffOptions: StaffOption[] }>(`/api/v1/school/conduct/reports/${id}`);
      setDetail(data.report);
      setStaffOptions(data.staffOptions);
      setNewStatus(data.report.status);
      setSelectedAssignee(data.report.assignee?.id || "");
    } catch (err: any) {
      alert(err?.message || "Failed to load report detail.");
    }
  }

  async function handleAcceptApprove() {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api(`/api/v1/school/conduct/reports/${detail.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: "UNDER_REVIEW",
          comment: "Maamulka ayaa oggolaaday warbixinta (Accepted & Approved by Administration).",
        }),
      });
      await openReportDetail(detail.id);
      await loadData();
      alert("Warbixinta si guul leh ayaa loo oggolaaday (Report Accepted & Approved). Hadda waxaad go'aamin kartaa cidda lala wadaagayo.");
    } catch (err: any) {
      alert(err?.message || "Failed to approve report.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange() {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api(`/api/v1/school/conduct/reports/${detail.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: newStatus,
          comment: statusComment.trim() || undefined,
        }),
      });
      setStatusComment("");
      await openReportDetail(detail.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssigneeChange(assigneeId: string) {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api(`/api/v1/school/conduct/reports/${detail.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedToUserId: assigneeId || null }),
      });
      setSelectedAssignee(assigneeId);
      await openReportDetail(detail.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to assign case.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetSharingAudience(mode: "INTERNAL_ONLY" | "PARENT_ONLY" | "STUDENT_ONLY" | "PARENT_AND_STUDENT") {
    if (!detail) return;
    if (detail.isSensitive) {
      alert("Warbixinaha badbaadada degdegga ah (Safeguarding) laguma wadaagi karo waalidka ama ardayga.");
      return;
    }

    const isParentVisible = mode === "PARENT_ONLY" || mode === "PARENT_AND_STUDENT";
    const isStudentVisible = mode === "STUDENT_ONLY" || mode === "PARENT_AND_STUDENT";

    setActionLoading(true);
    try {
      await api(`/api/v1/school/conduct/reports/${detail.id}/visibility`, {
        method: "POST",
        body: JSON.stringify({
          isParentVisible,
          isStudentVisible,
          comment: `Go'aanka wadaagga maamulku beddelay: ${mode}.`,
        }),
      });
      await openReportDetail(detail.id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update visibility.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md border border-indigo-500/30">
              <Shield className="h-3.5 w-3.5" />
              <span>School Administration · Conduct & Welfare Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Maamulka Anshaxa, Daryeelka & Wadaagga
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Fur warbixinada macallimiinta, taabo <strong className="text-white">Accept / Approve</strong>, kaddibna go'aami
              inaad la wadaagto waalidka, ardayga, ama aad u haysato kayd ahaan. Magaca macallinka soo qoray weligiis looma sheego waalidka/ardayga.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition backdrop-blur-md"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={openAdminCreateModal}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Qor Report Cusub (Admin Direct)</span>
            </button>
          </div>
        </div>

        {/* Stats Metrics */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dhammaan (Total)</span>
            <div className="text-xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Cusub (Submitted)</span>
            <div className="text-xl font-bold text-blue-400 mt-1">{stats.submitted}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Baaris (Under Review)</span>
            <div className="text-xl font-bold text-amber-400 mt-1">{stats.underReview}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">Tallaabo Baahan</span>
            <div className="text-xl font-bold text-rose-400 mt-1">{stats.actionRequired}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">La Xalliyey (Resolved)</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{stats.resolved + stats.closed}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              placeholder="Raadi magaca ardayga, Permanent ID, lambarka warbixinta, ama cinwaanka..."
              className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Culayska Dhammaan (All Severities)</option>
              <option value="LOW">Low (Fudud)</option>
              <option value="MEDIUM">Medium (Dhexdhexaad)</option>
              <option value="HIGH">High (Culus)</option>
              <option value="URGENT">Urgent (Deg-deg)</option>
            </select>

            <select
              value={sensitiveFilter}
              onChange={(e) => setSensitiveFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Dhammaan Heerarka</option>
              <option value="TRUE">Safeguarding Kaliya</option>
              <option value="FALSE">Standard Kaliya</option>
            </select>

            <button
              onClick={() => loadData()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Shaandhee
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {["ALL", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "Dhammaan (All)" : statusStyles[st]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <RefreshCw className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="mt-3 text-base font-bold text-slate-800">Wax warbixin ah lama helin</h4>
          <p className="mt-1 text-sm text-slate-500">Isku day inaad beddesho shaandhada ama adigu qor report toos ah.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase font-extrabold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-4">Report #</th>
                  <th className="px-5 py-4">Ardayga (Student)</th>
                  <th className="px-5 py-4">Dhacdada (Incident)</th>
                  <th className="px-5 py-4">Cidda Soo Qortay (Reporter)</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Xaaladda Wadaagga (Sharing)</th>
                  <th className="px-5 py-4 text-right">Tallaabo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => {
                  const statusStyle = statusStyles[r.status] || statusStyles.DRAFT;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openReportDetail(r.id)}
                      className="hover:bg-indigo-50/40 transition cursor-pointer"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-xs text-indigo-700">{r.reportNumber}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{r.studentName}</div>
                        <div className="text-xs text-slate-400">
                          {r.classLabel} · Section {r.sectionName} · ID: {r.studentPermanentId}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{r.title}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          {r.isPositive ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                              Wanaag
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md">
                              Danbi
                            </span>
                          )}
                          <span>· {new Date(r.incidentDate).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          {r.reporterName}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${statusStyle.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {r.isSensitive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            <Lock className="h-3 w-3" /> Safeguarding Restricted
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-xs">
                            {r.isParentVisible && r.isStudentVisible ? (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                🌟 Waalid & Arday
                              </span>
                            ) : r.isParentVisible ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                👨‍👩‍👧 Waalidka Kaliya
                              </span>
                            ) : r.isStudentVisible ? (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                🎓 Ardayga Kaliya
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-medium">
                                🔒 Kayd Dugsiga
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button className="rounded-xl p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADMIN DIRECT REPORT CREATION MODAL */}
      {showAdminCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl my-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">
                  School Admin Direct Action
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Qor Warbixin Cusub (Admin Direct Report)</h3>
                <p className="text-xs text-slate-500">
                  Qor warbixin toos ah oo ku saabsan anshaxa ama daryeelka ardayga, adigoo dooranaya cidda lala wadaagayo.
                </p>
              </div>
              <button
                onClick={() => setShowAdminCreateModal(false)}
                className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              {/* STEP 1: CASCADING STUDENT SELECTOR (Year -> Class -> Section -> Student) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  1. Dooro Fasalka iyo Ardayga (Select Student)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Academic Year</label>
                    <select
                      value={adminYearId}
                      onChange={(e) => {
                        setAdminYearId(e.target.value);
                        setSelectedEnrollmentId("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr.id} value={yr.id}>
                          {yr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Class / Form</label>
                    <select
                      value={adminClassLabel}
                      onChange={(e) => {
                        setAdminClassLabel(e.target.value);
                        setSelectedEnrollmentId("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section</label>
                    <select
                      value={adminSectionId}
                      onChange={(e) => {
                        setAdminSectionId(e.target.value);
                        setSelectedEnrollmentId("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      {availableSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dooro Ardayga *</label>
                  <select
                    value={selectedEnrollmentId}
                    onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="">-- Dooro ardayga fasalka ku jira --</option>
                    {filteredStudents.map((st) => (
                      <option key={st.enrollmentId} value={st.enrollmentId}>
                        {st.name} (ID: {st.permanentId} · Roll #{st.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStudentObj && (
                  <div className="flex items-center gap-3 rounded-xl bg-white p-3 border border-indigo-200">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm">
                      {selectedStudentObj.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{selectedStudentObj.name}</div>
                      <div className="text-xs text-slate-500">
                        Permanent ID: {selectedStudentObj.permanentId} · {selectedStudentObj.classLabel} (Section {selectedStudentObj.sectionName})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: DANBI VS WANAAG */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAdminIsPositive(false);
                    setAdminCategory("CLASSROOM_DISRUPTION");
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 p-4 text-center transition ${
                    !adminIsPositive
                      ? "border-rose-500 bg-rose-50/60 text-rose-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <AlertTriangle className={`h-6 w-6 ${!adminIsPositive ? "text-rose-600" : "text-slate-400"}`} />
                  <span className="mt-2 text-sm font-bold">Danbi / Khaldan (Misconduct)</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Qalalaase, daahid, heshiis jabayn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminIsPositive(true);
                    setAdminCategory("POSITIVE_CONDUCT");
                    setAdminSeverity("LOW");
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 p-4 text-center transition ${
                    adminIsPositive
                      ? "border-emerald-500 bg-emerald-50/60 text-emerald-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Sparkles className={`h-6 w-6 ${adminIsPositive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="mt-2 text-sm font-bold">Wanaag & Abaalmarin (Merit)</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Dhaqan wanaag, hoggaan, dadaal</span>
                </button>
              </div>

              {/* STEP 3: CATEGORY, SEVERITY & DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={adminCategory}
                    onChange={(e) => setAdminCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    {adminIsPositive ? (
                      <option value="POSITIVE_CONDUCT">Dhaqan Wanaag / Abaalmarin (Merit)</option>
                    ) : (
                      <>
                        <option value="CLASSROOM_DISRUPTION">Qalalaase Fasalka ah (Disruption)</option>
                        <option value="REPEATED_LATENESS">Soo Daahid Soo Noqnoqotay (Lateness)</option>
                        <option value="UNEXCUSED_ABSENCE">Maqnaansho Fasax La'aan ah</option>
                        <option value="PEER_CONFLICT">Dagaal / Khilaaf Ardayda ah (Conflict)</option>
                        <option value="ACADEMIC_DISHONESTY">Khiyaano Imtixaan / Qish</option>
                        <option value="PROPERTY_DAMAGE">Waxyeello Hanti Dugsiga ah</option>
                        <option value="WELFARE_CONCERN">Daryeel / Caafimaad (Welfare)</option>
                        <option value="OTHER">Dhacdo Kale (Other)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Culayska (Severity)</label>
                  <select
                    value={adminSeverity}
                    onChange={(e) => setAdminSeverity(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="LOW">Low (Fudud)</option>
                    <option value="MEDIUM">Medium (Dhexdhexaad)</option>
                    <option value="HIGH">High (Culus)</option>
                    <option value="URGENT">Urgent (Deg-deg)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    Taariikhda Dhacdada *
                  </label>
                  <input
                    type="datetime-local"
                    value={adminDate}
                    onChange={(e) => setAdminDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* STEP 4: TITLE & DESCRIPTION */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cinwaanka Warbixinta (Title) *</label>
                  <input
                    type="text"
                    value={adminTitle}
                    onChange={(e) => setAdminTitle(e.target.value)}
                    placeholder="e.g. Digniin ku socota ardayga oo ku saabsan soo daahida soo noqnoqotay"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sharraxaadda Xaqiiqada ah (Factual Description / Sharrax) *
                  </label>
                  <textarea
                    rows={3}
                    value={adminDescription}
                    onChange={(e) => setAdminDescription(e.target.value)}
                    placeholder="Qor faahfaahinta xaqiiqada ah ee go'aankan..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* STEP 5: SHARING AUDIENCE SELECTOR */}
              <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                    Go'aanka Wadaagga (Sharing Audience Decision)
                  </span>
                  <span className="text-xs text-indigo-700">Wuu iska deyn karaa si ay history u noqoto ama wuu wadaagi karaa</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminAudience("INTERNAL_ONLY")}
                    className={`rounded-2xl p-3 text-center border-2 transition ${
                      adminAudience === "INTERNAL_ONLY"
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">🔒 Kayd Kaliya</div>
                    <div className="text-[10px] text-slate-300 mt-0.5">School History</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminAudience("PARENT_ONLY")}
                    className={`rounded-2xl p-3 text-center border-2 transition ${
                      adminAudience === "PARENT_ONLY"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">👨‍👩‍👧 Waalidka</div>
                    <div className="text-[10px] text-emerald-100 mt-0.5">Share with Parent</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminAudience("STUDENT_ONLY")}
                    className={`rounded-2xl p-3 text-center border-2 transition ${
                      adminAudience === "STUDENT_ONLY"
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">🎓 Ardayga</div>
                    <div className="text-[10px] text-blue-100 mt-0.5">Share with Student</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminAudience("PARENT_AND_STUDENT")}
                    className={`rounded-2xl p-3 text-center border-2 transition ${
                      adminAudience === "PARENT_AND_STUDENT"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">🌟 Labadaba</div>
                    <div className="text-[10px] text-indigo-100 mt-0.5">Parent & Student</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowAdminCreateModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Ka Noqo
              </button>
              <button
                type="button"
                disabled={adminSubmitting}
                onClick={handleAdminCreateSubmit}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {adminSubmitting ? "Diiwaangelinayaa..." : "Diiwaangeli Warbixinta (Save Report)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL DETAIL & REVIEW DRAWER */}
      {selectedReportId && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-bold text-indigo-700">{detail.reportNumber}</span>
                <span className={`rounded-xl border px-3 py-1 text-xs font-bold ${statusStyles[detail.status]?.badge}`}>
                  {statusStyles[detail.status]?.label || detail.status}
                </span>
                {detail.isPositive ? (
                  <span className="rounded-lg bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    Wanaag / Merit
                  </span>
                ) : (
                  <span className="rounded-lg bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                    Danbi / Incident
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedReportId(null);
                  setDetail(null);
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* 1. REPORTER BANNER - Visible to School Admin Only */}
              <div className="flex items-center justify-between rounded-2xl bg-indigo-50/70 p-4 border border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-sm">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                      Cidda soo qortay (Reported by Teacher)
                    </div>
                    <div className="text-sm font-bold text-slate-900">{detail.reporter.name}</div>
                    <div className="text-xs text-slate-500">{detail.reporter.email}</div>
                  </div>
                </div>
                <span className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-indigo-900 border border-indigo-200 shadow-sm">
                  Macallin Diiwaangashan
                </span>
              </div>

              {/* 2. STRICT PRIVACY REASSURANCE BANNER */}
              <div className="rounded-2xl bg-amber-50/70 p-4 text-xs text-amber-950 border border-amber-200 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-bold">Ilaalinta Qarsoodiga Macallinka:</span>
                  <p>
                    Magaca macallinka soo gudbiyey warbixintan (<strong>{detail.reporter.name}</strong>){" "}
                    <strong>UMA MUUQAN DOONO</strong> ardayga ama waalidka haddii aad la wadaagto. Warbixintu waxay u
                    muuqanaysaa mid rasmi ah oo ka timid <em>Maamulka Dugsiga (School Administration)</em>.
                  </p>
                </div>
              </div>

              {/* 3. ACCEPT / APPROVE ACTION (Prominent CTA if Submitted) */}
              {detail.status === "SUBMITTED" && (
                <div className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-100 px-2 py-0.5 rounded-md">
                      Tallaabada 1aad
                    </span>
                    <h4 className="text-base font-bold text-indigo-950 mt-1">Oggolow Warbixintan (Accept & Approve)</h4>
                    <p className="text-xs text-indigo-800/80 mt-0.5">
                      Guji badhanka si aad u aqbasho warbixinta macallinka, kaddibna go'aanso wadaagga.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleAcceptApprove}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5 shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Accept / Approve Report</span>
                  </button>
                </div>
              )}

              {/* 4. SHARING CONTROL MATRIX */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-3.5 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Xarunta Wadaagga (Sharing Control Matrix)
                  </span>
                  <span className="text-xs text-slate-500">Go'aanka Maamulka Dugsiga</span>
                </div>

                {detail.isSensitive ? (
                  <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200 font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>Safeguarding Restricted: Warbixintan sababo ammaan awgood lama wadaagi karo waalidka ama ardayga.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Option 1: Internal Only */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSetSharingAudience("INTERNAL_ONLY")}
                      className={`rounded-2xl p-3.5 text-center border-2 transition ${
                        !detail.isParentVisible && !detail.isStudentVisible
                          ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-extrabold">🔒 Kayd Kaliya</div>
                      <div className="text-[10px] text-slate-400 mt-1">School History Only</div>
                    </button>

                    {/* Option 2: Parent Only */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSetSharingAudience("PARENT_ONLY")}
                      className={`rounded-2xl p-3.5 text-center border-2 transition ${
                        detail.isParentVisible && !detail.isStudentVisible
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/10"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-extrabold">👨‍👩‍👧 Waalidka</div>
                      <div className="text-[10px] text-emerald-100 mt-1">Share with Parent</div>
                    </button>

                    {/* Option 3: Student Only */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSetSharingAudience("STUDENT_ONLY")}
                      className={`rounded-2xl p-3.5 text-center border-2 transition ${
                        !detail.isParentVisible && detail.isStudentVisible
                          ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/10"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-extrabold">🎓 Ardayga</div>
                      <div className="text-[10px] text-blue-100 mt-1">Share with Student</div>
                    </button>

                    {/* Option 4: Both */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSetSharingAudience("PARENT_AND_STUDENT")}
                      className={`rounded-2xl p-3.5 text-center border-2 transition ${
                        detail.isParentVisible && detail.isStudentVisible
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/10"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-extrabold">🌟 Labadaba</div>
                      <div className="text-[10px] text-indigo-100 mt-1">Parent & Student</div>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. STUDENT & GUARDIAN PROFILE CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-extrabold text-base shadow-sm">
                    {detail.student.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{detail.student.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Permanent ID: <span className="font-mono font-semibold text-slate-800">{detail.student.permanentId}</span> ·{" "}
                      {detail.enrollment.classLabel} (Section {detail.enrollment.sectionName}) · Roll #{detail.enrollment.rollNumber}
                    </p>
                  </div>
                </div>

                {detail.student.guardians.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-xs font-bold text-slate-700">Xiriirka Waalidka (Guardian Contacts):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detail.student.guardians.map((g, i) => (
                        <div key={i} className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                          <span className="font-bold text-slate-900">
                            {g.name} ({g.relationship})
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-600 mt-1">
                            <Phone className="h-3 w-3 text-indigo-600" />
                            <span>{g.phone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. INCIDENT DETAILS */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Faahfaahinta Dhacdada (Incident Narrative)
                  </span>
                  <span className={`rounded-xl border px-3 py-1 text-xs font-semibold ${severityStyles[detail.severity]?.badge}`}>
                    {severityStyles[detail.severity]?.label}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 leading-snug">{detail.title}</h3>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    {new Date(detail.incidentDate).toLocaleString()}
                  </span>
                  {detail.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {detail.location}
                    </span>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap border border-slate-100">
                  {detail.description}
                </div>

                {detail.actionsTakenByTeacher && (
                  <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-200 text-xs text-amber-950">
                    <span className="font-bold">Tallaabadii Macallinku Qaaday:</span>
                    <p className="mt-1 leading-relaxed">{detail.actionsTakenByTeacher}</p>
                  </div>
                )}
              </div>

              {/* 7. STATUS & CASE MANAGEMENT */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-3.5 bg-white">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Maamul Xaaladda Kiiska (Status & Staff Assignment)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Status-ka Guud</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      <option value="SUBMITTED">Submitted (Cusub)</option>
                      <option value="UNDER_REVIEW">Under Review (Baaris)</option>
                      <option value="ACTION_REQUIRED">Action Required (Tallaabo)</option>
                      <option value="RESOLVED">Resolved (La Xalliyey)</option>
                      <option value="CLOSED">Closed (Xidhan)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ku Meelee Shaqaale (Assignee)</label>
                    <select
                      value={selectedAssignee}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      <option value="">-- Dooro Shaqaale --</option>
                      {staffOptions.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {newStatus !== detail.status && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={statusComment}
                      onChange={(e) => setStatusComment(e.target.value)}
                      placeholder="Qor sababta ama natiijada tallaabada (e.g. Heshiis ayaa lala galay ardayga)..."
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:outline-none bg-white"
                    />
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleStatusChange}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                    >
                      {actionLoading ? "Cusboonaysiinayaa..." : "Xaqiiji Beddelka Status-ka"}
                    </button>
                  </div>
                )}
              </div>

              {/* 8. TIMELINE OF ACTIONS */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Taariikhda Tallaabooyinka & Go'aannada (History Timeline)
                </span>
                <div className="space-y-3 border-l-2 border-indigo-200 pl-4 ml-2">
                  {detail.actions.map((act) => (
                    <div key={act.id} className="relative text-xs space-y-0.5">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 border-2 border-white" />
                      <div className="font-bold text-slate-800">{act.actionType.replace("_", " ")}</div>
                      <div className="text-slate-600 leading-relaxed">{act.comment}</div>
                      <div className="text-[10px] text-slate-400">
                        {act.actorName} · {new Date(act.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
