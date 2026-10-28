import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  HeartHandshake,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { api } from "../lib/api";

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
  academicYearName: string;
  schoolId: string;
};

type ReportItem = {
  id: string;
  reportNumber: string;
  studentName: string;
  studentPermanentId: string;
  classLabel: string;
  sectionName: string;
  academicYear: string;
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
  attachmentCount: number;
  actionCount: number;
  createdAt: string;
  updatedAt: string;
};

type ReportDetail = {
  id: string;
  reportNumber: string;
  student: {
    id: string;
    name: string;
    permanentId: string;
    photoUrl: string | null;
  };
  enrollment: {
    sectionName: string;
    classLabel: string;
    academicYear: string;
  };
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isPositive: boolean;
  incidentDate: string;
  location: string | null;
  title: string;
  description: string;
  actionsTakenByTeacher: string | null;
  status: string;
  requestedVisibility: string;
  isSensitive: boolean;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  actions: Array<{
    id: string;
    actionType: string;
    comment: string | null;
    actorName: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    title: string;
    originalName: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

const categoryLabels: Record<string, { label: string; icon: any; tone: string; desc: string }> = {
  POSITIVE_CONDUCT: {
    label: "Wanaag: Dhaqan Wanaagsan & Abaalmarin",
    icon: Award,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    desc: "Abaalmarin, dadaal waxbarasho, gargaar arday kale ama hoggaan wanaagsan",
  },
  CLASSROOM_DISRUPTION: {
    label: "Dambi: Qalalaase Fasalka Dhexdiisa ah",
    icon: AlertCircle,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    desc: "Kala carqaladayn casharka, buuq joogto ah, ama diidmo amarka macallinka",
  },
  REPEATED_LATENESS: {
    label: "Dambi: Soo Daahid Soo Noqnoqotay",
    icon: Clock,
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    desc: "Soo daahid joogto ah oo saamayneysa bilowga casharada",
  },
  UNEXCUSED_ABSENCE: {
    label: "Dambi: Maqnaansho Aan Sabab Lahayn",
    icon: Clock,
    tone: "text-indigo-700 bg-indigo-50 border-indigo-200",
    desc: "Fasax la'aan fasalka ama dugsiga oo laga maqnaado",
  },
  PEER_CONFLICT: {
    label: "Dambi: Khilaaf ama Dagaal Ardayda ah",
    icon: AlertCircle,
    tone: "text-orange-700 bg-orange-50 border-orange-200",
    desc: "Gacan-ka-hadal, cay, hanjabaad ama isku dhac ardayda dhexmaray",
  },
  ACADEMIC_DISHONESTY: {
    label: "Dambi: Khiyaano Imtixaan / Qish",
    icon: FileText,
    tone: "text-purple-700 bg-purple-50 border-purple-200",
    desc: "Qishasho imtixaan, wax isdaba-marin ama nuqul shaqo arday kale",
  },
  PROPERTY_DAMAGE: {
    label: "Dambi: Waxyeello Hantiyeed",
    icon: AlertCircle,
    tone: "text-red-700 bg-red-50 border-red-200",
    desc: "Burburin kuraasta, buugaagta, qalabka dugsiga ama derbiyada",
  },
  WELFARE_CONCERN: {
    label: "Welfare: Xaalad Daryeel ama Caafimaad",
    icon: HeartHandshake,
    tone: "text-teal-700 bg-teal-50 border-teal-200",
    desc: "Arday u baahan caawimaad caafimaad, daryeel gaar ah ama taageero maskaxeed",
  },
  SAFEGUARDING: {
    label: "Deg-deg: Badbaadada Ardayga (Safeguarding)",
    icon: ShieldAlert,
    tone: "text-rose-700 bg-rose-50 border-rose-200",
    desc: "Khatar toos ah oo ku wajahan nolosha, badbaadada ama xaaladda ardayga",
  },
  OTHER: {
    label: "Dhacdo Kale (Other)",
    icon: FileText,
    tone: "text-slate-700 bg-slate-50 border-slate-200",
    desc: "Arrin kasta oo kale oo muhiim ah oo u baahan diiwaangelin",
  },
};

const statusStyles: Record<string, { label: string; badge: string; dot: string }> = {
  DRAFT: { label: "Qabyo (Draft)", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  SUBMITTED: { label: "Gudbiyey (Submitted)", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  UNDER_REVIEW: { label: "Maamulka ayaa Eegaya", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ACTION_REQUIRED: { label: "Tallaabo Baahan", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  RESOLVED: { label: "La Xalliyey (Resolved)", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  CLOSED: { label: "Xidhan (Closed)", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-500" },
};

const severityStyles: Record<string, { label: string; badge: string }> = {
  LOW: { label: "Fudud (Low)", badge: "bg-slate-50 text-slate-700 border-slate-200" },
  MEDIUM: { label: "Dhexdhexaad (Medium)", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  HIGH: { label: "Culus (High)", badge: "bg-orange-50 text-orange-800 border-orange-200" },
  URGENT: { label: "Deg-deg & Halis (Urgent)", badge: "bg-rose-50 text-rose-800 border-rose-300 font-bold" },
};

export function TeacherConductPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [eligibleSections, setEligibleSections] = useState<EligibleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"LIST" | "CREATE">("LIST");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Stepped Form State (Year -> Class -> Section -> Student -> Danbi/Wanaag -> Date -> Title -> Sharrax -> Submit)
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedClassLabel, setSelectedClassLabel] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [isPositive, setIsPositive] = useState(false); // Danbi (false) vs Wanaag (true)
  const [category, setCategory] = useState("CLASSROOM_DISRUPTION");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("LOW");
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [repData, eligData] = await Promise.all([
        api<{ reports: ReportItem[] }>("/api/v1/teacher/conduct/reports"),
        api<{ students: EligibleStudent[]; sections: EligibleSection[] }>("/api/v1/teacher/conduct/eligible-students"),
      ]);
      setReports(repData.reports);
      setEligibleStudents(eligData.students);
      setEligibleSections(eligData.sections);

      if (eligData.students.length > 0 && !selectedYearId) {
        const first = eligData.students[0];
        setSelectedYearId(first.academicYearId);
        setSelectedClassLabel(first.classLabel);
        setSelectedSectionId(first.sectionId);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openDetail(id: string) {
    setSelectedReportId(id);
    try {
      const data = await api<ReportDetail>(`/api/v1/teacher/conduct/reports/${id}`);
      setDetail(data);
    } catch (err: any) {
      alert(err?.message || "Failed to load report detail.");
    }
  }

  // Cascading lists
  const availableYears = Array.from(
    new Map(eligibleStudents.map((s) => [s.academicYearId, { id: s.academicYearId, name: s.academicYearName }])).values()
  );

  const availableClasses = Array.from(
    new Set(
      eligibleStudents
        .filter((s) => !selectedYearId || s.academicYearId === selectedYearId)
        .map((s) => s.classLabel)
    )
  );

  const availableSections = Array.from(
    new Map(
      eligibleStudents
        .filter(
          (s) =>
            (!selectedYearId || s.academicYearId === selectedYearId) &&
            (!selectedClassLabel || s.classLabel === selectedClassLabel)
        )
        .map((s) => [s.sectionId, { id: s.sectionId, name: s.sectionName }])
    ).values()
  );

  const filteredStudents = eligibleStudents.filter((s) => {
    if (selectedYearId && s.academicYearId !== selectedYearId) return false;
    if (selectedClassLabel && s.classLabel !== selectedClassLabel) return false;
    if (selectedSectionId && s.sectionId !== selectedSectionId) return false;
    return true;
  });

  const selectedStudentObj = eligibleStudents.find((s) => s.enrollmentId === selectedEnrollmentId);

  async function handleSubmit(saveAsDraft: boolean) {
    if (!selectedEnrollmentId) {
      alert("Fadlan dooro ardayga (Please select a student).");
      return;
    }
    if (!title.trim() || title.length < 3) {
      alert("Fadlan qor cinwaanka report-ka (Please enter a report title).");
      return;
    }
    if (!description.trim() || description.length < 5) {
      alert("Fadlan qor sharraxaad ku saabsan waxa dhacay (Please enter the factual description).");
      return;
    }

    const student = eligibleStudents.find((s) => s.enrollmentId === selectedEnrollmentId);
    if (!student) {
      alert("Ardayga lama helin (Student not found).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api<{ message: string; reportId: string; reportNumber: string }>("/api/v1/teacher/conduct/reports", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.studentId,
          enrollmentId: student.enrollmentId,
          category,
          severity,
          isPositive,
          incidentDate: new Date(incidentDate).toISOString(),
          location: location.trim(),
          title: title.trim(),
          description: description.trim(),
          actionsTakenByTeacher: actionsTaken.trim(),
          requestedVisibility: "STAFF_INTERNAL",
          status: saveAsDraft ? "DRAFT" : "SUBMITTED",
        }),
      });

      if (attachmentFile && res.reportId) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        formData.append("title", attachmentFile.name);
        await fetch(`/api/v1/teacher/conduct/reports/${res.reportId}/attachments`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      resetForm();
      setViewMode("LIST");
      await loadData();
      alert(
        saveAsDraft
          ? "Report-ka waxaa loo kaydiyey qabyo ahaan (Saved as Draft)."
          : "Report-ka si guul leh ayaa loogu gudbiyey Maamulka Dugsiga (Submitted to School Administration)."
      );
    } catch (err: any) {
      alert(err?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setActionsTaken("");
    setLocation("");
    setIsPositive(false);
    setCategory("CLASSROOM_DISRUPTION");
    setSeverity("LOW");
    setIncidentDate(new Date().toISOString().slice(0, 16));
    setAttachmentFile(null);
    setSelectedEnrollmentId("");
  }

  const filteredReports = reports.filter((rep) => {
    if (statusFilter !== "ALL" && rep.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      rep.studentName.toLowerCase().includes(q) ||
      rep.reportNumber.toLowerCase().includes(q) ||
      rep.title.toLowerCase().includes(q) ||
      rep.sectionName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md border border-indigo-500/30">
              <Shield className="h-3.5 w-3.5" />
              <span>Teacher Welfare & Conduct Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Warbixinta Anshaxa & Daryeelka Ardayda
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Diiwaangeli dambiyada ama wanaagga ardayga si xaqiiqo ah. Warbixintu waxay toos ugu dhacaysaa{" "}
              <strong className="text-white">Maamulka Dugsiga</strong>. Magacaaga macallin ahaan waa qarsoodi waalidka iyo ardayda marka loo eego.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === "LIST" ? (
              <button
                onClick={() => {
                  resetForm();
                  setViewMode("CREATE");
                }}
                className="inline-flex items-center gap-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                <span>Qor Report Cusub (New Report)</span>
              </button>
            ) : (
              <button
                onClick={() => setViewMode("LIST")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition backdrop-blur-md"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Ku Laabo Liiska (Back to List)</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dhammaan (Total)</span>
            <div className="text-xl font-bold text-white mt-1">{reports.length}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Sugaya Maamulka</span>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {reports.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Wanaag & Merits</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{reports.filter((r) => r.isPositive).length}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">Danbi & Khaladaad</span>
            <div className="text-xl font-bold text-rose-400 mt-1">{reports.filter((r) => !r.isPositive).length}</div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: STEPPED REPORT CREATOR WIZARD */}
      {viewMode === "CREATE" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">
                Tallaabo-Tallaabo (Step-by-Step Reporting)
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Qor Warbixin Cusub oo Ku Saabsan Ardayga</h2>
              <p className="text-sm text-slate-500">
                Fadlan si taxadir leh u buuxi macluumaadka hoose. Taariikhda dhacdada si toos ah ayaa loola socodsiinayaa.
              </p>
            </div>
            <button
              onClick={() => setViewMode("LIST")}
              className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Close wizard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-8">
            {/* TALLAABADA 1: SELECT YEAR, CLASS, SECTION & STUDENT */}
            <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/20 p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white shadow-md shadow-indigo-500/30">
                  1
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dooro Fasalka iyo Ardayga (Select Year, Class, Section & Student)
                  </h3>
                  <p className="text-xs text-slate-500">Kala xulo sanadka, fasalka iyo qaybta si aad ardayga u hesho</p>
                </div>
              </div>

              {/* 3 Cascading Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Sanad Dugsiyeedka (Year) *
                  </label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => {
                      setSelectedYearId(e.target.value);
                      setSelectedEnrollmentId("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr.id} value={yr.id}>
                        {yr.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Fasalka / Form (Class) *
                  </label>
                  <select
                    value={selectedClassLabel}
                    onChange={(e) => {
                      setSelectedClassLabel(e.target.value);
                      setSelectedEnrollmentId("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Qaybta (Section) *
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => {
                      setSelectedSectionId(e.target.value);
                      setSelectedEnrollmentId("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  >
                    {availableSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Section {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Student Picker */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Dooro Ardayga (Select Student) *</span>
                  <span className="text-indigo-600 font-normal">
                    {filteredStudents.length} arday ayaa laga helay qaybtaan
                  </span>
                </label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full rounded-2xl border-2 border-indigo-200 bg-white px-4 py-3 text-base font-bold text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">-- Guji halkan si aad ardayga u doorato --</option>
                  {filteredStudents.map((st) => (
                    <option key={st.enrollmentId} value={st.enrollmentId}>
                      {st.name} — (ID: {st.permanentId} · Roll #{st.rollNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Student Confirmation Card */}
              {selectedStudentObj && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-4 border border-indigo-200 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-extrabold text-base shadow-md shadow-indigo-500/20">
                      {selectedStudentObj.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">{selectedStudentObj.name}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                          ID: {selectedStudentObj.permanentId}
                        </span>
                        <span>·</span>
                        <span>
                          {selectedStudentObj.classLabel} (Section {selectedStudentObj.sectionName})
                        </span>
                        <span>·</span>
                        <span>Roll #{selectedStudentObj.rollNumber}</span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 shrink-0">
                    <Check className="h-4 w-4" />
                    Ardayga waa la doortay
                  </span>
                </div>
              )}
            </div>

            {/* TALLAABADA 2: DANBI MISE WANAAG? (MISCONDUCT VS MERIT) */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white shadow-md shadow-indigo-500/30">
                  2
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dooro Nooca Warbixinta: Danbi mise Wanaag? (Conduct Classification)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dooro haddii ay tahay khaladaad anshax (Danbi) ama dabeecad wanaagsan iyo abaalmarin (Wanaag)
                  </p>
                </div>
              </div>

              {/* Two Big High-Profile Toggle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Danbi Card */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPositive(false);
                    setCategory("CLASSROOM_DISRUPTION");
                  }}
                  className={`relative flex flex-col p-5 rounded-2xl border-2 text-left transition-all ${
                    !isPositive
                      ? "border-rose-500 bg-rose-50/60 shadow-lg shadow-rose-500/10 ring-4 ring-rose-500/10"
                      : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                        !isPositive
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    {!isPositive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                        <Check className="h-3 w-3" /> La Doortay
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="text-base font-bold text-rose-950">Danbi / Khaldan (Misconduct / Concern)</div>
                    <p className="text-xs text-rose-800/80 mt-1 leading-relaxed">
                      Qalalaase fasalka dhexdiisa ah, daahid soo noqnoqotay, maqnaansho, khilaaf/dagaal, khiyaano imtixaan, ama anshax-xumo.
                    </p>
                  </div>
                </button>

                {/* Wanaag Card */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPositive(true);
                    setCategory("POSITIVE_CONDUCT");
                    setSeverity("LOW");
                  }}
                  className={`relative flex flex-col p-5 rounded-2xl border-2 text-left transition-all ${
                    isPositive
                      ? "border-emerald-500 bg-emerald-50/60 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/10"
                      : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                        isPositive
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                    >
                      <Sparkles className="h-5 w-5" />
                    </div>
                    {isPositive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                        <Check className="h-3 w-3" /> La Doortay
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="text-base font-bold text-emerald-950">Wanaag & Abaalmarin (Positive Conduct / Merit)</div>
                    <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                      Dabeecad iyo akhlaaq wanaagsan, kaalmo ardayda kale la siiyey, dadaal waxbarasho, ama hoggaamin togan.
                    </p>
                  </div>
                </button>
              </div>

              {/* Sub-Category Picker & Severity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Qaybta Gaarka ah (Category) *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {isPositive ? (
                      <option value="POSITIVE_CONDUCT">Dhaqan Wanaag / Abaalmarin / Hoggaan (Merit)</option>
                    ) : (
                      <>
                        <option value="CLASSROOM_DISRUPTION">Qalalaase Fasalka Dhexdiisa ah (Disruption)</option>
                        <option value="REPEATED_LATENESS">Soo Daahid Soo Noqnoqotay (Repeated Lateness)</option>
                        <option value="UNEXCUSED_ABSENCE">Maqnaansho Aan Fasax Lahayn (Unexcused Absence)</option>
                        <option value="PEER_CONFLICT">Khilaaf ama Dagaal Ardayda ah (Peer Conflict)</option>
                        <option value="ACADEMIC_DISHONESTY">Khiyaano Imtixaan / Qish (Academic Dishonesty)</option>
                        <option value="PROPERTY_DAMAGE">Waxyeello Hanti Dugsiga ah (Property Damage)</option>
                        <option value="WELFARE_CONCERN">Xaalad Daryeel ama Caafimaad (Welfare Concern)</option>
                        <option value="SAFEGUARDING">Badbaadada Degdegga ah (Safeguarding)</option>
                        <option value="OTHER">Dhacdo Kale (Other Incident)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Culayska Dhacdada (Severity Level)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSeverity(sev)}
                        className={`rounded-xl py-2.5 text-xs font-extrabold border transition ${
                          severity === sev
                            ? sev === "URGENT"
                              ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20"
                              : sev === "HIGH"
                              ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                              : "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TALLAABADA 3: TAARIIKHDA, CINWAANKA & SHARRAXAADDA */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white shadow-md shadow-indigo-500/30">
                  3
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Taariikhda, Cinwaanka iyo Sharraxaadda (Narrative & Timestamp)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Taariikhda iyo waqtiga mar walba way la socdaan warbixintan (Strictly tracked)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                      Taariikhda & Waqtiga (Date & Time) *
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600">Mar walba way la socotaa</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    Goobta ay ka Dhacday (Location - Optional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Fasalka 3B, Barxadda ciyaarta, Maktabadda"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cinwaanka Warbixinta (Report Title) *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ardayga oo si joogto ah u soo daaha fasalka subaxdii / Dhaqan wanaag iyo gargaar"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none placeholder:font-normal"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Sharraxaad Xaqiiqo ah (Factual Description / Sharrax) *</span>
                  <span className="text-xs text-slate-400 font-normal">{description.length} xaraf</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qor xaqiiqada dhabta ah ee dhacday, ardayda kale ee goobjoogga ahaa, iyo hadalladii la is dhaafsaday si dhexdhexaad ah oo cad."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tallaabadii aad Adigu Qaadday (Actions Already Taken - Optional)
                </label>
                <input
                  type="text"
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  placeholder="e.g. Digniin afka ah ayaan siiyey, fadhiga ayaan ka beddelay, ardayda kale ayaan ka dhex saaray"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                  Ku Lifaaq Sawir ama Dukumiinti (Attachment - Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
            </div>

            {/* CONFIDENTIALITY REASSURANCE BANNER */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 text-blue-950 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-sm text-blue-950">Xeerka Qarsoodiga Macallinka (Confidentiality Guaranteed)</h4>
                <p className="text-blue-900 leading-relaxed">
                  Warbixintan waxay si toos ah oo sir ah ugu dhacaysaa <strong>Maamulka Dugsiga (School Administration)</strong>.
                  Adminka ayaa marka hore furi doona, taaban doona <em>"Accept / Approve"</em>, kaddibna go'aamin doona
                  haddii uu la wadaagayo waalidka, ardayga ama uu u haynayo kayd ahaan (history).
                  <strong> Ardayga iyo waalidku ma arki karaan magacaaga macallin ahaan.</strong>
                </p>
              </div>
            </div>

            {/* SUBMIT ACTIONS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Ka Noqo (Cancel)
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(true)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  Qabyo u Dhig (Save Draft)
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Gudbinayaa...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>U Gudbi Maamulka (Submit to Admin)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: REPORTS LIST */}
      {viewMode === "LIST" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Raadi magaca ardayga, lambarka warbixinta (CR-...), ama cinwaanka..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              {["ALL", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "RESOLVED", "DRAFT"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                    statusFilter === status
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {status === "ALL" ? "Dhammaan (All)" : statusStyles[status]?.label || status}
                </button>
              ))}
            </div>
          </div>

          {/* List Content */}
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <RefreshCw className="h-7 w-7 animate-spin text-indigo-600" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-800">Wax warbixin ah lama helin</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Weli ma aadan qorin wax warbixin ah ama shaandhada aad dooratay ma lahan wax u dhigma.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setViewMode("CREATE");
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" />
                Qor Warbixin Cusub Hadda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredReports.map((item) => {
                const cat = categoryLabels[item.category] || categoryLabels.OTHER;
                const CategoryIcon = cat.icon;
                const statusStyle = statusStyles[item.status] || statusStyles.DRAFT;
                const sevStyle = severityStyles[item.severity] || severityStyles.LOW;

                return (
                  <div
                    key={item.id}
                    onClick={() => openDetail(item.id)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md cursor-pointer sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                          item.isPositive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm"
                            : item.severity === "URGENT"
                            ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <CategoryIcon className="h-6 w-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {item.reportNumber}
                          </span>
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{item.studentName}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-semibold">
                            {item.classLabel} · Section {item.sectionName}
                          </span>
                          {item.isPositive ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> Wanaag
                            </span>
                          ) : (
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                              Danbi / Incident
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{item.title}</h4>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(item.incidentDate).toLocaleString()}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {item.location}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50/70 px-2 py-0.5 rounded">
                            <Lock className="h-3 w-3" />
                            Gacanta Maamulka
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${statusStyle.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                          {statusStyle.label}
                        </span>
                        <span className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${sevStyle.badge}`}>
                          {sevStyle.label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-600 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedReportId && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-slate-700">{detail.reportNumber}</span>
                <span className={`rounded-xl border px-3 py-1 text-xs font-bold ${statusStyles[detail.status]?.badge}`}>
                  {statusStyles[detail.status]?.label || detail.status}
                </span>
                {detail.isPositive ? (
                  <span className="rounded-lg bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    Wanaag
                  </span>
                ) : (
                  <span className="rounded-lg bg-rose-100 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-800">
                    Danbi
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

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Student Header */}
              <div className="flex items-center gap-4 rounded-2xl bg-indigo-50/40 p-4 border border-indigo-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-sm">
                  {detail.student.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">{detail.student.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permanent ID: <span className="font-mono font-semibold text-slate-700">{detail.student.permanentId}</span> ·{" "}
                    {detail.enrollment.classLabel} (Section {detail.enrollment.sectionName})
                  </p>
                </div>
              </div>

              {/* Confidentiality reminder */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 border border-slate-200">
                <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                <span>
                  Warbixintan waxay toos u gaartay <strong>Maamulka Dugsiga</strong>. Magacaaga looma sheegi doono ardayga ama waalidka.
                </span>
              </div>

              {/* Incident Details */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Faahfaahinta Dhacdada
                  </span>
                  <span className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${severityStyles[detail.severity]?.badge}`}>
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
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-slate-700 mb-1">Tallaabadii aad adigu qaadday:</h5>
                    <p className="text-xs text-slate-600 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                      {detail.actionsTakenByTeacher}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions & Administration Timeline */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Taariikhda Tallaabooyinka Maamulka
                </span>
                {detail.actions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Weli maamulku tallaabo kama qaadin warbixintan.</p>
                ) : (
                  <div className="space-y-3 border-l-2 border-indigo-200 pl-4 ml-2">
                    {detail.actions.map((act) => (
                      <div key={act.id} className="relative text-xs space-y-0.5">
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 border-2 border-white" />
                        <div className="font-bold text-slate-800">{act.actionType.replace("_", " ")}</div>
                        <div className="text-slate-600">{act.comment}</div>
                        <div className="text-[10px] text-slate-400">
                          {act.actorName} · {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
