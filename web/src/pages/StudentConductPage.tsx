import { useEffect, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "../lib/api";

type StudentConductReport = {
  id: string;
  reportNumber: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isPositive: boolean;
  title: string;
  incidentDate: string;
  description: string;
  status: string;
  resolutionNotes: string | null;
  classLabel: string;
  sectionName: string;
  academicYear: string;
  timeline: Array<{
    id: string;
    actionType: string;
    comment: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    title: string;
    originalName: string;
    sizeBytes: number;
  }>;
};

export function StudentConductPage() {
  const [reports, setReports] = useState<StudentConductReport[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api<{ studentName: string; reports: StudentConductReport[] }>("/api/v1/student/conduct");
      setReports(data.reports);
      setStudentName(data.studentName);
    } catch (err: any) {
      alert(err?.message || "Failed to load conduct records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const positiveMerits = reports.filter((r) => r.isPositive);
  const actionPlans = reports.filter((r) => !r.isPositive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conduct & Merits</h1>
          <p className="text-sm text-slate-500">
            View your school achievements, leadership recognitions, and constructive progress plans.
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Merits & Commendations Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Positive Recognitions</span>
            <Award className="h-6 w-6 text-emerald-200" />
          </div>
          <div className="mt-3 text-3xl font-extrabold">{positiveMerits.length}</div>
          <p className="mt-1 text-xs text-emerald-100">Merits, leadership, and positive achievements recorded this year.</p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-500 to-blue-600 p-5 text-white shadow-lg shadow-indigo-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">Growth & Action Items</span>
            <ShieldCheck className="h-6 w-6 text-indigo-200" />
          </div>
          <div className="mt-3 text-3xl font-extrabold">{actionPlans.length}</div>
          <p className="mt-1 text-xs text-indigo-100">Agreed follow-ups and constructive goals with your teachers.</p>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-800">No conduct records published</h3>
          <p className="mt-1 text-sm text-slate-500">
            Keep up the great work! Your positive recognitions and action agreements will appear here once approved.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`rounded-2xl border p-5 shadow-sm bg-white space-y-3 transition ${
                report.isPositive
                  ? "border-emerald-200 hover:border-emerald-300"
                  : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      report.isPositive ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {report.isPositive ? <Award className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{report.title}</h3>
                    <p className="text-xs text-slate-400">
                      {report.academicYear} · {report.classLabel} ({report.sectionName}) · Ref #{report.reportNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold border ${
                      report.isPositive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {report.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {report.description}
              </div>

              {report.resolutionNotes && (
                <div className="rounded-xl bg-indigo-50/60 p-3 text-xs text-indigo-900 border border-indigo-100">
                  <span className="font-bold">Agreed Action & Next Steps:</span>
                  <p className="mt-1">{report.resolutionNotes}</p>
                </div>
              )}

              {/* Attachments */}
              {report.attachments.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {report.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/v1/conduct/attachments/${att.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-slate-50 transition"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {att.title || att.originalName}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
