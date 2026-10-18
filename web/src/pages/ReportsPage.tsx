import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  useEffect(() => {
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
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load reports."));
  }, []);

  async function downloadCsv() {
    try {
      const response = await fetch("/api/v1/reports/fee-defaulters.csv", { credentials: "include" });
      if (!response.ok) throw new Error("Could not download CSV.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fee-defaulters.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV download failed.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Fee defaulters</h2>
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={downloadCsv}>
            Export CSV
          </button>
        </div>
        {fees.map((row) => (
          <article key={`${row.permanentId}-${row.title}`} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <p className="font-semibold">{row.student} · {row.permanentId}</p>
            <p className="text-sm text-slate-500">{row.year} · {row.level} {row.section} · {row.title}</p>
            <p className="mt-1">Balance {row.balance} · {row.status}</p>
          </article>
        ))}
        {!fees.length ? <p className="text-slate-500">No outstanding fees.</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Attendance by section</h2>
        {attendance.map((row) => (
          <article key={`${row.year}-${row.level}-${row.section}`} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <p className="font-semibold">{row.year} · {row.level} {row.section}</p>
            <p className="text-sm text-slate-500">{row.students} students · present {row.present} · absent {row.absent}</p>
            <p className="mt-1">Rate {row.rate == null ? "—" : `${row.rate}%`}</p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Alumni</h2>
        {alumni.map((row) => (
          <article key={row.permanentId + row.reason} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <p className="font-semibold">{row.name} · {row.permanentId}</p>
            <p className="text-sm text-slate-500">{row.fromLevel} · {row.reason}</p>
          </article>
        ))}
        {!alumni.length ? <p className="text-slate-500">No alumni records yet.</p> : null}
      </section>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
