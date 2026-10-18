import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type StaffRow = {
  id: string;
  publicId: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  role: string;
  status: string;
  isActive: boolean;
};

export function StaffPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    designation: "Accountant",
    role: "ACCOUNTANT",
  });
  const [invitePath, setInvitePath] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<StaffRow[]>("/api/v1/staff"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load staff."));
  }, []);

  async function createStaff(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const created = await api<{ setPasswordPath: string; publicId: string }>("/api/v1/staff", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setInvitePath(`${created.publicId} · ${created.setPasswordPath}`);
      setForm({ firstName: "", lastName: "", email: "", phone: "", designation: "Accountant", role: "ACCOUNTANT" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the staff member.");
    }
  }

  async function deactivate(id: string) {
    try {
      await api(`/api/v1/staff/${id}/deactivate`, { method: "POST" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate staff.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createStaff} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm md:grid-cols-3">
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        <input className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} required />
        <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="STAFF">Staff</option>
        </select>
        <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 md:col-span-3">Add staff</button>
      </form>
      {invitePath ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
          Invite created: {invitePath}
        </p>
      ) : null}
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
          <p className="font-semibold"><Link className="text-blue-700" to={`/school/staff/${row.id}`}>{row.name}</Link> · {row.publicId}</p>
          <p className="text-sm text-slate-500">{row.role} · {row.designation} · {row.status}</p>
          <p className="mt-1 text-sm">{row.email} · {row.phone}</p>
          {row.isActive ? (
            <button type="button" className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => deactivate(row.id)}>
              Deactivate
            </button>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Inactive</p>
          )}
        </article>
      ))}
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}

export function StaffProfilePage() {
  const { staffId } = useParams();
  const [profile, setProfile] = useState<(StaffRow & { firstName: string; lastName: string; school: { name: string }; hasLogin: boolean }) | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", designation: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<NonNullable<typeof profile>>(`/api/v1/staff/${staffId}`);
    setProfile(data);
    setForm({ firstName: data.firstName, lastName: data.lastName, phone: data.phone, designation: data.designation });
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load staff."));
  }, [staffId]);

  if (!profile) return <p className="text-slate-500">{error || "Loading staff profile..."}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/school/staff" className="text-sm font-medium text-blue-600">Staff</Link>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">{profile.name}</h2>
          <p className="text-sm text-slate-500">{profile.publicId} · {profile.school.name} · {profile.designation}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700" onClick={() => {
            api<{ setPasswordPath: string }>(`/api/v1/staff/${staffId}/access`, { method: "POST" })
              .then((result) => setMessage(`${profile.hasLogin ? "Reset" : "Invite"} link: ${result.setPasswordPath}`))
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
          }}>{profile.hasLogin ? "Reset password" : "Invite login"}</button>
        </div>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <p>{profile.email} · {profile.phone}</p>
        <p className="mt-1">{profile.role} · {profile.status}</p>
      </article>
      {message ? <p className="text-blue-700">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      {editing ? (
        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          api(`/api/v1/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(form) })
            .then(() => { setEditing(false); setMessage("Staff details updated."); return load(); })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update staff."));
        }}>
          <input className="rounded-xl border border-slate-200 px-3 py-2" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
          <input className="rounded-xl border border-slate-200 px-3 py-2" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          <input className="rounded-xl border border-slate-200 px-3 py-2" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <input className="rounded-xl border border-slate-200 px-3 py-2" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} required />
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
