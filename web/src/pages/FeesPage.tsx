import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Fee = {
  id: string;
  title: string;
  type: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  year: string;
  student: string;
  permanentId: string;
  payments: Array<{ id: string; receiptNumber: string; amount: number }>;
};

type StudentRow = {
  id: string;
  permanentId: string;
  name: string;
  enrollmentId: string | null;
};

export function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [type, setType] = useState("TUITION");
  const [title, setTitle] = useState("Term tuition");
  const [amount, setAmount] = useState(100);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [feeRows, studentRows] = await Promise.all([
      api<Fee[]>("/api/v1/fees"),
      api<{ students: StudentRow[] }>("/api/v1/students"),
    ]);
    setFees(feeRows);
    setStudents(studentRows.students);
    const first = studentRows.students.find((student) => student.enrollmentId)?.enrollmentId ?? "";
    setEnrollmentId((current) => current || first);
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load fees."));
  }, []);

  async function createFee(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/v1/fees", {
        method: "POST",
        body: JSON.stringify({ enrollmentId, type, title, amount: Number(amount) }),
      });
      setMessage("Fee created.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the fee.");
    }
  }

  async function pay(feeId: string) {
    const value = Number(window.prompt("Payment amount", "50") ?? "0");
    if (!value) return;
    try {
      const payment = await api<{ receiptNumber: string }>(`/api/v1/fees/${feeId}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: value }),
      });
      setMessage(`Payment saved. Receipt ${payment.receiptNumber}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record payment.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createFee} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm md:grid-cols-4">
        <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} required>
          {students.filter((student) => student.enrollmentId).map((student) => (
            <option key={student.id} value={student.enrollmentId!}>{student.name} · {student.permanentId}</option>
          ))}
        </select>
        <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={type} onChange={(event) => setType(event.target.value)}>
          {["TUITION", "REGISTRATION", "TRANSPORT", "EXAM", "UNIFORM", "BOOKS", "OTHER"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} required />
        <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 md:col-span-4">Create fee</button>
      </form>
      {fees.map((fee) => (
        <article key={fee.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
          <p className="font-semibold">{fee.student} · {fee.permanentId}</p>
          <p className="text-sm text-slate-500">{fee.year} · {fee.type} · {fee.title}</p>
          <p className="mt-2">Amount {fee.amount} · Paid {fee.paidAmount} · Balance {fee.balance} · {fee.status}</p>
          {fee.payments.map((payment) => (
            <p key={payment.id} className="text-sm">{payment.receiptNumber}: {payment.amount}</p>
          ))}
          {fee.status !== "PAID" && fee.status !== "WAIVED" ? (
            <button type="button" className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => pay(fee.id)}>Record payment</button>
          ) : null}
        </article>
      ))}
      {message ? <p className="text-blue-600">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
