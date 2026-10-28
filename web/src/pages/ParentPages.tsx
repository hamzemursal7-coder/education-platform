import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Eye,
  Filter,
  IdCard,
  Mail,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Receipt,
  School,
  Search,
  Send,
  UserRound,
  Users,
  Wallet,
  Check,
  CheckCircle2,
  Sparkles,
  FileText,
  CalendarCheck2,
  GraduationCap,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  RefreshCw,
  X,
  UserPlus,
  Trash2,
  Home,
  Hash,
  ShieldAlert,
  Award,
  HeartHandshake,
  Paperclip
} from "lucide-react";
import { api, type SessionUser } from "../lib/api";
import { PasswordLinkDialog, passwordLinkUrl } from "../components/PasswordLinkDialog";
import { Avatar, DataTable } from "../components/PeopleList";
import { ConfirmModal } from "../components/ConfirmModal";

type ParentRow = {
  id: string;
  publicId: string;
  name: string;
  phone: string;
  email: string | null;
  portalStatus: string;
  childrenCount: number;
  children: Array<{
    id: string;
    permanentId: string;
    name: string;
    relationship: string;
    school?: string;
    level: string;
    section: string;
  }>;
};

export function SchoolParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState<{ url: string; email?: string } | null>(null);
  const [q, setQ] = useState("");
  const [portal, setPortal] = useState<"ALL" | "ACTIVE" | "INVITED" | "NONE">("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationalId: "", dateOfBirth: "" });
  const [deleteParent, setDeleteParent] = useState<ParentRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<"SCHOOL_ONLY" | "ALL_ORGANIZATION">("SCHOOL_ONLY");
  const [toggleParent, setToggleParent] = useState<ParentRow | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    api<SessionUser>("/api/v1/auth/me")
      .then((u) => setIsSuperAdmin(u.role === "SUPER_ADMIN" || Boolean(u.actingFromSuperAdmin)))
      .catch(() => {});
  }, []);

  async function handleConfirmDelete() {
    if (!deleteParent) return;
    setError("");
    try {
      await api(`/api/v1/parents/${deleteParent.id}`, {
        method: "DELETE",
        body: JSON.stringify({ scope: deleteScope }),
      });
      setDeleteParent(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting parent");
    }
  }

  async function handleConfirmToggle() {
    if (!toggleParent) return;
    setError("");
    try {
      await api(`/api/v1/parents/${toggleParent.id}/toggle-status`, { method: "POST" });
      setToggleParent(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating parent status");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api<ParentRow[]>("/api/v1/parents");
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load parents."));
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.portalStatus === "ACTIVE").length;
    const invited = rows.filter((r) => r.portalStatus === "INVITED").length;
    const noAccount = rows.filter((r) => r.portalStatus === "NONE").length;
    const totalChildren = rows.reduce((sum, r) => sum + (r.childrenCount || 0), 0);
    return { total, active, invited, noAccount, totalChildren };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const hay = `${row.name} ${row.publicId} ${row.phone} ${row.email ?? ""} ${row.children.map((child) => child.name).join(" ")}`.toLowerCase();
    if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
    if (portal !== "ALL" && row.portalStatus !== portal) return false;
    return true;
  }), [rows, q, portal]);

  async function invite(parent: ParentRow) {
    setError("");
    setMessage("");
    try {
      const email = parent.email || window.prompt("Parent email for portal invite:");
      if (!email) return;
      const invited = await api<{ setPasswordPath: string }>(`/api/v1/guardians/${parent.id}/invite`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setPasswordLink({ url: passwordLinkUrl(invited.setPasswordPath), email });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not invite parent.");
    }
  }

  async function createParent(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/v1/parents", { method: "POST", body: JSON.stringify(form) });
      setForm({ firstName: "", lastName: "", phone: "", email: "", nationalId: "", dateOfBirth: "" });
      setShowAdd(false);
      setMessage("Parent successfully created.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create parent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pristine White Header Card with Clean Metrics */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              Parent & Guardian Directory
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Parents & Guardians
            </h2>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              Manage parent accounts, portal access credentials, contact information, and linked student relationships.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all active:scale-[0.98]"
              onClick={() => setShowAdd(true)}
            >
              <UserPlus className="h-4 w-4" />
              Add Parent
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cards matching screenshot style */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Total Parents</span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Active Portal</span>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600">{stats.active}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Send className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Invited</span>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600">{stats.invited}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Linked Children</span>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-600">{stats.totalChildren}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Search by parent name, ID, phone, email, or child..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Portal Status Tabs */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 transition ${portal === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => setPortal("ALL")}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 transition ${portal === "ACTIVE" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => setPortal("ACTIVE")}
          >
            Active ({stats.active})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 transition ${portal === "INVITED" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => setPortal("INVITED")}
          >
            Invited ({stats.invited})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 transition ${portal === "NONE" ? "bg-white text-slate-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            onClick={() => setPortal("NONE")}
          >
            No Portal ({stats.noAccount})
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          {message}
        </div>
      ) : null}

      {passwordLink ? (
        <PasswordLinkDialog url={passwordLink.url} email={passwordLink.email} onClose={() => setPasswordLink(null)} />
      ) : null}

      {/* Directory Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <DataTable
          headers={["Parent / Guardian", "Parent ID", "Contact Information", "Linked Children", "Portal Status", "Actions"]}
          empty={
            loading
              ? "Loading parents..."
              : filtered.length === 0
              ? "No parents match the selected filter criteria."
              : undefined
          }
        >
          {filtered.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} seed={row.publicId} />
                  <div>
                    <Link
                      to={`/school/parents/${row.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 transition"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-slate-400">ID: {row.publicId}</div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3.5">
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                  {row.publicId}
                </span>
              </td>

              <td className="px-4 py-3.5">
                <div className="space-y-1">
                  {row.phone ? (
                    <a
                      href={`tel:${row.phone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {row.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {row.email && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <a href={`mailto:${row.email}`} className="hover:text-blue-600 truncate max-w-[180px]">
                        {row.email}
                      </a>
                    </div>
                  )}
                </div>
              </td>

              <td className="px-4 py-3.5">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {row.childrenCount} {row.childrenCount === 1 ? "Child" : "Children"}
                  </span>
                  {row.children.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.children.slice(0, 2).map((child) => (
                        <span key={child.id} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {child.name.split(" ")[0]} ({child.level})
                        </span>
                      ))}
                      {row.children.length > 2 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{row.children.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </td>

              <td className="px-4 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    row.portalStatus === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : row.portalStatus === "INVITED"
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-slate-100 text-slate-600 border border-slate-200/60"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.portalStatus === "ACTIVE"
                        ? "bg-emerald-500 animate-pulse"
                        : row.portalStatus === "INVITED"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {row.portalStatus === "NONE" ? "No account" : row.portalStatus}
                </span>
              </td>

              <td className="px-4 py-3.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  {row.portalStatus === "NONE" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
                      onClick={() => invite(row)}
                      title="Send portal invitation"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Invite
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setToggleParent(row)}
                      className={`p-1.5 rounded-xl border border-slate-200 transition shadow-sm ${
                        row.portalStatus === "ACTIVE"
                          ? "text-amber-600 hover:bg-amber-50"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title={row.portalStatus === "ACTIVE" ? "Deactivate Parent Portal" : "Activate Parent Portal"}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Link
                    to={`/school/parents/${row.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteParent(row);
                      setDeleteScope("SCHOOL_ONLY");
                    }}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition shadow-sm"
                    title="Delete Parent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* Add Parent Modal */}
      {showAdd ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowAdd(false)}>
          <form
            className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
            onSubmit={createParent}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <UserPlus className="h-3.5 w-3.5" />
                  New Registration
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Add New Parent / Guardian</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Enter parent profile credentials. A portal invite can be dispatched immediately or after creation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                First name *
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. Jama"
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Last name *
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. Warsame"
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Phone Number (optional)
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. +252 61..."
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Email Address
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="email"
                  placeholder="parent@example.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Date of Birth (optional)
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                NIRA National ID (optional)
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="National ID #"
                  value={form.nationalId}
                  onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 transition"
              >
                {saving ? "Saving Record..." : "Create Parent"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {/* Toggle Parent Status ConfirmModal */}
      <ConfirmModal
        isOpen={Boolean(toggleParent)}
        onClose={() => setToggleParent(null)}
        onConfirm={handleConfirmToggle}
        title={toggleParent?.portalStatus === "ACTIVE" ? "Deactivate Parent Portal" : "Activate Parent Portal"}
        targetName={toggleParent?.name}
        targetType="Parent Portal Account"
        description={
          toggleParent?.portalStatus === "ACTIVE"
            ? `Ma hubtaa inaad joojiso (deactivate) koontada waalidka ${toggleParent?.name}? Waalidku ma awoodi doono inuu galo barta waalidiinta ilaa dib loo hawlgaliyo.`
            : `Ma hubtaa inaad hawlgeliso (activate) koontada waalidka ${toggleParent?.name}?`
        }
        confirmText={toggleParent?.portalStatus === "ACTIVE" ? "Jooji Koontada" : "Hawlgeli"}
        cancelText="Ka Noqo"
        isDestructive={toggleParent?.portalStatus === "ACTIVE"}
      />

      {/* Delete Parent ConfirmModal */}
      <ConfirmModal
        isOpen={Boolean(deleteParent)}
        onClose={() => setDeleteParent(null)}
        onConfirm={handleConfirmDelete}
        title="Digniin Culus: Tirtiridda Waalidka"
        targetName={deleteParent?.name}
        targetType="Parent / Waalid"
        description={`Ma hubtaa inaad tirtirto waalidka (${deleteParent?.name})? Tallaabadan dib looma soo celin karo.`}
        confirmText="Haa, Tirtir Waalidka"
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

type ParentProfile = {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string | null;
  nationalId: string | null;
  dateOfBirth?: string | null;
  photoUrl?: string | null;
  portalStatus: string;
  createdAt: string;
  childrenCount: number;
  finances: { invoiced: number; paid: number; balance: number };
  children: Array<{
    id: string;
    permanentId: string;
    name: string;
    photoUrl?: string | null;
    gender: string;
    status: string;
    relationship: string;
    school: string;
    year: string;
    level: string;
    section: string;
    rollNumber: number;
    invoiced: number;
    paid: number;
    balance: number;
  }>;
};

export function SchoolParentProfilePage() {
  const { parentId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState<{ url: string; email?: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationalId: "" });
  const [childQuery, setChildQuery] = useState("");
  const [childSearching, setChildSearching] = useState(false);
  const [childHits, setChildHits] = useState<Array<{ id: string; permanentId: string; name: string; school: string; level: string; section: string; status: string; photoUrl?: string | null }>>([]);
  const [childRelationship, setChildRelationship] = useState("GUARDIAN");
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);
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
      await api(`/api/v1/parents/${profile.id}`, {
        method: "DELETE",
        body: JSON.stringify({ scope: deleteScope }),
      });
      navigate("/school/parents");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete parent.");
    }
  }

  async function handleConfirmToggle() {
    if (!profile) return;
    setError("");
    try {
      await api(`/api/v1/parents/${profile.id}/toggle-status`, { method: "POST" });
      setMessage(`Parent portal account updated.`);
      setToggleOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not toggle parent status.");
    }
  }

  async function handleConfirmUnlink() {
    if (!profile || !unlinkTarget) return;
    setError("");
    try {
      await api(`/api/v1/students/${unlinkTarget.id}/guardians/${profile.id}`, { method: "DELETE" });
      setMessage(`Unlinked ${unlinkTarget.name}.`);
      setUnlinkTarget(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlink student.");
    }
  }

  async function load() {
    if (!parentId) return;
    const data = await api<ParentProfile>(`/api/v1/parents/${parentId}`);
    setProfile(data);
    setForm({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email ?? "",
      nationalId: data.nationalId ?? "",
    });
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load parent."));
  }, [parentId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/api/v1/parents/${parentId}`, { method: "PATCH", body: JSON.stringify(form) });
      setEditing(false);
      setMessage("Parent details successfully updated.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update parent.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSearchChild() {
    if (!childQuery.trim()) return;
    setChildSearching(true);
    try {
      const hits = await api<typeof childHits>(`/api/v1/student-search?q=${encodeURIComponent(childQuery)}`);
      setChildHits(hits);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error searching students.");
    } finally {
      setChildSearching(false);
    }
  }

  if (error && !profile) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-6 text-rose-700">
        <AlertCircle className="h-6 w-6 shrink-0" />
        <div>
          <h3 className="font-bold">Error loading parent</h3>
          <p className="text-sm">{error}</p>
          <Link to="/school/parents" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 underline">
            ← Return to Parents
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          Loading parent profile...
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Linked Children",
      value: profile.childrenCount,
      icon: <Users className="h-5 w-5" />,
      tone: "bg-blue-50 text-blue-600 border-blue-100",
      caption: `${profile.childrenCount} registered in school`,
    },
    {
      label: "Total Invoiced",
      value: `$${profile.finances.invoiced.toLocaleString()}`,
      icon: <Receipt className="h-5 w-5" />,
      tone: "bg-indigo-50 text-indigo-600 border-indigo-100",
      caption: "All academic fees billed",
    },
    {
      label: "Total Paid",
      value: `$${profile.finances.paid.toLocaleString()}`,
      icon: <BadgeCheck className="h-5 w-5" />,
      tone: "bg-emerald-50 text-emerald-600 border-emerald-100",
      caption: "Settled payments",
    },
    {
      label: "Outstanding Balance",
      value: `$${profile.finances.balance.toLocaleString()}`,
      icon: <Wallet className="h-5 w-5" />,
      tone: profile.finances.balance > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100",
      caption: profile.finances.balance > 0 ? "Pending collection" : "Zero outstanding fees",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/school/parents"
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Parents Directory
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Details
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
            onClick={() => {
              setError("");
              const hasPortal = profile.portalStatus !== "NONE";
              const path = hasPortal
                ? api<{ setPasswordPath: string }>(`/api/v1/parents/${profile.id}/access`, { method: "POST" })
                : api<{ setPasswordPath: string }>(`/api/v1/guardians/${profile.id}/invite`, {
                    method: "POST",
                    body: JSON.stringify({ email: profile.email || window.prompt("Parent email for portal invite:") || "" }),
                  });
              path
                .then((result) => {
                  setPasswordLink({ url: passwordLinkUrl(result.setPasswordPath), email: profile.email || undefined });
                  return load();
                })
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
            }}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {profile.portalStatus === "NONE" ? "Invite to Portal" : "Reset Portal Password"}
          </button>
        </div>
      </div>

      {/* Pure White Profile Hero Card matching screenshot */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-5">
            {/* Avatar Circle with Initials and Active Status Dot */}
            <div className="relative shrink-0">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt=""
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover ring-2 ring-slate-100 shadow-sm"
                />
              ) : (
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-blue-600 text-xl sm:text-2xl font-black text-white shadow-sm">
                  {profile.name.split(/\s+/).slice(0, 2).map((n) => n[0]).join("")}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white ${
                  profile.portalStatus === "ACTIVE"
                    ? "bg-emerald-500"
                    : profile.portalStatus === "INVITED"
                    ? "bg-amber-500"
                    : "bg-slate-300"
                }`}
                title={`Portal: ${profile.portalStatus}`}
              />
            </div>

            {/* Profile Info */}
            <div>
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-0.5 font-mono text-xs font-semibold text-blue-600">
                  {profile.publicId}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    profile.portalStatus === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : profile.portalStatus === "INVITED"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      profile.portalStatus === "ACTIVE"
                        ? "bg-emerald-500"
                        : profile.portalStatus === "INVITED"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {profile.portalStatus === "ACTIVE" ? "Active" : profile.portalStatus === "INVITED" ? "Invited" : "No Portal Access"}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                  {profile.childrenCount} {profile.childrenCount === 1 ? "Child Linked" : "Children Linked"}
                </span>
              </div>

              {/* Parent Name */}
              <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {profile.name}
              </h2>

              {/* Subtitle with vertical dividers matching screenshot */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                {profile.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {profile.phone}
                  </span>
                ) : null}

                {profile.phone && profile.email ? <span className="text-slate-300">|</span> : null}

                {profile.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {profile.email}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <Mail className="h-3.5 w-3.5 text-slate-300" />
                    No email yet
                  </span>
                )}

                {profile.nationalId ? (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="inline-flex items-center gap-1.5">
                      <IdCard className="h-3.5 w-3.5 text-slate-400" />
                      NIRA: {profile.nationalId}
                    </span>
                  </>
                ) : null}

                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-slate-400" />
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons matching screenshot */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
              Edit Profile
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              onClick={() => {
                setError("");
                const hasPortal = profile.portalStatus !== "NONE";
                const path = hasPortal
                  ? api<{ setPasswordPath: string }>(`/api/v1/parents/${profile.id}/access`, { method: "POST" })
                  : api<{ setPasswordPath: string }>(`/api/v1/guardians/${profile.id}/invite`, {
                      method: "POST",
                      body: JSON.stringify({ email: profile.email || window.prompt("Parent email for portal invite:") || "" }),
                    });
                path
                  .then((result) => {
                    setPasswordLink({ url: passwordLinkUrl(result.setPasswordPath), email: profile.email || undefined });
                    return load();
                  })
                  .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
              }}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {profile.portalStatus === "NONE" ? "Grant Portal Access" : "Reset Portal Password"}
            </button>

            {/* Deactivate / Activate Parent Portal Account */}
            {profile.portalStatus !== "NONE" && (
              <button
                type="button"
                onClick={() => setToggleOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition ${
                  profile.portalStatus === "ACTIVE"
                    ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
                title={profile.portalStatus === "ACTIVE" ? "Deactivate Parent Portal" : "Activate Parent Portal"}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {profile.portalStatus === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
              </button>
            )}

            {/* Delete Parent Button */}
            <button
              type="button"
              onClick={() => {
                setDeleteScope("SCHOOL_ONLY");
                setDeleteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 transition"
              title="Permanently Delete Parent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* 4 Clean Metric Cards matching screenshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Linked Children */}
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Linked Children</p>
              <p className="text-2xl font-black text-slate-900">{profile.childrenCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Enrolled students</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>

        {/* Total Invoiced */}
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Invoiced</p>
              <p className="text-2xl font-black text-slate-900">${profile.finances.invoiced.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All academic terms</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>

        {/* Total Paid */}
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Paid</p>
              <p className="text-2xl font-black text-slate-900">${profile.finances.paid.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Settled fees</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>

        {/* Outstanding Balance */}
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                profile.finances.balance > 0 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Fee Balance</p>
              <p
                className={`text-2xl font-black ${
                  profile.finances.balance > 0 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                ${profile.finances.balance.toLocaleString()}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  profile.finances.balance > 0 ? "text-rose-500 font-medium" : "text-slate-400"
                }`}
              >
                {profile.finances.balance > 0 ? "Pending collection" : "Fully settled"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          {message}
        </div>
      ) : null}

      {passwordLink ? (
        <PasswordLinkDialog url={passwordLink.url} email={passwordLink.email} onClose={() => setPasswordLink(null)} />
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* REVAMPED LINKED CHILDREN CARD (EXACT MATCH TO SCREENSHOT PARENT/GUARDIAN DESIGN) */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Linked Children ({profile.childrenCount})
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLinkBox((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {showLinkBox ? "Close Link Form" : "Link a Student"}
            </button>
          </div>
        </div>

        {/* EXPANDABLE SLEEK SEARCH & LINK STUDENT BOX */}
        {showLinkBox && (
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/30 p-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                Search & Link Student to this Parent
              </h4>
              <button
                type="button"
                onClick={() => setShowLinkBox(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[240px] flex-1">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Search student by name, student ID (e.g. STU-26-P-000001), phone..."
                  value={childQuery}
                  onChange={(event) => setChildQuery(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchChild();
                  }}
                />
              </div>

              <select
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                value={childRelationship}
                onChange={(event) => setChildRelationship(event.target.value)}
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
              </select>

              <button
                type="button"
                disabled={childSearching}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 transition"
                onClick={handleSearchChild}
              >
                <Search className="h-3.5 w-3.5" />
                {childSearching ? "Searching..." : "Search Student"}
              </button>
            </div>

            {/* Student Search Hits */}
            {childHits.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-blue-100 pt-3">
                <div className="text-xs font-semibold text-slate-500">Matching Students ({childHits.length}):</div>
                {childHits.map((hit) => (
                  <div
                    key={hit.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      {hit.photoUrl ? (
                        <img src={hit.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {hit.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{hit.name}</p>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-600">
                            {hit.permanentId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {hit.school} · {hit.level} {hit.section ? `(${hit.section})` : ""} · Status: {hit.status}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                      onClick={async () => {
                        try {
                          await api(`/api/v1/parents/${profile.id}/children`, {
                            method: "POST",
                            body: JSON.stringify({ studentId: hit.id, relationship: childRelationship }),
                          });
                          setMessage(`Linked ${hit.name} as ${childRelationship.toLowerCase()}.`);
                          setChildHits([]);
                          setChildQuery("");
                          setShowLinkBox(false);
                          await load();
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "Could not link child.");
                        }
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Link to Parent
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Linked Children Rows matching screenshot's Parent / Guardian card */}
        {profile.children.length > 0 ? (
          <div className="space-y-3">
            {profile.children.map((child) => (
              <div
                key={child.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition"
              >
                {/* Child Avatar + Name + Relationship Pill */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  {child.photoUrl ? (
                    <img
                      src={child.photoUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
                      {child.name.split(/\s+/).slice(0, 2).map((n) => n[0]).join("")}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{child.name}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                        {child.relationship}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-400">ID: {child.permanentId}</span>
                  </div>
                </div>

                {/* Class & Section */}
                <div className="flex items-center gap-2.5 min-w-[140px]">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-400 shadow-xs border border-slate-100">
                    <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      {child.level} {child.section ? ` - Sec ${child.section}` : ""}
                    </span>
                    <span className="block text-[11px] text-slate-400">Class & Section</span>
                  </div>
                </div>

                {/* Roll Number */}
                <div className="flex items-center gap-2.5 min-w-[100px]">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-400 shadow-xs border border-slate-100">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      Roll #{child.rollNumber || "—"}
                    </span>
                    <span className="block text-[11px] text-slate-400">Roll Number</span>
                  </div>
                </div>

                {/* Fee Balance */}
                <div className="flex items-center gap-2.5 min-w-[110px]">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-400 shadow-xs border border-slate-100">
                    <Wallet className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div>
                    <span
                      className={`block text-xs font-bold ${
                        child.balance > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      ${child.balance.toLocaleString()}
                    </span>
                    <span className="block text-[11px] text-slate-400">Fee Balance</span>
                  </div>
                </div>

                {/* Actions: View Student Profile ↗ + Relationship Select + Unlink */}
                <div className="flex items-center gap-2">
                  <Link
                    to={`/school/students/${child.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition shadow-sm"
                  >
                    View Student Profile
                    <ExternalLink className="h-3 w-3" />
                  </Link>

                  <select
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                    value={["FATHER", "MOTHER", "GUARDIAN"].includes(child.relationship.toUpperCase()) ? child.relationship.toUpperCase() : "GUARDIAN"}
                    onChange={async (event) => {
                      setError("");
                      try {
                        await api(`/api/v1/students/${child.id}/guardians/${profile.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ relationship: event.target.value }),
                        });
                        await load();
                        setMessage("Child relationship updated.");
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Could not update relationship.");
                      }
                    }}
                  >
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="GUARDIAN">Guardian</option>
                  </select>

                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition shadow-sm"
                    title="Unlink student from parent"
                    onClick={() => setUnlinkTarget({ id: child.id, name: child.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showLinkBox && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">No children linked to this parent yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Click the button below to search and link a registered student.</p>
              <button
                type="button"
                onClick={() => setShowLinkBox(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Link a Student
              </button>
            </div>
          )
        )}
      </div>

      {/* Edit Parent Modal */}
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setEditing(false)}>
          <form
            className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Parent Details</h3>
                <p className="mt-1 text-xs text-slate-500">Update contact records and personal identification.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                First name *
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Last name *
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Phone Number (optional)
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Portal Login Email
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required={profile.portalStatus !== "NONE"}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700 md:col-span-2">
                NIRA National ID (optional)
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.nationalId}
                  onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 transition"
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {/* Toggle Parent Status ConfirmModal */}
      <ConfirmModal
        isOpen={toggleOpen}
        onClose={() => setToggleOpen(false)}
        onConfirm={handleConfirmToggle}
        title={profile.portalStatus === "ACTIVE" ? "Deactivate Parent Portal" : "Activate Parent Portal"}
        targetName={profile.name}
        targetType="Parent Portal Account"
        description={
          profile.portalStatus === "ACTIVE"
            ? `Ma hubtaa inaad joojiso (deactivate) koontada waalidka ${profile.name}? Waalidku ma awoodi doono inuu galo barta waalidiinta ilaa dib loo hawlgaliyo.`
            : `Ma hubtaa inaad hawlgeliso (activate) koontada waalidka ${profile.name}?`
        }
        confirmText={profile.portalStatus === "ACTIVE" ? "Jooji Koontada" : "Hawlgeli"}
        cancelText="Ka Noqo"
        isDestructive={profile.portalStatus === "ACTIVE"}
      />

      {/* Delete Parent ConfirmModal */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Digniin Culus: Tirtiridda Waalidka"
        targetName={profile.name}
        targetType="Parent / Waalid"
        description={`Ma hubtaa inaad tirtirto waalidka (${profile.name})? Dhammaan xidhiidhyada ardayda ku xidhan iyo galitaanka nidaamka waa la joojin doonaa.`}
        confirmText="Haa, Tirtir Waalidka"
        cancelText="Ka Noqo"
        isDestructive={true}
        requireKeyword="DELETE"
        showMultiSchoolScope={isSuperAdmin}
        scope={deleteScope}
        onScopeChange={setDeleteScope}
      />

      {/* Unlink Child ConfirmModal */}
      <ConfirmModal
        isOpen={Boolean(unlinkTarget)}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={handleConfirmUnlink}
        title="Ka Furidda Ardayga Waalidka (Unlink)"
        targetName={unlinkTarget?.name}
        targetType="Linked Student"
        description={`Ma hubtaa inaad ardayga (${unlinkTarget?.name}) ka furto waalidka ${profile.name}? Ardaygu nidaamka lagama tirtirayo, kaliya xidhiidhka waalidka ayaa la kala qaadayaa.`}
        confirmText="Haa, Kala Fur"
        cancelText="Ka Noqo"
        isDestructive={true}
      />
    </div>
  );
}

type Child = {
  id: string;
  permanentId: string;
  name: string;
  photoUrl?: string | null;
  dateOfBirth?: string;
  relationship: string;
  status: string;
  isTransferred?: boolean;
  isReenrolled?: boolean;
  destinationSchool?: string | null;
  certificateNumber?: string | null;
  transferredAt?: string | null;
  school: string;
  year: string;
  level: string;
  section: string;
  rollNumber?: number | null;
  attendanceRate?: number | null;
  totalAttendanceSessions?: number;
  publishedExamsCount?: number;
  graduationYear?: string | null;
};

type AverageStatus = "final" | "provisional" | "unavailable";

type ExamSubjectLine = {
  subjectId: string;
  name: string;
  maxMarks: number;
  marks: number | null;
  percentage: number | null;
  published: boolean;
  absent: boolean;
  pending: boolean;
};

type TermAverage = {
  term: string;
  label: string;
  examDate: string | null;
  subjectCount: number;
  publishedCount: number;
  pendingCount: number;
  absentCount: number;
  obtained: number;
  possible: number;
  average: number | null;
  status: AverageStatus;
  subjects: ExamSubjectLine[];
};

type YearAverage = {
  obtained: number;
  possible: number;
  average: number | null;
  status: AverageStatus;
  subjectCount: number;
  publishedCount: number;
  pendingCount: number;
};

type ChildProfile = {
  permanentId: string;
  name: string;
  photoUrl: string | null;
  dateOfBirth: string;
  gender: string;
  nationalId: string | null;
  status: string;
  isTransferred?: boolean;
  isReenrolled?: boolean;
  reenrollmentMessage?: string | null;
  transferDetails?: {
    destinationSchool: string | null;
    certificateNumber: string;
    transferredAt: string | null;
    reason: string | null;
  } | null;
  enrollments: Array<{
    id: string;
    school: string;
    year: string;
    level: string;
    section: string;
    rollNumber: number;
    status: string;
    examination: { term1: TermAverage; term2: TermAverage; overall: YearAverage } | null;
    attendance: Array<{ date: string; session: string; status: string }>;
  }>;
};

function parentRole(value: string) {
  const key = value.trim().toUpperCase();
  if (key === "MOTHER" || key === "HOOYO") return { label: "Mother", className: "bg-rose-50 text-rose-700" };
  if (key === "FATHER" || key === "AABBE") return { label: "Father", className: "bg-blue-50 text-blue-700" };
  if (!key) return null;
  return { label: "Other guardian", className: "bg-violet-50 text-violet-700" };
}

function formatBirth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100) / 100}%`;
}

function averageBadge(status: AverageStatus) {
  if (status === "final") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Published</span>;
  if (status === "provisional") return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Provisional</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Not available</span>;
}

function TermResultCard({ term, tone }: { term: TermAverage; tone: "blue" | "violet" }) {
  const icon = tone === "blue" ? "bg-blue-600" : "bg-violet-600";
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-white ${icon}`}><BarChart3 className="h-4 w-4" /></span>
          <div>
            <p className="font-semibold text-slate-900">{term.label}</p>
            <p className="text-xs text-slate-500">Exam date: {term.examDate ? term.examDate.slice(0, 10) : "—"}</p>
          </div>
        </div>
        {averageBadge(term.status)}
      </div>
      {term.subjectCount ? (
        <>
          <p className="px-4 pt-3 text-xs text-slate-500">Published {term.publishedCount}/{term.subjectCount} · Pending {term.pendingCount}</p>
          <table className="mt-1 w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-2">#</th><th className="px-2 py-2">Subject</th><th className="px-2 py-2">Marks</th><th className="px-2 py-2">Max</th><th className="px-2 py-2">Average</th></tr>
            </thead>
            <tbody>
              {term.subjects.map((subject, index) => (
                <tr key={subject.subjectId} className={`border-t border-slate-100 ${subject.pending ? "bg-white" : "bg-emerald-50/60"}`}>
                  <td className="px-4 py-2 text-slate-400">{index + 1}</td>
                  <td className="px-2 py-2 font-medium text-slate-800">{subject.name}</td>
                  <td className="px-2 py-2 text-slate-700">{subject.absent ? "Absent" : subject.pending ? "—" : subject.marks}</td>
                  <td className="px-2 py-2 text-slate-500">{subject.maxMarks}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900">{subject.absent ? "Absent" : subject.pending ? "Pending" : formatPercent(subject.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50 px-4 py-2 text-sm">
            <span className="text-slate-600">Total marks <strong className="text-slate-950">{term.obtained} / {term.possible}</strong></span>
            <span className="text-slate-600">{term.status === "final" ? "Final average" : term.status === "provisional" ? "Provisional average" : "Average"} <strong className="text-emerald-700">{formatPercent(term.average)}</strong></span>
          </div>
        </>
      ) : <p className="px-4 py-8 text-sm text-slate-500">No subjects are assigned to this class for {term.label}.</p>}
    </div>
  );
}

function OverallResultCard({ year, term1, term2, overall }: { year: string; term1: TermAverage; term2: TermAverage; overall: YearAverage }) {
  const line = (label: string, term: TermAverage) => (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-slate-600">
      <span>{label}</span>
      <strong className="text-slate-950">{term.possible ? `${term.obtained} / ${term.possible}` : "—"}</strong>
    </div>
  );
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><BarChart3 className="h-4 w-4" /></span>
          <div>
            <p className="font-semibold text-slate-900">Overall academic year average</p>
            <p className="text-xs text-slate-500">Term 1 + Term 2 ({year})</p>
          </div>
        </div>
        {averageBadge(overall.status)}
      </div>
      <div className="flex flex-1 flex-col px-4 py-3 text-sm">
        {line("Term 1", term1)}
        {line("Term 2", term2)}
        <p className="mt-3 text-xs text-slate-500">Published {overall.publishedCount}/{overall.subjectCount} · Pending {overall.pendingCount}</p>
        <div className="mt-auto rounded-xl bg-blue-50 px-4 py-3">
          <div className="flex items-center justify-between text-slate-600"><span>Overall total</span><strong className="text-slate-950">{overall.possible ? `${overall.obtained} / ${overall.possible}` : "—"}</strong></div>
          <div className="mt-2 flex items-center justify-between text-slate-600"><span>{overall.status === "final" ? "Final average" : overall.status === "provisional" ? "Provisional average" : "Average"}</span><strong className="text-lg text-blue-700">{formatPercent(overall.average)}</strong></div>
        </div>
      </div>
    </div>
  );
}

export function ParentFeesPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [fees, setFees] = useState<Array<{
    id: string;
    title: string;
    type: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
    year: string;
    school: string;
    payments: Array<{ receiptNumber: string; amount: number }>;
  }>>([]);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Child[]>("/api/v1/parent/children")
      .then((rows) => {
        setChildren(rows);
        setStudentId(rows[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load children."));
  }, []);

  useEffect(() => {
    if (!studentId) return;
    api<typeof fees>(`/api/v1/parent/children/${studentId}/fees`)
      .then(setFees)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load fees."));
  }, [studentId]);

  const selected = children.find((child) => child.id === studentId);
  const totals = fees.reduce((sum, fee) => ({
    amount: sum.amount + fee.amount,
    paid: sum.paid + fee.paidAmount,
    balance: sum.balance + fee.balance,
  }), { amount: 0, paid: 0, balance: 0 });
  const feeTone = (status: string) => status === "PAID" ? "bg-emerald-50 text-emerald-700" : status === "PARTIALLY_PAID" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      <label className="block max-w-sm text-sm font-medium text-slate-700">Child
        <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>
      {selected ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Amount</p><p className="mt-1 text-2xl font-semibold text-slate-950">{totals.amount}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Paid</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{totals.paid}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Balance</p><p className="mt-1 text-2xl font-semibold text-slate-950">{totals.balance}</p></article>
        </div>
      ) : null}
      {fees.map((fee) => (
        <article key={fee.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950"><School className="h-4 w-4 text-blue-600" />{fee.school}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{fee.year}</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${feeTone(fee.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{fee.status.replaceAll("_", " ")}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{fee.type}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">{fee.title}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span><span className="block text-[11px] text-slate-400">Amount</span><strong>{fee.amount}</strong></span>
              <span><span className="block text-[11px] text-slate-400">Paid</span><strong className="text-emerald-600">{fee.paidAmount}</strong></span>
              <span><span className="block text-[11px] text-slate-400">Balance</span><strong>{fee.balance}</strong></span>
            </div>
          </div>
          {fee.payments.length ? (
            <div className="mt-3 space-y-2">
              {fee.payments.map((payment) => (
                <div key={payment.receiptNumber} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-600"><Receipt className="h-4 w-4 text-blue-600" />{payment.receiptNumber}</span>
                  <strong className="text-slate-900">{payment.amount}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      {studentId && !fees.length && !error ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">No fees for this child.</p> : null}
    </div>
  );
}

export function ParentDashboard() {
  const [params] = useSearchParams();
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const [children, setChildren] = useState<Child[]>([]);
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "ALUMNI" | "TRANSFERRED">("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Child[]>("/api/v1/parent/children")
      .then(setChildren)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load children."));
  }, []);

  const activeCount = children.filter((c) => (c.status === "ACTIVE" || c.isReenrolled) && !c.isTransferred).length;
  const alumniCount = children.filter((c) => c.status === "ALUMNI" && !c.isTransferred).length;
  const transferredCount = children.filter((c) => !c.isReenrolled && (c.isTransferred || c.status === "TRANSFERRED")).length;

  const visible = children.filter((child) => {
    const isChildTransferred = Boolean(!child.isReenrolled && (child.isTransferred || child.status === "TRANSFERRED"));
    if (statusTab === "ACTIVE" && ((child.status !== "ACTIVE" && !child.isReenrolled) || isChildTransferred)) return false;
    if (statusTab === "ALUMNI" && (child.status !== "ALUMNI" || isChildTransferred)) return false;
    if (statusTab === "TRANSFERRED" && !isChildTransferred) return false;
    if (query && !`${child.name} ${child.permanentId} ${child.school} ${child.level} ${child.section} ${child.destinationSchool ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-10">
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800">{error}</p> : null}

      {/* Clean Single-line Toolbar (No redundant duplicate headers) */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              {children.length} {children.length === 1 ? "Child Enrolled" : "Children Enrolled"}
            </h2>
            <p className="text-[11px] text-slate-500">
              Select a child to view their academic records and attendance
            </p>
          </div>
        </div>

        {/* Filter Pills Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setStatusTab("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                statusTab === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({children.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("ACTIVE")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                statusTab === "ACTIVE"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("ALUMNI")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                statusTab === "ALUMNI"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Alumni ({alumniCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("TRANSFERRED")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                statusTab === "TRANSFERRED"
                  ? "bg-white text-amber-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Transferred ({transferredCount})
            </button>
          </div>
        </div>
      </section>

      {/* Children Cards Grid - Compact, perfectly proportioned, with prominent visible shadow */}
      {!visible.length && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-xs text-slate-500 shadow-sm">
          No children match the selected filter.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
        {visible.map((child) => {
          const initials = child.name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0] ?? "")
            .join("")
            .toUpperCase();
          const role = parentRole(child.relationship);
          const isTransferred = Boolean(!child.isReenrolled && (child.isTransferred || child.status === "TRANSFERRED"));
          const isActive = (child.status === "ACTIVE" || Boolean(child.isReenrolled)) && !isTransferred;
          const isAlumni = child.status === "ALUMNI" && !isTransferred;

          return (
            <article
              key={child.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.13),0_4px_8px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-blue-300/80 transition-all duration-300"
            >
              {/* Top Header Pill inside card */}
              <div className="flex items-center justify-end w-full mb-0.5">
                {isTransferred ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    <ArrowRightLeft className="h-3 w-3 text-amber-600" />
                    Transferred
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <Check className="h-3 w-3 stroke-[3]" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                    <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />
                    Graduated
                  </span>
                )}
              </div>

              {/* Centered Avatar with distinctive Green Tick / Amber Transfer / Blue Tick */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mx-auto my-0.5">
                  {child.photoUrl ? (
                    <img
                      src={child.photoUrl}
                      alt={child.name}
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-3 ring-slate-100 shadow-sm"
                    />
                  ) : (
                    <div
                      className={`grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full font-black text-sm sm:text-base tracking-wider ring-3 shadow-inner ${
                        isTransferred
                          ? "bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 text-amber-800 ring-amber-100/90"
                          : isActive
                          ? "bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 text-purple-700 ring-purple-100/90"
                          : "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 text-blue-700 ring-blue-100/90"
                      }`}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Distinctive Status Badge at Avatar Bottom-Right */}
                  {isTransferred ? (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white ring-2 ring-white shadow-xs"
                      title="Transferred Out (La Wareejiyey)"
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                    </span>
                  ) : isActive ? (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white shadow-xs"
                      title="Active Enrolled (Green Tick)"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white ring-2 ring-white shadow-xs"
                      title="Graduated / Alumni (Blue Tick)"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Student Full Name */}
                <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-900 truncate max-w-full capitalize tracking-tight" title={child.name}>
                  {child.name}
                </h3>

                {/* Student ID */}
                <p className="font-mono text-[11px] font-medium text-slate-400 mt-0.5">
                  {child.permanentId}
                </p>

                {child.isReenrolled && !isTransferred ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <Check className="h-2.5 w-2.5 stroke-[3]" /> Re-enrolled
                  </span>
                ) : null}

                {/* Parent Relationship - Bold and clearly placed below ID */}
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200/80 shadow-2xs">
                    {role?.label ?? child.relationship ?? "Guardian"}
                  </span>
                </div>
              </div>

              {/* Middle Placement Box (School, Class & Year) */}
              <div className="my-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2 sm:p-2.5 text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-slate-700">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isTransferred ? "bg-amber-500" : isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <School className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{child.school || "School"}</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                  {isTransferred && child.destinationSchool
                    ? `To: ${child.destinationSchool}`
                    : `${child.level ? `${child.level} · Sec ${child.section}` : "Enrolled"} ${child.year ? `(${child.year})` : ""}`}
                </p>
              </div>

              {/* Real Data Metric Tags Row (Compact & Clean) */}
              <div className="flex flex-wrap items-center justify-center gap-1 text-[11px]">
                {isTransferred ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      <ArrowRightLeft className="h-3 w-3 text-amber-600" /> Transferred Out
                    </span>
                    {child.certificateNumber ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700" title="Transfer Certificate">
                        Cert #{child.certificateNumber}
                      </span>
                    ) : null}
                  </>
                ) : isActive ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {child.attendanceRate !== null && child.attendanceRate !== undefined
                        ? `${child.attendanceRate}% Attend`
                        : "Attendance Active"}
                    </span>
                    {child.publishedExamsCount && child.publishedExamsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        <GraduationCap className="h-3 w-3 text-blue-600" /> {child.publishedExamsCount} Results
                      </span>
                    ) : child.rollNumber != null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700">
                        Roll #{child.rollNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700">
                        Enrolled
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                      <Sparkles className="h-3 w-3 text-purple-600" /> Class {child.graduationYear || (child.year ? child.year.slice(0, 4) : "2024")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      <BadgeCheck className="h-3 w-3 text-blue-600" /> Certified
                    </span>
                  </>
                )}
              </div>

              {/* Bottom Action Buttons (Compact height) */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                <Link
                  to={`/parent/children/${child.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  View Student Portal <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to={`/parent/attendance?child=${child.id}`}
                  title="View Child Attendance"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-2xs transition-colors"
                >
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ParentChildPage() {
  const { studentId } = useParams();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState("");
  const [resultYear, setResultYear] = useState("all");
  const [fees, setFees] = useState<Array<{ id: string; title: string; balance: number; status: string; school: string; year: string }>>([]);
  const [conductReports, setConductReports] = useState<Array<{
    id: string;
    reportNumber: string;
    category: string;
    severity: string;
    isPositive: boolean;
    title: string;
    incidentDate: string;
    description: string;
    status: string;
    resolutionNotes: string | null;
    timeline: Array<{ id: string; actionType: string; comment: string | null; createdAt: string }>;
    attachments: Array<{ id: string; title: string; originalName: string; sizeBytes: number }>;
  }>>([]);

  useEffect(() => {
    Promise.all([
      api<ChildProfile>(`/api/v1/parent/children/${studentId}`),
      api<Child[]>("/api/v1/parent/children"),
      api<Array<{ id: string; title: string; balance: number; status: string; school: string; year: string }>>(`/api/v1/parent/children/${studentId}/fees`),
      api<{ studentName: string; reports: any[] }>(`/api/v1/parent/children/${studentId}/conduct`).catch(() => ({ studentName: "", reports: [] })),
    ])
      .then(([childProfile, children, feeRows, conductData]) => {
        setProfile(childProfile);
        setRelationship(children.find((child) => child.id === studentId)?.relationship ?? "");
        setFees(feeRows);
        setConductReports(conductData.reports || []);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load this child."));
  }, [studentId]);

  if (error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="text-sm text-slate-500">Loading child...</p>;

  const nameParts = profile.name.split(" ").filter(Boolean);
  const initials = `${nameParts[0]?.[0] ?? ""}${nameParts.at(-1)?.[0] ?? ""}`.toUpperCase();
  const role = parentRole(relationship);
  const genderLabel = profile.gender === "FEMALE" ? "Female" : profile.gender === "MALE" ? "Male" : profile.gender;
  const current = profile.enrollments.find((item) => item.status === "ACTIVE") ?? profile.enrollments[0];
  const history = current ? [current, ...profile.enrollments.filter((item) => item !== current)] : [];
  const resultRows = resultYear === "all" ? history : history.filter((item) => item.id === resultYear);
  const hasActiveEnrollment = profile.enrollments.some((item) => item.status === "ACTIVE");
  const isTransferred = !hasActiveEnrollment && Boolean(!profile.isReenrolled && (profile.isTransferred || profile.status === "TRANSFERRED"));
  const statusTone = (status: string) => {
    if (status === "TRANSFERRED") return "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20";
    if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20";
    if (status === "ALUMNI" || status === "PROMOTED") return "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-5">
      {/* Transferred Alert Banner */}
      {isTransferred ? (
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">Ardaygan waa la wareejiyey / Student Transferred</h3>
                {profile.transferDetails?.certificateNumber ? (
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">
                    TC #{profile.transferDetails.certificateNumber}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-amber-800">
                Ardaygan waxaa laga wareejiyey dugsiga{" "}
                {profile.transferDetails?.destinationSchool ? (
                  <>
                    waxaana loo wareejiyey <strong>{profile.transferDetails.destinationSchool}</strong>.
                  </>
                ) : (
                  "dugsi kale."
                )}{" "}
                Dhammaan xogtii hore ee natiijooyinka imtixaanaadka iyo xaadiriska ardayga waxay u kaydsan yihiin si buuxda.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Re-enrollment Notice Banner */}
      {!isTransferred && (profile.isReenrolled || (hasActiveEnrollment && profile.transferDetails)) ? (
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-900 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              <Check className="h-5 w-5 stroke-[2.5]" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-950">Dib u Diiwaangelinta waa la ansixiyey / Re-enrollment Approved</h3>
                <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
                  Active
                </span>
                {profile.transferDetails?.certificateNumber ? (
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                    Previous TC #{profile.transferDetails.certificateNumber}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-emerald-800">
                {profile.reenrollmentMessage ||
                  "Your child's re-enrollment has been approved. You can now access current academic information, attendance, and all historical records below."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-600 text-base font-semibold text-white">{initials}</span>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">{profile.name}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(profile.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{profile.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-bold text-blue-700"><CalendarDays className="h-4 w-4" />{formatBirth(profile.dateOfBirth)}</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-violet-700"><UserRound className="h-4 w-4" />{genderLabel}</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800"><IdCard className="h-4 w-4 text-slate-500" />NIRA {profile.nationalId || "—"}</span>
              {role ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${role.className}`}>{role.label}</span> : null}
            </div>
            {current ? (
              <p className="mt-2 text-sm font-medium text-slate-600">
                {isTransferred && profile.transferDetails?.destinationSchool
                  ? `Transferred from ${current.school} to ${profile.transferDetails.destinationSchool}`
                  : `${current.school} · ${current.level} — Section ${current.section} · Roll #${current.rollNumber}`}
              </p>
            ) : null}
          </div>
        </div>
        {current ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <School className="h-4 w-4 text-blue-600" />
              <p className="mt-1 text-[11px] text-slate-400">{isTransferred ? "Source school" : "Current school"}</p>
              <p className="text-sm font-medium text-slate-800">{current.school}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <BookOpen className="h-4 w-4 text-violet-600" />
              <p className="mt-1 text-[11px] text-slate-400">{isTransferred ? "Last class" : "Current class"}</p>
              <p className="text-sm font-medium text-slate-800">{current.level} · Section {current.section}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              <p className="mt-1 text-[11px] text-slate-400">{isTransferred ? "Transfer Status" : "Academic year"}</p>
              <p className="text-sm font-medium text-slate-800">{isTransferred ? "Transferred Out" : current.year}</p>
            </div>
          </div>
        ) : null}
      </article>

      <section>
        <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-blue-600" /><div><h3 className="text-sm font-semibold text-slate-900">Enrollment history</h3><p className="text-xs text-slate-500">A summary of your child's enrollment records across different schools and academic years.</p></div></div>
        <div className="mt-4 space-y-3">
          {history.map((enrollment, index) => {
            const label = index === 0 ? "Current" : index === 1 ? "Previous" : "Earlier";
            return (
              <div key={enrollment.id} className="grid grid-cols-[4.5rem_1fr] gap-3">
                <div className="flex flex-col items-center pt-5">
                  <span className={`text-[11px] font-medium ${index === 0 ? "text-blue-600" : "text-slate-400"}`}>{label}</span>
                  <span className={`mt-1 h-3 w-3 rounded-full ${index === 0 ? "bg-blue-600" : "border-2 border-slate-300 bg-white"}`} />
                  {index < history.length - 1 ? <span className="mt-1 w-px flex-1 bg-slate-200" /> : null}
                </div>
                <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}><School className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-950">{enrollment.school}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(enrollment.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{enrollment.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{enrollment.year} · {enrollment.level} · Section {enrollment.section} · Roll {enrollment.rollNumber}</p>
                    </div>
                  </div>
                  <div className="min-w-40">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> Attendance</p>
                    <p className="mt-1 text-sm text-slate-500">{enrollment.attendance.length ? `${enrollment.attendance.length} recent marks` : "No attendance yet."}</p>
                    <Link to={`/parent/attendance?child=${studentId}`} className="mt-2 inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">Attendance report</Link>
                  </div>
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 md:block" />
                </article>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Examination results</h3>
              <p className="text-xs text-slate-500">View your child's examination results by academic year and term.</p>
            </div>
          </div>
          <label className="text-sm text-slate-600">
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2" value={resultYear} onChange={(event) => setResultYear(event.target.value)}>
              <option value="all">All Years</option>
              {history.map((enrollment) => <option key={enrollment.id} value={enrollment.id}>{enrollment.year}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-4">
          {resultRows.map((enrollment) => (
              <article key={enrollment.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
                  <School className="h-4 w-4 text-blue-600" />
                  Academic Year {enrollment.year} · {enrollment.level} · Section {enrollment.section} ({enrollment.school})
                </header>
                {enrollment.examination ? (
                  <div className="grid gap-4 p-4 xl:grid-cols-3">
                    <TermResultCard term={enrollment.examination.term1} tone="blue" />
                    <TermResultCard term={enrollment.examination.term2} tone="violet" />
                    <OverallResultCard year={enrollment.year} term1={enrollment.examination.term1} term2={enrollment.examination.term2} overall={enrollment.examination.overall} />
                  </div>
                ) : <p className="px-4 py-6 text-sm text-slate-500">No examination subjects are assigned for this year.</p>}
              </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Conduct & Student Welfare</h3>
              <p className="text-xs text-slate-500">Official conduct recognitions, merits, and school welfare communications.</p>
            </div>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            {conductReports.length} {conductReports.length === 1 ? "Notice" : "Notices"}
          </span>
        </div>

        {conductReports.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No conduct or welfare notices currently published for this child.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {conductReports.map((report) => (
              <div
                key={report.id}
                className={`rounded-xl border p-4 transition ${
                  report.isPositive
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                        report.isPositive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {report.isPositive ? <Award className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      {report.category.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">{report.title}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(report.incidentDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                <p className="mt-2.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{report.description}</p>

                {report.resolutionNotes && (
                  <div className="mt-2.5 rounded-lg bg-white p-2.5 border border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">School Action / Outcome: </span>
                    {report.resolutionNotes}
                  </div>
                )}

                {report.attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-slate-200/50">
                    {report.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={`/api/v1/conduct/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-indigo-600 hover:bg-slate-50"
                      >
                        <Paperclip className="h-3 w-3" />
                        {att.title || att.originalName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Fees</h3>
          {fees.length ? fees.map((fee) => (
            <p key={fee.id} className="mt-2 text-sm text-slate-700">{fee.title} · {fee.school} · {fee.year} · {fee.status} · balance {fee.balance.toLocaleString()}</p>
          )) : <p className="mt-2 text-sm text-slate-500">No fee records yet.</p>}
        </article>
      </section>
    </div>
  );
}

export { ParentAttendancePage } from "./ParentAttendancePage";

