import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, BarChart3, BookOpen, CalendarDays, ChevronRight, Eye, Filter, IdCard, Mail, Megaphone, Pencil, Phone, Plus, Receipt, School, Search, Send, UserRound, Users, Wallet, Check, CheckCircle2, Sparkles, FileText, CalendarCheck2, GraduationCap } from "lucide-react";
import { api } from "../lib/api";
import { PasswordLinkDialog, passwordLinkUrl } from "../components/PasswordLinkDialog";
import { Avatar, DataTable } from "../components/PeopleList";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState<{ url: string; email?: string } | null>(null);
  const [q, setQ] = useState("");
  const [portal, setPortal] = useState("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationalId: "", dateOfBirth: "" });

  async function load() {
    setRows(await api<ParentRow[]>("/api/v1/parents"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load parents."));
  }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const hay = `${row.name} ${row.publicId} ${row.phone} ${row.email ?? ""} ${row.children.map((child) => child.name).join(" ")}`.toLowerCase();
    if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
    if (portal === "NONE" && row.portalStatus !== "NONE") return false;
    if (portal === "ACTIVE" && row.portalStatus !== "ACTIVE") return false;
    if (portal === "INVITED" && row.portalStatus !== "INVITED") return false;
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
      setMessage("Parent created.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create parent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Parents</h2>
          <p className="mt-1 text-sm text-slate-500">Manage parent accounts, contact information and their children.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4" />
          Add Parent
        </button>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[2fr_1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700"
            placeholder="Search name, ID, phone, email..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <label className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700"
            value={portal}
            onChange={(event) => setPortal(event.target.value)}
          >
            <option value="ALL">All portal status</option>
            <option value="NONE">No account</option>
            <option value="INVITED">Invited</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
        <div className="flex min-w-36 items-center gap-3 rounded-lg border-l border-slate-100 px-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{filtered.length} parents</div>
            <div className="text-xs text-slate-400">Total registered</div>
          </div>
        </div>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {message ? <p className="text-blue-600">{message}</p> : null}
      {passwordLink ? <PasswordLinkDialog url={passwordLink.url} email={passwordLink.email} onClose={() => setPasswordLink(null)} /> : null}
      <DataTable
        headers={["Profile", "Parent ID", "Parent / Guardian", "Contact Information", "Children", "Portal Status", "Actions"]}
        empty={filtered.length === 0 ? "No parents match these filters." : undefined}
      >
        {filtered.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3">
                <Avatar name={row.name} seed={row.publicId} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.publicId}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {row.phone || "—"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                  {row.email ?? "—"}
                </div>
              </td>
              <td className="px-4 py-3 font-semibold text-blue-600">{row.childrenCount}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${row.portalStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : row.portalStatus === "INVITED" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${row.portalStatus === "ACTIVE" ? "bg-emerald-500" : row.portalStatus === "INVITED" ? "bg-amber-500" : "bg-slate-400"}`} />
                  {row.portalStatus === "NONE" ? "No account" : row.portalStatus}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {row.portalStatus === "NONE" ? (
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100" onClick={() => invite(row)}>
                      <Send className="h-4 w-4" />
                      Invite
                    </button>
                  ) : null}
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100"
                    to={`/school/parents/${row.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                </div>
              </td>
            </tr>
        ))}
      </DataTable>

      {showAdd ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setShowAdd(false)}>
          <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onSubmit={createParent} onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900">Add Parent</h3>
            <p className="mt-1 text-sm text-slate-500">Create a parent record. A portal account can be invited afterward.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">First name *
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
              </label>
              <label className="text-sm font-medium text-slate-700">Last name *
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
              </label>
              <label className="text-sm font-medium text-slate-700">Phone (optional)
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">Email
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">Date of birth (optional)
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">NIRA number (optional)
                <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Saving..." : "Add Parent"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordLink, setPasswordLink] = useState<{ url: string; email?: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationalId: "" });
  const [childQuery, setChildQuery] = useState("");
  const [childHits, setChildHits] = useState<Array<{ id: string; permanentId: string; name: string; school: string; level: string; section: string; status: string; photoUrl?: string | null }>>([]);
  const [childRelationship, setChildRelationship] = useState("GUARDIAN");

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
      setMessage("Parent details updated.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update parent.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !profile) return <p className="text-red-600">{error}</p>;
  if (!profile) return <p className="text-slate-500">Loading parent profile...</p>;

  const cards = [
    { label: "Children", value: profile.childrenCount, icon: <Users className="h-5 w-5" />, tone: "bg-blue-50 text-blue-600" },
    { label: "Total fees", value: profile.finances.invoiced.toLocaleString(), icon: <Wallet className="h-5 w-5" />, tone: "bg-blue-50 text-blue-600" },
    { label: "Paid", value: profile.finances.paid.toLocaleString(), icon: <BadgeCheck className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Balance", value: profile.finances.balance.toLocaleString(), icon: <Wallet className="h-5 w-5" />, tone: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/school/parents" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Parents
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Parent Profile</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700" onClick={() => {
            setError("");
            const hasPortal = profile.portalStatus !== "NONE";
            const path = hasPortal
              ? api<{ setPasswordPath: string }>(`/api/v1/parents/${profile.id}/access`, { method: "POST" })
              : api<{ setPasswordPath: string }>(`/api/v1/guardians/${profile.id}/invite`, { method: "POST", body: JSON.stringify({ email: profile.email || window.prompt("Parent email for portal invite:") || "" }) });
            path.then((result) => { setPasswordLink({ url: passwordLinkUrl(result.setPasswordPath), email: profile.email || undefined }); return load(); })
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
          }}>
            {profile.portalStatus === "NONE" ? "Invite login" : "Reset password"}
          </button>
        </div>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar name={profile.name} seed={profile.publicId} />}
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-slate-900">{profile.name}</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              <span className="inline-flex items-center gap-2"><IdCard className="h-4 w-4 text-blue-600" />{profile.publicId}</span>
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-blue-600" />{profile.phone || "—"}</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" />{profile.email ?? "No email"}</span>
              <span className="inline-flex items-center gap-2"><IdCard className="h-4 w-4 text-blue-600" />NIRA {profile.nationalId ?? "—"}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-600" />Born {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : "—"}</span>
              <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-blue-600" />Portal {profile.portalStatus}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-600" />Added {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`grid h-11 w-11 place-items-center rounded-xl ${card.tone}`}>{card.icon}</div>
            <div><p className="text-xs text-slate-500">{card.label}</p><p className="text-xl font-bold text-slate-900">{card.value}</p></div>
          </article>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Children ({profile.childrenCount})</h3>
        <article className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Search className="h-5 w-5" /></span>
            <div>
              <h4 className="font-semibold text-slate-900">Link an existing student</h4>
              <p className="mt-1 text-sm text-slate-500">Search by name, student ID, phone, or student number. The result shows the student's details and photo when one is saved.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input className="min-w-56 flex-1 rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Name, student ID, or phone number..." value={childQuery} onChange={(event) => setChildQuery(event.target.value)} />
            <select className="rounded-xl border border-slate-200 px-3 py-2.5" value={childRelationship} onChange={(event) => setChildRelationship(event.target.value)}>
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
            </select>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={async () => {
              setChildHits(await api<typeof childHits>(`/api/v1/student-search?q=${encodeURIComponent(childQuery)}`));
            }}><Search className="h-4 w-4" /> Search</button>
          </div>
          <div className="mt-3 space-y-2">
            {childHits.map((hit) => (
              <div key={hit.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                {hit.photoUrl
                  ? <img src={hit.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{hit.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{hit.name}</p>
                  <p className="text-sm text-slate-500">{hit.permanentId} · {hit.school} · {hit.level}{hit.section ? ` · Section ${hit.section}` : ""} · {hit.status}</p>
                </div>
                <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={async () => {
                  await api(`/api/v1/parents/${profile.id}/children`, { method: "POST", body: JSON.stringify({ studentId: hit.id, relationship: childRelationship }) });
                  setMessage("Child linked.");
                  setChildHits([]);
                  await load();
                }}>Link</button>
              </div>
            ))}
          </div>
        </article>
        <div className="grid gap-4 md:grid-cols-2">
          {profile.children.map((child) => (
            <Link key={child.id} to={`/school/students/${child.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {child.photoUrl
                    ? <img src={child.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                    : <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600"><UserRound className="h-5 w-5" /></div>}
                  <div>
                    <h4 className="font-semibold text-slate-900">{child.name}</h4>
                    <p className="text-xs text-slate-500">{child.permanentId} · {child.relationship}</p>
                  </div>
                </div>
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <span>{child.school}</span><span>{child.year}</span>
                <span>{child.level} {child.section}</span>
                <span>Roll {child.rollNumber}</span><span>Balance {child.balance.toLocaleString()}</span>
              </div>
              <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-600">Open student profile →</div>
            </Link>
          ))}
          {!profile.children.length ? <p className="text-slate-500">No children linked to this parent yet.</p> : null}
        </div>
      </div>

      {message ? <p className="text-blue-600">{message}</p> : null}
      {passwordLink ? <PasswordLinkDialog url={passwordLink.url} email={passwordLink.email} onClose={() => setPasswordLink(null)} /> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setEditing(false)}>
          <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onSubmit={save} onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900">Edit Parent</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">First name<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label>
              <label className="text-sm font-medium text-slate-700">Last name<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label>
              <label className="text-sm font-medium text-slate-700">Phone (optional)<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Login email<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required={profile.portalStatus !== "NONE"} /></label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">National ID<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      ) : null}
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
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "ALUMNI">("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Child[]>("/api/v1/parent/children")
      .then(setChildren)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load children."));
  }, []);

  const activeCount = children.filter((c) => c.status === "ACTIVE").length;
  const alumniCount = children.filter((c) => c.status === "ALUMNI").length;

  const visible = children.filter((child) => {
    if (statusTab === "ACTIVE" && child.status !== "ACTIVE") return false;
    if (statusTab === "ALUMNI" && child.status !== "ALUMNI") return false;
    if (query && !`${child.name} ${child.permanentId} ${child.school} ${child.level} ${child.section}`.toLowerCase().includes(query)) return false;
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
          const isActive = child.status === "ACTIVE";

          return (
            <article
              key={child.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.13),0_4px_8px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-blue-300/80 transition-all duration-300"
            >
              {/* Top Header Pill inside card */}
              <div className="flex items-center justify-end w-full mb-0.5">
                {isActive ? (
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

              {/* Centered Avatar with distinctive Green Tick / Blue Tick */}
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
                        isActive
                          ? "bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 text-purple-700 ring-purple-100/90"
                          : "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 text-blue-700 ring-blue-100/90"
                      }`}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Distinctive Tick Badge at Avatar Bottom-Right */}
                  {isActive ? (
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
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <School className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{child.school || "School"}</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                  {child.level ? `${child.level} · Sec ${child.section}` : "Enrolled"} {child.year ? `(${child.year})` : ""}
                </p>
              </div>

              {/* Real Data Metric Tags Row (Compact & Clean) */}
              <div className="flex flex-wrap items-center justify-center gap-1 text-[11px]">
                {isActive ? (
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

  useEffect(() => {
    Promise.all([
      api<ChildProfile>(`/api/v1/parent/children/${studentId}`),
      api<Child[]>("/api/v1/parent/children"),
      api<Array<{ id: string; title: string; balance: number; status: string; school: string; year: string }>>(`/api/v1/parent/children/${studentId}/fees`),
    ])
      .then(([childProfile, children, feeRows]) => {
        setProfile(childProfile);
        setRelationship(children.find((child) => child.id === studentId)?.relationship ?? "");
        setFees(feeRows);
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
  const statusTone = (status: string) => status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-700"
    : status === "ALUMNI"
      ? "bg-blue-50 text-blue-700"
      : status === "PROMOTED"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-5">
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
            {current ? <p className="mt-2 text-sm font-medium text-slate-600">{current.school} · {current.level} — Section {current.section} · Roll #{current.rollNumber}</p> : null}
          </div>
        </div>
        {current ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2"><School className="h-4 w-4 text-blue-600" /><p className="mt-1 text-[11px] text-slate-400">Current school</p><p className="text-sm font-medium text-slate-800">{current.school}</p></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><BookOpen className="h-4 w-4 text-violet-600" /><p className="mt-1 text-[11px] text-slate-400">Current class</p><p className="text-sm font-medium text-slate-800">{current.level} · Section {current.section}</p></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><CalendarDays className="h-4 w-4 text-amber-500" /><p className="mt-1 text-[11px] text-slate-400">Academic year</p><p className="text-sm font-medium text-slate-800">{current.year}</p></div>
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

