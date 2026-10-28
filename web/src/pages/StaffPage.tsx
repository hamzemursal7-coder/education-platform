import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Pencil,
  KeyRound,
  Mail,
  Phone,
  Briefcase,
  IdCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye
} from "lucide-react";
import { api, type SessionUser } from "../lib/api";
import { PasswordLinkDialog, passwordLinkUrl } from "../components/PasswordLinkDialog";
import { ConfirmModal } from "../components/ConfirmModal";

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
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    designation: "Accountant",
    role: "ACCOUNTANT",
  });
  const [invitePath, setInvitePath] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setRows(await api<StaffRow[]>("/api/v1/staff"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load staff."));
  }, []);

  async function createStaff(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const created = await api<{ setPasswordPath: string; publicId: string }>("/api/v1/staff", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setInvitePath(passwordLinkUrl(created.setPasswordPath));
      setInviteEmail(form.email);
      setForm({ firstName: "", lastName: "", email: "", phone: "", designation: "Accountant", role: "ACCOUNTANT" });
      setShowAdd(false);
      setMessage("Staff member successfully created.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the staff member.");
    }
  }

  async function toggleStatus(id: string) {
    setError("");
    setMessage("");
    try {
      const res = await api<{ ok: boolean; isActive: boolean }>(`/api/v1/staff/${id}/toggle-status`, { method: "POST" });
      setMessage(`Staff member is now ${res.isActive ? "Active" : "Deactivated"}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update staff status.");
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<"SCHOOL_ONLY" | "ALL_ORGANIZATION">("SCHOOL_ONLY");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    api<SessionUser>("/api/v1/auth/me")
      .then((u) => setIsSuperAdmin(u.role === "SUPER_ADMIN" || Boolean(u.actingFromSuperAdmin)))
      .catch(() => {});
  }, []);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/v1/staff/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ scope: deleteScope }),
      });
      setMessage(`Staff member "${deleteTarget.name}" was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete staff member.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <Users className="h-3.5 w-3.5" />
              Staff Management
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              School Staff & Accountants
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage non-teaching administrative staff, accountants, and their system access credentials.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition active:scale-95"
            onClick={() => setShowAdd((prev) => !prev)}
          >
            <UserPlus className="h-4 w-4" />
            {showAdd ? "Close Form" : "Add Staff Member"}
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Add Staff Card */}
      {showAdd && (
        <form onSubmit={createStaff} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm animate-in fade-in duration-200">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-600" />
            New Staff Member
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Enter details to invite a staff member to the platform.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              First name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Last name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Email Address *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" placeholder="email@school.edu" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Phone Number *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" placeholder="+252..." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Designation *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" placeholder="e.g. Chief Accountant" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              System Role *
              <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="STAFF">General Staff</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">Save & Invite Staff</button>
          </div>
        </form>
      )}

      {invitePath ? <PasswordLinkDialog email={inviteEmail} url={invitePath} onClose={() => setInvitePath("")} /> : null}

      {/* Staff List Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Staff Member</th>
              <th className="px-5 py-3.5">ID & Role</th>
              <th className="px-5 py-3.5">Contact</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white shadow-sm text-sm">
                      {row.name.split(/\s+/).slice(0, 2).map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <Link to={`/school/staff/${row.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition">
                        {row.name}
                      </Link>
                      <p className="text-xs text-slate-400">{row.designation}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {row.publicId}
                  </span>
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {row.role}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Mail className="h-3 w-3 text-slate-400" /> {row.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Phone className="h-3 w-3 text-slate-400" /> {row.phone}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${row.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {row.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleStatus(row.id)}
                      className={`p-1.5 rounded-xl border border-slate-200 transition shadow-sm ${
                        row.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title={row.isActive ? "Deactivate Staff Member" : "Activate Staff Member"}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to={`/school/staff/${row.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-300 transition shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(row);
                        setDeleteScope("SCHOOL_ONLY");
                      }}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition shadow-sm"
                      title="Permanently Delete Staff"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  No staff members registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Staff ConfirmModal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Digniin Culus: Tirtiridda Shaqaalaha"
        targetName={deleteTarget?.name}
        targetType="Staff Member"
        description={`Ma hubtaa inaad tirtirto xubintan shaqaalaha ah (${deleteTarget?.name})? Tallaabadan dib looma soo celin karo.`}
        confirmText="Haa, Tirtir Shaqaalaha"
        cancelText="Ka Noqo"
        isDestructive={true}
        requireKeyword="DELETE"
        showMultiSchoolScope={isSuperAdmin}
        scope={deleteScope}
        onScopeChange={setDeleteScope}
      />
    </div>
  );
}

export function StaffProfilePage() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<(StaffRow & { firstName: string; lastName: string; school: { name: string }; hasLogin: boolean }) | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", designation: "" });
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<NonNullable<typeof profile>>(`/api/v1/staff/${staffId}`);
    setProfile(data);
    setForm({ firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, designation: data.designation });
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load staff."));
  }, [staffId]);

  async function toggleStatus() {
    if (!profile) return;
    setError("");
    try {
      const res = await api<{ ok: boolean; isActive: boolean }>(`/api/v1/staff/${profile.id}/toggle-status`, { method: "POST" });
      setMessage(`Staff member is now ${res.isActive ? "Active" : "Deactivated"}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not toggle status.");
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"SCHOOL_ONLY" | "ALL_ORGANIZATION">("SCHOOL_ONLY");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    api<SessionUser>("/api/v1/auth/me")
      .then((u) => setIsSuperAdmin(u.role === "SUPER_ADMIN" || Boolean(u.actingFromSuperAdmin)))
      .catch(() => {});
  }, []);

  async function handleConfirmDelete() {
    if (!profile) return;
    setError("");
    try {
      await api(`/api/v1/staff/${profile.id}`, {
        method: "DELETE",
        body: JSON.stringify({ scope: deleteScope }),
      });
      navigate("/school/staff");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete staff member.");
    }
  }

  if (!profile) return <p className="text-slate-500 p-8">{error || "Loading staff profile..."}</p>;

  return (
    <div className="space-y-6">
      {/* Top Profile Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-blue-600 font-bold text-white text-xl shadow-sm">
              {profile.name.split(/\s+/).slice(0, 2).map((n) => n[0]).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  {profile.publicId}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    profile.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${profile.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {profile.isActive ? "Active" : "Deactivated"}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black text-slate-900">{profile.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile.designation} · {profile.school.name} · Role: {profile.role}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
              onClick={() => setEditing((prev) => !prev)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {editing ? "Cancel Edit" : "Edit Details"}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              onClick={() => {
                api<{ setPasswordPath: string }>(`/api/v1/staff/${staffId}/access`, { method: "POST" })
                  .then((result) => setPasswordLink(passwordLinkUrl(result.setPasswordPath)))
                  .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
              }}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {profile.hasLogin ? "Reset Password" : "Invite to Portal"}
            </button>

            <button
              type="button"
              onClick={toggleStatus}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition ${
                profile.isActive ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {profile.isActive ? "Deactivate" : "Activate"}
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteScope("SCHOOL_ONLY");
                setDeleteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {passwordLink && <PasswordLinkDialog url={passwordLink} onClose={() => setPasswordLink("")} />}

      {/* Edit Form */}
      {editing && (
        <form
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            api(`/api/v1/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(form) })
              .then(() => { setEditing(false); setMessage("Staff details updated."); return load(); })
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update staff."));
          }}
        >
          <h3 className="text-sm font-bold text-slate-900 mb-4">Edit Staff Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              First name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Last name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Email Address *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Phone Number *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Designation *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} required />
            </label>
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">Save Changes</button>
          </div>
        </form>
      )}

      {/* Details Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Contact & Employment Records</h3>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs text-slate-400">Email Address</span>
            <p className="font-bold text-slate-900 mt-1 text-sm">{profile.email}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs text-slate-400">Phone</span>
            <p className="font-bold text-slate-900 mt-1 text-sm">{profile.phone}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs text-slate-400">Assigned School</span>
            <p className="font-bold text-slate-900 mt-1 text-sm">{profile.school.name}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs text-slate-400">Account Status</span>
            <p className="font-bold text-emerald-600 mt-1 text-sm">{profile.status}</p>
          </div>
        </div>
      </div>

      {/* Delete Staff Member ConfirmModal */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Digniin Culus: Tirtiridda Shaqaalaha"
        targetName={profile.name}
        targetType="Staff Member"
        description={`Ma hubtaa inaad tirtirto shaqaalahan (${profile.name})? Tallaabadan dib looma soo celin karo.`}
        confirmText="Haa, Tirtir Shaqaalaha"
        cancelText="Ka Noqo"
        isDestructive={true}
        requireKeyword="DELETE"
        showMultiSchoolScope={isSuperAdmin}
        scope={deleteScope}
        onScopeChange={setDeleteScope}
      />
    </div>
  );
}
