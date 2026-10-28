import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Percent,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "../lib/api";

type FeeRow = {
  permanentId: string;
  student: string;
  year: string;
  level: string;
  section: string;
  title: string;
  balance: number;
  status: string;
};

type AttendanceRow = {
  year: string;
  level: string;
  section: string;
  students: number;
  present: number;
  absent: number;
  total: number;
  rate: number | null;
};

type AlumniRow = {
  permanentId: string;
  name: string;
  fromLevel: string;
  reason: string;
};

export function ReportsPage() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"FEES" | "ATTENDANCE" | "ALUMNI">("FEES");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<FeeRow[]>("/api/v1/reports/fee-defaulters"),
      api<AttendanceRow[]>("/api/v1/reports/attendance-summary"),
      api<AlumniRow[]>("/api/v1/reports/alumni"),
    ])
      .then(([feeRows, attendanceRows, alumniRows]) => {
        setFees(feeRows);
        setAttendance(attendanceRows);
        setAlumni(alumniRows);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load reports."))
      .finally(() => setLoading(false));
  }, []);

  async function downloadCsv(type: "fees" | "attendance") {
    setDownloading(type);
    try {
      const endpoint =
        type === "fees" ? "/api/v1/reports/fee-defaulters.csv" : "/api/v1/reports/attendance-summary.csv";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Could not download CSV file.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV download failed.");
    } finally {
      setDownloading(null);
    }
  }

  // Summary Metrics
  const totalOutstanding = fees.reduce((acc, f) => acc + (f.balance || 0), 0);
  const totalDefaulters = fees.length;
  const avgAttendanceRate =
    attendance.length > 0
      ? Math.round(
          attendance.reduce((acc, a) => acc + (a.rate || 0), 0) / attendance.length
        )
      : 0;

  // Filtered lists
  const filteredFees = fees.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.student.toLowerCase().includes(q) ||
      f.permanentId.toLowerCase().includes(q) ||
      f.section.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q)
    );
  });

  const filteredAttendance = attendance.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.section.toLowerCase().includes(q) ||
      a.level.toLowerCase().includes(q) ||
      a.year.toLowerCase().includes(q)
    );
  });

  const filteredAlumni = alumni.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.permanentId.toLowerCase().includes(q) ||
      a.fromLevel.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-[#2563eb]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reports & Analytics Center</h1>
              <p className="text-xs text-slate-500">
                Generate, analyze, and export financial, attendance, and student performance reports.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadCsv("fees")}
            disabled={downloading !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export Fees CSV</span>
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("attendance")}
            disabled={downloading !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export Attendance CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Outstanding Fees</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              ${totalOutstanding.toLocaleString()}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {totalDefaulters} students with balance
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#2563eb]">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Average Attendance Rate</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {avgAttendanceRate}%
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Across {attendance.length} class sections
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Alumni Graduated</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {alumni.length}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Completed academic cycles
            </p>
          </div>
        </div>
      </div>

      {/* Tabs and Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("FEES")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "FEES"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Fee Defaulters ({fees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "ATTENDANCE"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Attendance by Section ({attendance.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ALUMNI")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "ALUMNI"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Alumni Records ({alumni.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search report records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#2563eb] focus:outline-none"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-400">Loading reports data...</div>
      ) : activeTab === "FEES" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Permanent ID</th>
                  <th className="px-4 py-3">Class & Section</th>
                  <th className="px-4 py-3">Fee Title</th>
                  <th className="px-4 py-3">Balance Due</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFees.map((row) => (
                  <tr key={`${row.permanentId}-${row.title}`} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.student}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{row.permanentId}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.level} - {row.section}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.title}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">${row.balance}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredFees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No fee defaulter records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "ATTENDANCE" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Academic Year</th>
                  <th className="px-4 py-3">Class Level</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttendance.map((row) => {
                  const rate = row.rate ?? 0;
                  return (
                    <tr key={`${row.year}-${row.level}-${row.section}`} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.year}</td>
                      <td className="px-4 py-3 text-slate-700">{row.level}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.section}</td>
                      <td className="px-4 py-3 font-medium text-slate-600">{row.students}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{row.present}</td>
                      <td className="px-4 py-3 font-medium text-rose-600">{row.absent}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#2563eb] h-2 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-800">{row.rate == null ? "—" : `${rate}%`}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No attendance summary records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Graduate Name</th>
                  <th className="px-4 py-3">Permanent ID</th>
                  <th className="px-4 py-3">Completion Level</th>
                  <th className="px-4 py-3">Graduation Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlumni.map((row) => (
                  <tr key={`${row.permanentId}-${row.reason}`} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{row.permanentId}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-purple-50 border border-purple-200/70 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                        {row.fromLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                  </tr>
                ))}
                {filteredAlumni.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No alumni records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
