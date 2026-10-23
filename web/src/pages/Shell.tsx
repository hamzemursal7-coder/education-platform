import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  School,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { api, type SessionUser } from "../lib/api";
import { PasswordLinkDialog } from "../components/PasswordLinkDialog";

const labels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  ACCOUNTANT: "Accountant",
  STAFF: "Staff",
  PARENT: "Parent",
  STUDENT: "Student",
};

type Summary = {
  organizations: number;
  schools: number;
  users: number;
  students: number;
  maleStudents: number;
  femaleStudents: number;
  teachers: number;
  staff: number;
  parents: number;
  graduates: number;
  activeEnrollments: number;
  pendingTransfers: number;
  feesCollected: number;
  feesOutstanding: number;
  schoolList: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    address: string | null;
    primaryColor: string;
    accentColor: string;
    iconKey: string;
    isActive: boolean;
    isDemo: boolean;
    organization: string;
    activeEnrollments: number;
    users: number;
    teachers: number;
    staff: number;
    alumni: number;
    feesCollected: number;
    feesOutstanding: number;
    admin: { id: string; firstName: string; lastName: string; email: string; phone: string } | null;
  }>;
};

type OrgRow = { id: string; name: string; isDemo: boolean; schools: number };

function splitAdminName(firstName: string, lastName: string) {
  const rest = lastName.trim().split(/\s+/).filter(Boolean);
  if (rest.length >= 2) return { firstName, middleName: rest[0], lastName: rest.slice(1).join(" ") };
  return { firstName, middleName: "", lastName: lastName.trim() };
}

type SchoolDash = {
  school: { name: string; code: string; type: "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY" };
  students: number;
  activeEnrollments: number;
  teachers: number;
  parents: number;
  graduates: number;
  staff: number;
  fees: { unpaid: number; partial: number; paid: number; collected: number; outstanding: number };
  pendingTransfers: number;
  alumni: number;
  publishedAnnouncements: number;
  exams: number;
  attendanceRate: number | null;
};

type TeacherDash = {
  assignmentCount: number;
  sections: Array<{ id: string; name: string; level: string; year: string }>;
  subjects: Array<{ id: string; name: string }>;
  pendingMarks: number;
  announcements: number;
};

type AccountantDash = {
  collected: number;
  paymentCount: number;
  outstanding: number;
  waived: number;
  unpaid: number;
  partial: number;
  recentPayments: Array<{ id: string; receiptNumber: string; amount: number; student: string }>;
};

type NavIconKey =
  | "dashboard"
  | "academic"
  | "students"
  | "teachers"
  | "staff"
  | "parents"
  | "announcements"
  | "attendance"
  | "exams"
  | "finance"
  | "promotion"
  | "alumni"
  | "transfers"
  | "reports"
  | "audit"
  | "search"
  | "subjects"
  | "children"
  | "marks"
  | "profile"
  | "settings"
  | "schools";

type NavItem = { to: string; label: string; icon: NavIconKey };

const iconClass = "h-5 w-5 shrink-0";
const navIcons: Record<NavIconKey, ReactNode> = {
  dashboard: <LayoutDashboard className={iconClass} />,
  academic: <BookOpen className={iconClass} />,
  students: <Users className={iconClass} />,
  teachers: <UserPlus className={iconClass} />,
  staff: <ClipboardList className={iconClass} />,
  parents: <UsersRound className={iconClass} />,
  announcements: <Megaphone className={iconClass} />,
  attendance: <BadgeCheck className={iconClass} />,
  exams: <FileText className={iconClass} />,
  finance: <Wallet className={iconClass} />,
  promotion: <GraduationCap className={iconClass} />,
  alumni: <GraduationCap className={iconClass} />,
  transfers: <ArrowLeftRight className={iconClass} />,
  reports: <BarChart3 className={iconClass} />,
  audit: <Shield className={iconClass} />,
  search: <Search className={iconClass} />,
  subjects: <BookOpen className={iconClass} />,
  children: <Users className={iconClass} />,
  marks: <Pencil className={iconClass} />,
  profile: <User className={iconClass} />,
  settings: <Settings className={iconClass} />,
  schools: <School className={iconClass} />,
};

export function Shell({
  user,
  onLogout,
  onExitSchool,
  title,
  children,
}: {
  user: SessionUser;
  onLogout: () => void;
  onExitSchool?: () => void;
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const links: NavItem[] =
    user.role === "SCHOOL_ADMIN"
      ? [
          { to: "/school/dashboard", label: "Dashboard", icon: "dashboard" },
          { to: "/school/search", label: "Search", icon: "search" },
          { to: "/school/subjects", label: "Subjects", icon: "subjects" },
          { to: "/school/audit", label: "Audit log", icon: "audit" },
          { to: "/school/academic-years", label: "Academic years", icon: "academic" },
          { to: "/school/students", label: "Students", icon: "students" },
          { to: "/school/parents", label: "Parents", icon: "parents" },
          { to: "/school/teachers", label: "Teachers", icon: "teachers" },
          { to: "/school/staff", label: "Staff", icon: "staff" },
          { to: "/school/attendance", label: "Attendance", icon: "attendance" },
          { to: "/school/exams", label: "Exams", icon: "exams" },
          { to: "/school/results", label: "Results", icon: "reports" },
          { to: "/school/promotion", label: "Promotion", icon: "promotion" },
          { to: "/school/alumni", label: "Alumni", icon: "alumni" },
          { to: "/school/transfers", label: "Transfers", icon: "transfers" },
          { to: "/school/fees", label: "Finance", icon: "finance" },
          { to: "/school/reports", label: "Reports", icon: "reports" },
          { to: "/school/announcements", label: "Announcements", icon: "announcements" },
          { to: "/school/settings", label: "Settings", icon: "settings" },
        ]
      : user.role === "TEACHER"
        ? [
            { to: "/teacher/dashboard", label: "Dashboard", icon: "dashboard" },
            { to: "/teacher/profile", label: "My Profile", icon: "profile" },
            { to: "/teacher/schools", label: "My Schools", icon: "schools" },
            { to: "/teacher/assignments", label: "My Assignments", icon: "academic" },
            { to: "/teacher/exams", label: "Exams & Results", icon: "exams" },
            { to: "/teacher/marks", label: "Marks Entry", icon: "marks" },
            { to: "/teacher/attendance", label: "Attendance", icon: "attendance" },
            { to: "/teacher/announcements", label: "Announcements", icon: "announcements" },
          ]
        : user.role === "PARENT"
          ? [
              { to: "/parent/dashboard", label: "My children", icon: "children" },
              { to: "/parent/attendance", label: "Attendance", icon: "attendance" },
              { to: "/parent/fees", label: "Fees", icon: "finance" },
              { to: "/parent/announcements", label: "Announcements", icon: "announcements" },
            ]
          : user.role === "ACCOUNTANT"
            ? [
                { to: "/accountant/dashboard", label: "Dashboard", icon: "dashboard" },
                { to: "/accountant/fees", label: "Fees", icon: "finance" },
                { to: "/accountant/announcements", label: "Announcements", icon: "announcements" },
              ]
            : user.role === "STAFF"
              ? [
                  { to: "/staff/dashboard", label: "Dashboard", icon: "dashboard" },
                  { to: "/staff/announcements", label: "Announcements", icon: "announcements" },
                ]
              : user.role === "STUDENT"
                ? [
                    { to: "/student/dashboard", label: "Dashboard", icon: "dashboard" },
                    { to: "/student/attendance", label: "Attendance", icon: "attendance" },
                    { to: "/student/announcements", label: "Announcements", icon: "announcements" },
                  ]
                : [{ to: "/superadmin/dashboard", label: "Dashboard", icon: "dashboard" }];

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const portalLabel = `${labels[user.role] ?? user.role} Portal`;
  const announcementTo: Record<string, string> = {
    SCHOOL_ADMIN: "/school/announcements",
    TEACHER: "/teacher/announcements",
    PARENT: "/parent/announcements",
    ACCOUNTANT: "/accountant/announcements",
    STAFF: "/staff/announcements",
    STUDENT: "/student/announcements",
  };
  const subtitle =
    location.pathname.startsWith("/parent/children/")
      ? "Manage your child's information, view their school history, attendance, marks and more."
      : location.pathname.startsWith("/parent/fees")
        ? "Balances, payments, and receipts for your children."
      : location.pathname.startsWith("/parent/attendance")
        ? "Track daily and monthly attendance records and teacher notes for your children."
      : location.pathname.startsWith("/parent")
        ? "Manage your children, view their school information, fees and announcements."
      : location.pathname.startsWith("/teacher/marks")
        ? "Choose your school, year, and exam, then open the marksheet for your subject."
      : location.pathname.startsWith("/teacher/exams")
        ? "Exams created for your classes. You can enter marks, not create the exam."
      : location.pathname.startsWith("/teacher/assignments")
        ? "Your classes, sections, and subjects at each school."
      : location.pathname.startsWith("/teacher/schools")
        ? "Schools you are assigned to teach in."
      : location.pathname.startsWith("/teacher/profile")
        ? "Your teacher record."
      : location.pathname.startsWith("/teacher")
        ? "Your classes, exams, and marks."
        : location.pathname.startsWith("/school/results")
          ? "Review submitted marks, approve them, then publish the approved results."
        : location.pathname.startsWith("/school/exams")
          ? "Choose the year, dates, classes, sections, and subjects. You can edit the exam later."
        : location.pathname.startsWith("/school/subjects")
          ? "Every subject offered at this school."
        : location.pathname.startsWith("/school")
          ? "Manage students, staff, academics, and school operations."
          : location.pathname.startsWith("/superadmin")
            ? "Every school in your organization, by division."
            : location.pathname.startsWith("/accountant")
              ? "Track collections, balances, and recent payments."
              : location.pathname.startsWith("/student")
                ? "View Your attendance,  class, published results, and academic year."
                : "Your staff workspace.";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = headerQuery.trim();
    if (user.role === "SCHOOL_ADMIN") {
      navigate(`/school/search?q=${encodeURIComponent(value)}`);
      return;
    }
    const next = new URLSearchParams(location.search);
    if (value) next.set("q", value);
    else next.delete("q");
    navigate({ pathname: location.pathname, search: next.toString() });
  }

  const schoolMenu = user.role === "SCHOOL_ADMIN";
  const hideShellTitle = schoolMenu && (title === "Parents" || title === "Students" || title === "Attendance" || title === "Student profile");

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      {menuOpen ? <button className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 z-40 flex w-60 flex-col border-r border-[#e2e8f0] transition-transform md:static md:translate-x-0 ${schoolMenu ? "bg-white text-slate-700" : "border-slate-800 bg-[#0f172a] text-slate-200"}`}>
        <div className={`flex h-16 items-center gap-3 px-4 ${schoolMenu ? "border-b border-[#e2e8f0]" : "border-b border-slate-800"}`}>
          <img src="/school-logo.svg" alt="" className="h-9 w-9 rounded-full bg-white object-cover" />
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${schoolMenu ? "text-slate-950" : "text-white"}`}>{user.school?.name ?? "Education"}</div>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${schoolMenu ? "text-slate-500" : "text-slate-400"}`}>{user.actingFromSuperAdmin ? "School view" : portalLabel}</div>
          </div>
        </div>
        <div className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${schoolMenu ? "text-slate-400" : "text-slate-500"}`}>Main menu</div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                schoolMenu
                  ? `flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] ${isActive ? "bg-[#2563eb] font-semibold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
                  : `flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] ${isActive ? "bg-[#2563eb] font-medium text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`
              }
            >
              <span className="opacity-90">{navIcons[item.icon]}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={`px-4 py-4 ${schoolMenu ? "border-t border-sky-100" : "border-t border-slate-800"}`}>
          <div className="flex items-center gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${schoolMenu ? "bg-sky-600" : "bg-[#2563eb]"}`}>{initials}</div>
            <div className="min-w-0">
              <div className={`truncate text-sm font-medium ${schoolMenu ? "text-slate-900" : "text-white"}`}>{user.firstName} {user.lastName}</div>
              <div className={`truncate text-xs ${schoolMenu ? "text-slate-500" : "text-slate-400"}`}>{user.email}</div>
            </div>
          </div>
          {user.actingFromSuperAdmin && onExitSchool ? (
            <button className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium ${schoolMenu ? "border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : "bg-[#2563eb] text-white hover:bg-blue-500"}`} onClick={onExitSchool}>Back to schools</button>
          ) : null}
          <button className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm ${schoolMenu ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`} onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur md:px-6">
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 md:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></button>
          <form className="relative min-w-0 flex-1 md:mx-auto md:max-w-xl" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={headerQuery} onChange={(event) => setHeaderQuery(event.target.value)} className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-slate-50 pl-10 pr-16 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-blue-100" placeholder="Search anything..." />
          </form>
          {announcementTo[user.role] ? (
            <Link to={announcementTo[user.role]} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Announcements"><Bell className="h-5 w-5" /></Link>
          ) : null}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2563eb] text-sm font-semibold text-white">{initials}</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-slate-500">{labels[user.role] ?? user.role}</div>
            </div>
          </div>
        </header>
        <div className="min-w-0 flex-1 px-3 py-3 md:px-4 md:py-4 xl:px-6 xl:py-6">
          {user.actingFromSuperAdmin && user.school ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">School</p>
                <p className="text-xl font-bold text-slate-950">{user.school.name}</p>
              </div>
              {onExitSchool ? (
                <button type="button" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100" onClick={onExitSchool}>Back to schools</button>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-1 text-sm text-slate-400">Organization <ChevronRight className="h-3.5 w-3.5" /> <span className="font-medium text-[#2563eb]">{labels[user.role] ?? user.role}</span></p>
          )}
          {hideShellTitle ? null : (
            <>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
              <p className="mt-1 text-[13px] text-[#64748b]">{subtitle}</p>
            </>
          )}
          <div className="mt-4">{children}</div>
        </div>
      </section>
    </div>
  );
}

export function SuperAdminHome() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmSchool, setConfirmSchool] = useState<Summary["schoolList"][number] | null>(null);
  const [deleteSchool, setDeleteSchool] = useState<Summary["schoolList"][number] | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);
  const [createSchoolOpen, setCreateSchoolOpen] = useState(false);
  const [assignAdminOpen, setAssignAdminOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [schoolForm, setSchoolForm] = useState({
    organizationId: "",
    organizationName: "",
    name: "",
    address: "",
    type: "PRIMARY_AND_SECONDARY",
    primaryColor: "#4f46e5",
    accentColor: "#10b981",
    iconKey: "school",
  });
  const [adminForm, setAdminForm] = useState({
    schoolId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [editSchool, setEditSchool] = useState<Summary["schoolList"][number] | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    type: "PRIMARY_AND_SECONDARY",
    adminId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  async function load() {
    const [summaryRows, orgRows] = await Promise.all([
      api<Summary>("/api/v1/dashboard/summary"),
      api<OrgRow[]>("/api/v1/superadmin/organizations"),
    ]);
    setSummary(summaryRows);
    setOrgs(orgRows);
    setSchoolForm((current) => ({
      ...current,
      organizationId: current.organizationId || orgRows[0]?.id || "",
    }));
    setAdminForm((current) => ({
      ...current,
      schoolId: current.schoolId || summaryRows.schoolList[0]?.id || "",
    }));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load dashboard."));
  }, []);

  async function confirmToggle() {
    if (!confirmSchool) return;
    setError("");
    try {
      await api(`/api/v1/superadmin/schools/${confirmSchool.id}/toggle`, { method: "POST" });
      setConfirmSchool(null);
      setMessage(confirmSchool.isActive ? `${confirmSchool.name} deactivated.` : `${confirmSchool.name} activated.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Toggle failed.");
    }
  }

  async function confirmDeleteSchool() {
    if (!deleteSchool) return;
    setError("");
    try {
      await api(`/api/v1/superadmin/schools/${deleteSchool.id}`, { method: "DELETE" });
      setMessage(`${deleteSchool.name} deleted.`);
      setDeleteSchool(null);
      await load();
    } catch (caught) {
      setDeleteSchool(null);
      setError(caught instanceof Error ? caught.message : "School could not be deleted.");
    }
  }

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const selectedOrg = orgs.find((org) => org.name === "Educationnetwork") ?? orgs[0];
      const created = await api<{ id: string; name: string }>("/api/v1/superadmin/schools", {
        method: "POST",
        body: JSON.stringify({
          name: schoolForm.name,
          address: schoolForm.address.trim(),
          type: schoolForm.type,
          ...(selectedOrg ? { organizationId: selectedOrg.id } : {}),
        }),
      });
      setSchoolForm((current) => ({
        ...current,
        name: "",
        address: "",
      }));
      setCreateSchoolOpen(false);
      setMessage(`${created.name} created.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create school.");
    }
  }

  async function assignSchoolAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const invited = await api<{ setPasswordPath: string; email: string }>(`/api/v1/superadmin/schools/${adminForm.schoolId}/admins`, {
        method: "POST",
        body: JSON.stringify({
          firstName: adminForm.firstName,
          middleName: adminForm.middleName,
          lastName: adminForm.lastName,
          email: adminForm.email,
          phone: adminForm.phone,
        }),
      });
      setInviteLink({ email: invited.email, url: `${window.location.origin}${invited.setPasswordPath}` });
      setAdminForm((current) => ({ ...current, firstName: "", middleName: "", lastName: "", email: "", phone: "" }));
      setAssignAdminOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not invite admin.");
    }
  }

  function openEdit(school: Summary["schoolList"][number]) {
    const names = school.admin ? splitAdminName(school.admin.firstName, school.admin.lastName) : { firstName: "", middleName: "", lastName: "" };
    setEditSchool(school);
    setEditForm({
      name: school.name,
      address: school.address ?? "",
      type: school.type,
      adminId: school.admin?.id ?? "",
      firstName: names.firstName,
      middleName: names.middleName,
      lastName: names.lastName,
      email: school.admin?.email ?? "",
      phone: school.admin?.phone ?? "",
    });
    setError("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editSchool) return;
    setError("");
    try {
      await api(`/api/v1/superadmin/schools/${editSchool.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editForm.name, address: editForm.address, type: editForm.type }),
      });
      const adminBody = {
        firstName: editForm.firstName,
        middleName: editForm.middleName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
      };
      const adminStarted = Object.values(adminBody).some((value) => value.trim());
      if (editForm.adminId) {
        await api(`/api/v1/superadmin/schools/${editSchool.id}/admins/${editForm.adminId}`, {
          method: "PATCH",
          body: JSON.stringify(adminBody),
        });
        setMessage(`${editForm.name} updated.`);
      } else if (adminStarted) {
        const invited = await api<{ setPasswordPath: string; email: string }>(`/api/v1/superadmin/schools/${editSchool.id}/admins`, {
          method: "POST",
          body: JSON.stringify(adminBody),
        });
        setInviteLink({ email: invited.email, url: `${window.location.origin}${invited.setPasswordPath}` });
        setMessage(`${editForm.name} updated.`);
      } else {
        setMessage(`${editForm.name} updated.`);
      }
      setEditSchool(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update school.");
    }
  }

  if (error && !summary) return <p className="text-red-600">{error}</p>;
  if (!summary) return <p className="text-slate-500">Loading schools...</p>;

  const normalizedSearch = schoolSearch.trim().toLowerCase();
  const visibleSchools = summary.schoolList.filter((school) => {
    const matchesSearch = !normalizedSearch || school.name.toLowerCase().includes(normalizedSearch) || (school.address ?? "").toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? school.isActive : !school.isActive);
    const matchesType =
      typeFilter === "ALL"
      || school.type === typeFilter
      || (typeFilter === "PRIMARY_SUPPORTED" && school.type !== "SECONDARY_ONLY")
      || (typeFilter === "SECONDARY_SUPPORTED" && school.type !== "PRIMARY_ONLY");
    return matchesSearch && matchesStatus && matchesType;
  });
  const primarySchools = summary.schoolList.filter((school) => school.type !== "SECONDARY_ONLY");
  const secondarySchools = summary.schoolList.filter((school) => school.type !== "PRIMARY_ONLY");
  const activeSchools = summary.schoolList.filter((school) => school.isActive).length;
  const typeLabel = (type: string) => type === "PRIMARY_ONLY" ? "Primary" : type === "SECONDARY_ONLY" ? "Secondary" : "Primary & Secondary";
  const typeTone = (type: string) => type === "PRIMARY_ONLY" ? "bg-violet-50 text-violet-700" : type === "SECONDARY_ONLY" ? "bg-fuchsia-50 text-fuchsia-700" : "bg-slate-100 text-slate-700";
  const organizationLabel = "Educationnetwork";
  const deleteNameMatches = deleteSchool ? deletePhrase.trim() === deleteSchool.name : false;

  async function deactivateBeforeDelete() {
    if (!deleteSchool) return;
    setError("");
    try {
      await api(`/api/v1/superadmin/schools/${deleteSchool.id}/toggle`, { method: "POST" });
      setDeleteSchool({ ...deleteSchool, isActive: false });
      setDeletePhrase("");
      setMessage(`${deleteSchool.name} deactivated. Type its name to delete it.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate school.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Organization overview</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Super Admin Command Center</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-500">Manage and monitor all schools from one place.</p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-violet-500" /> Multi-school management</span>
              <span className="inline-flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5 text-violet-500" /> Centralized control</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-violet-500" /> Security & governance</span>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm"><School className="h-8 w-8" /></span>
            <div>
              <p className="text-sm font-semibold text-slate-900">All schools</p>
              <p className="text-xs text-slate-500">Complete overview of your organization.</p>
              <a href="#schools-overview" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">View schools <ChevronRight className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total schools</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.schools}</p><p className="mt-1 text-xs text-slate-500">{activeSchools} active</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total students</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.students}</p><p className="mt-1 text-xs text-slate-500">{summary.maleStudents} male · {summary.femaleStudents} female</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total teachers</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.teachers}</p><p className="mt-1 text-xs text-slate-500">{summary.activeEnrollments} active enrollments</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total staff</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.staff}</p><p className="mt-1 text-xs text-slate-500">{summary.pendingTransfers} pending transfers</p></article>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Graduated students</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.graduates}</p><p className="mt-1 text-xs text-emerald-800">Alumni across all schools</p></article>
        <article className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Parents</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.parents}</p><p className="mt-1 text-xs text-amber-800">Guardians on record</p></article>
        <article className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Fees collected</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.feesCollected.toLocaleString()}</p><p className="mt-1 text-xs text-blue-800">Payments received</p></article>
        <article className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">Fees outstanding</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.feesOutstanding.toLocaleString()}</p><p className="mt-1 text-xs text-rose-800">Still unpaid</p></article>
      </div>
      <p className="text-xs text-slate-500">Primary schools {primarySchools.length} · Secondary schools {secondarySchools.length} · Parents / guardians {summary.parents}</p>

      <section id="schools-overview" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Schools overview</h3>
            <p className="text-sm text-slate-500">All schools in your organization.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreateSchoolOpen(true)}><Plus className="h-4 w-4" /> New school</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_220px]">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:col-span-2 xl:col-span-1">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search schools by name..." value={schoolSearch} onChange={(event) => setSchoolSearch(event.target.value)} />
          </label>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">All types</option>
            <option value="PRIMARY_ONLY">Primary</option>
            <option value="SECONDARY_ONLY">Secondary</option>
            <option value="PRIMARY_AND_SECONDARY">Primary & Secondary</option>
            <option value="PRIMARY_SUPPORTED">All primary schools</option>
            <option value="SECONDARY_SUPPORTED">All secondary schools</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {visibleSchools.map((school) => {
            const adminName = school.admin ? `${school.admin.firstName} ${school.admin.lastName}`.trim() : "";
            return (
              <article key={school.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.55)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-lg font-semibold tracking-tight text-slate-950">{school.name}</h4>
                    <p className="mt-1 text-sm text-slate-500">{school.address || "No address yet"}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${school.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${school.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {school.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeTone(school.type)}`}>{typeLabel(school.type)}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 px-2 py-3 text-center">
                  <div><p className="text-lg font-semibold text-slate-950">{school.activeEnrollments}</p><p className="text-[11px] text-slate-500">Students</p></div>
                  <div><p className="text-lg font-semibold text-slate-950">{school.teachers}</p><p className="text-[11px] text-slate-500">Teachers</p></div>
                  <div><p className="text-lg font-semibold text-slate-950">{school.staff}</p><p className="text-[11px] text-slate-500">Staff</p></div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-100 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">School admin</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{adminName || "Not assigned yet"}</p>
                  <p className="truncate text-sm text-slate-500">{school.admin?.email || "No email"}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white" onClick={() => openEdit(school)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  {school.isActive ? (
                    <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => {
                      setError("");
                      api(`/api/v1/superadmin/schools/${school.id}/enter`, { method: "POST" })
                        .then(() => { window.location.assign("/school/dashboard"); })
                        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not enter school."));
                    }}>View</button>
                  ) : null}
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setAdminForm((current) => ({ ...current, schoolId: school.id, firstName: "", middleName: "", lastName: "", email: "", phone: "" })); setAssignAdminOpen(true); }}>Assign</button>
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setConfirmSchool(school)}>{school.isActive ? "Deactivate" : "Activate"}</button>
                  <button type="button" className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={() => { setDeletePhrase(""); setDeleteSchool(school); }}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
        {!visibleSchools.length ? <p className="py-10 text-center text-sm text-slate-500">No schools match these filters.</p> : null}
      </section>

      {createSchoolOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form className="my-6 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl" onSubmit={createSchool}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><Building2 className="h-6 w-6" /></div>
              <div className="flex-1"><h3 className="text-xl font-bold text-slate-950">Create New School</h3><p className="mt-1 text-sm text-slate-500">Add a new school to your organization.</p></div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setCreateSchoolOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-slate-700">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Organization</p>
                <p className="mt-1 font-semibold text-slate-900">{organizationLabel}</p>
              </div>
              <label className="text-sm font-semibold text-slate-700">School name *
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><Building2 className="h-4 w-4 text-blue-500" /><input className="w-full py-3 font-normal outline-none" placeholder="Enter school name" value={schoolForm.name} onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })} required /></div>
              </label>
              <label className="text-sm font-semibold text-slate-700">Address
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><MapPin className="h-4 w-4 text-slate-400" /><input className="w-full py-3 font-normal outline-none" placeholder="Optional" value={schoolForm.address} onChange={(event) => setSchoolForm({ ...schoolForm, address: event.target.value })} /></div>
              </label>
              <label className="text-sm font-semibold text-slate-700">School level
                <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800" value={schoolForm.type} onChange={(event) => setSchoolForm({ ...schoolForm, type: event.target.value })}>
                  <option value="PRIMARY_AND_SECONDARY">Primary & Secondary</option>
                  <option value="PRIMARY_ONLY">Primary only</option>
                  <option value="SECONDARY_ONLY">Secondary only</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setCreateSchoolOpen(false)}>Cancel</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><Check className="h-4 w-4" /> Create School</button>
            </div>
          </form>
        </div>
      ) : null}

      {editSchool ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form className="my-6 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl" onSubmit={saveEdit}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-700"><Pencil className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-950">Edit school</h3>
                <p className="mt-1 text-sm text-slate-500">Change the school and its administrator.</p>
              </div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setEditSchool(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">School name
                <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Address
                <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" placeholder="Optional" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">School level
                <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800" value={editForm.type} onChange={(event) => setEditForm({ ...editForm, type: event.target.value })}>
                  <option value="PRIMARY_AND_SECONDARY">Primary & Secondary</option>
                  <option value="PRIMARY_ONLY">Primary only</option>
                  <option value="SECONDARY_ONLY">Secondary only</option>
                </select>
              </label>
              <p className="sm:col-span-2 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">School admin</p>
              <label className="text-sm font-semibold text-slate-700">First name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required={Boolean(editForm.adminId)} /></label>
              <label className="text-sm font-semibold text-slate-700">Middle name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={editForm.middleName} onChange={(event) => setEditForm({ ...editForm, middleName: event.target.value })} required={Boolean(editForm.adminId)} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Last name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} required={Boolean(editForm.adminId)} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Email<input type="email" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required={Boolean(editForm.adminId)} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Phone number<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" placeholder="+252..." value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} required={Boolean(editForm.adminId)} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setEditSchool(null)}>Cancel</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"><Check className="h-4 w-4" /> Save changes</button>
            </div>
          </form>
        </div>
      ) : null}

      {assignAdminOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onSubmit={assignSchoolAdmin}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><UserPlus className="h-6 w-6" /></div>
              <div className="flex-1"><h3 className="text-xl font-bold text-slate-950">Assign School Admin</h3><p className="mt-1 text-sm text-slate-500">Add the administrator's contact information.</p></div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setAssignAdminOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">School
                <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800" value={adminForm.schoolId} onChange={(event) => setAdminForm({ ...adminForm, schoolId: event.target.value })} required>{summary.schoolList.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
              </label>
              <label className="text-sm font-semibold text-slate-700">First name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={adminForm.firstName} onChange={(event) => setAdminForm({ ...adminForm, firstName: event.target.value })} required /></label>
              <label className="text-sm font-semibold text-slate-700">Middle name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={adminForm.middleName} onChange={(event) => setAdminForm({ ...adminForm, middleName: event.target.value })} required /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Last name<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-400" value={adminForm.lastName} onChange={(event) => setAdminForm({ ...adminForm, lastName: event.target.value })} required /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Email
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-blue-400"><Mail className="h-4 w-4 text-slate-400" /><input type="email" className="w-full py-3 font-normal outline-none" placeholder="admin@school.com" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} required /></div>
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Phone number
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-blue-400"><Phone className="h-4 w-4 text-slate-400" /><input className="w-full py-3 font-normal outline-none" placeholder="+252..." value={adminForm.phone} onChange={(event) => setAdminForm({ ...adminForm, phone: event.target.value })} required /></div>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setAssignAdminOpen(false)}>Cancel</button><button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"><UserPlus className="h-4 w-4" /> Assign Admin</button></div>
          </form>
        </div>
      ) : null}

      {confirmSchool ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {confirmSchool.isActive ? "Deactivate school?" : "Activate school?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirmSchool.isActive
                ? `This will lock ${confirmSchool.name}. Students, teachers, and staff will lose access until it is activated again.`
                : `This will restore access for ${confirmSchool.name}.`}
            </p>
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Confirm only if you intend to change school access. This action is audited.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setConfirmSchool(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmSchool.isActive ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
                onClick={() => void confirmToggle()}
              >
                {confirmSchool.isActive ? "Yes, deactivate" : "Yes, activate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteSchool ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Delete {deleteSchool.name}?</h3>
            {deleteSchool.isActive ? (
              <>
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium leading-6 text-rose-800">
                  This school is still active. Deactivate it before it can be deleted. Deactivation locks students, teachers, and staff out of the school.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setDeleteSchool(null)}>Cancel</button>
                  <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500" onClick={() => void deactivateBeforeDelete()}>Deactivate first</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium leading-6 text-rose-800">
                  This permanently deletes {deleteSchool.name} and everything in it: students, teachers, staff, classes, marks, and fees. This cannot be undone.
                </p>
                <label className="mt-4 block text-sm font-semibold text-slate-700">Type the school name to confirm
                  <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-rose-400" value={deletePhrase} placeholder={deleteSchool.name} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { setDeleteSchool(null); setDeletePhrase(""); }}>Cancel</button>
                  <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300" disabled={!deleteNameMatches} onClick={() => void confirmDeleteSchool()}>Delete permanently</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {inviteLink ? <PasswordLinkDialog email={inviteLink.email} url={inviteLink.url} onClose={() => setInviteLink(null)} /> : null}

      {message ? <p className="fixed right-5 top-5 z-[60] max-w-md rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-xl">{message}</p> : null}
      {error ? <p className="fixed right-5 top-5 z-[60] max-w-md rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-xl">{error}</p> : null}
    </div>
  );
}

export function SchoolDashboard() {
  const [data, setData] = useState<SchoolDash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SchoolDash>("/api/v1/dashboard/school")
      .then(setData)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load dashboard."));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard...</p>;

  const kind = data.school.type === "PRIMARY_ONLY" ? "Primary" : data.school.type === "SECONDARY_ONLY" ? "Secondary" : "Primary and Secondary";
  const kindTone = data.school.type === "PRIMARY_ONLY" ? "bg-emerald-50 text-emerald-700" : data.school.type === "SECONDARY_ONLY" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700";

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white"><School className="h-7 w-7" /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">School</p>
            <h2 className="truncate text-2xl font-bold text-slate-950">{data.school.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{data.school.code}</p>
          </div>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-bold ${kindTone}`}>{kind}</span>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Students" value={data.students} tone="blue" icon={<Users className="h-5 w-5" />} />
        <Card label="Graduated students" value={data.graduates} tone="green" icon={<GraduationCap className="h-5 w-5" />} />
        <Card label="Teachers" value={data.teachers} tone="violet" icon={<User className="h-5 w-5" />} />
        <Card label="Parents" value={data.parents} tone="amber" icon={<UsersRound className="h-5 w-5" />} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">School activity</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Active enrollments" value={data.activeEnrollments} tone="green" />
          <Card label="Staff" value={data.staff} tone="amber" />
          <Card label="Fees collected" value={data.fees.collected} tone="green" />
          <Card label="Fees outstanding" value={data.fees.outstanding} tone="amber" />
          <Card label="Attendance rate" value={data.attendanceRate == null ? "—" : `${data.attendanceRate}%`} tone="violet" />
          <Card label="Pending transfers" value={data.pendingTransfers} tone="blue" />
          <Card label="Exams" value={data.exams} tone="violet" />
          <Card label="Announcements" value={data.publishedAnnouncements} tone="green" />
          <Card label="Unpaid fee bills" value={data.fees.unpaid} tone="amber" />
        </div>
      </div>
    </div>
  );
}

export function AccountantDashboard() {
  const [data, setData] = useState<AccountantDash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AccountantDash>("/api/v1/dashboard/accountant")
      .then(setData)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load dashboard."));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card label="Collected" value={data.collected} tone="green" />
        <Card label="Outstanding" value={data.outstanding} tone="amber" />
        <Card label="Payments" value={data.paymentCount} tone="blue" />
        <Card label="Unpaid bills" value={data.unpaid} tone="amber" />
        <Card label="Partial bills" value={data.partial} tone="violet" />
        <Card label="Waived" value={data.waived} tone="blue" />
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent payments</h2>
        {data.recentPayments.map((payment) => (
          <article key={payment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-900">{payment.receiptNumber} · {payment.amount}</p>
            <p className="text-sm text-slate-500">{payment.student}</p>
          </article>
        ))}
        {!data.recentPayments.length ? <p className="text-slate-500">No payments yet.</p> : null}
      </div>
    </div>
  );
}

export function RoleHome({ user }: { user: SessionUser }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card label="Signed in as" value={`${user.firstName} ${user.lastName}`} tone="violet" />
      <Card label="Portal" value={labels[user.role] ?? user.role} tone="blue" />
    </div>
  );
}

function Card({
  label,
  value,
  tone = "violet",
  icon,
}: {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "violet" | "amber";
  icon?: ReactNode;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon ?? <LayoutDashboard className="h-5 w-5" />}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold text-slate-950">{value}</p>
      </div>
    </article>
  );
}
