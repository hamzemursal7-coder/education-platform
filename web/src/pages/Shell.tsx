import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeftRight,
  BadgeCheck,
  BarChart2,
  BarChart3,
  Bell,
  Building2,
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  School,
  Shield,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  X,
  ExternalLink,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { api, type SessionUser } from "../lib/api";
import { PasswordLinkDialog } from "../components/PasswordLinkDialog";
import { AdminAvatar } from "../components/AdminAvatar";
import { ProfileModal } from "../components/ProfileModal";

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
  academicYear?: string;
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
  attendanceToday?: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    total: number;
  };
  recentActivities?: Array<{
    id: string;
    type: "ENROLLMENT" | "PAYMENT" | "CONDUCT";
    title: string;
    subtitle: string;
    time: string;
  }>;
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
  | "schools"
  | "conduct";

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
  conduct: <ShieldAlert className={iconClass} />,
};

export function Shell({
  user,
  onLogout,
  onExitSchool,
  onUserUpdated,
  title,
  children,
}: {
  user: SessionUser;
  onLogout: () => void;
  onExitSchool?: () => void;
  onUserUpdated?: (user: SessionUser) => void;
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const links: NavItem[] =
    user.role === "SCHOOL_ADMIN"
      ? [
          { to: "/school/dashboard", label: "Dashboard", icon: "dashboard" },
          { to: "/school/subjects", label: "Subjects", icon: "subjects" },
          { to: "/school/audit", label: "Audit log", icon: "audit" },
          { to: "/school/academic-years", label: "Academic years", icon: "academic" },
          { to: "/school/students", label: "Students", icon: "students" },
          { to: "/school/parents", label: "Parents", icon: "parents" },
          { to: "/school/teachers", label: "Teachers", icon: "teachers" },
          { to: "/school/staff", label: "Staff", icon: "staff" },
          { to: "/school/attendance", label: "Attendance", icon: "attendance" },
          { to: "/school/conduct", label: "Conduct & Welfare", icon: "conduct" },
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
            { to: "/teacher/conduct", label: "Conduct & Welfare", icon: "conduct" },
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
                    { to: "/student/conduct", label: "Conduct & Merits", icon: "conduct" },
                    { to: "/student/attendance", label: "Attendance", icon: "attendance" },
                    { to: "/student/announcements", label: "Announcements", icon: "announcements" },
                  ]
                : [{ to: "/superadmin/dashboard", label: "Dashboard", icon: "dashboard" }];

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
        ? "Track your children's daily attendance, academic results, and school updates."
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
  const hideShellTitle =
    schoolMenu &&
    (title === "Parents" ||
      title === "Students" ||
      title === "Attendance" ||
      title === "Student profile" ||
      title === "Dashboard" ||
      title === "School dashboard");

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      {menuOpen ? <button className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 z-40 flex w-60 flex-col border-r border-[#e2e8f0] transition-transform md:static md:translate-x-0 ${schoolMenu ? "bg-white text-slate-700" : "border-slate-800 bg-[#0f172a] text-slate-200"}`}>
        <div className={`flex h-16 items-center gap-3 px-4 ${schoolMenu ? "border-b border-[#e2e8f0]" : "border-b border-slate-800"}`}>
          <img src="/school-logo.svg" alt="" className="h-9 w-9 rounded-full bg-white object-cover shadow-xs" />
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
                  ? `flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] ${isActive ? "bg-[#2563eb] font-semibold text-white shadow-xs" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
                  : `flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] ${isActive ? "bg-[#2563eb] font-medium text-white shadow-xs" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`
              }
            >
              <span className="opacity-90">{navIcons[item.icon]}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={`px-4 py-4 ${schoolMenu ? "border-t border-slate-100" : "border-t border-slate-800"}`}>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-100/80 group"
            title="Bedel Profile-kaaga"
          >
            <AdminAvatar photoUrl={user.photoUrl} name={`${user.firstName} ${user.lastName}`} size="sm" />
            <div className="min-w-0 flex-1">
              <div className={`truncate text-xs font-semibold ${schoolMenu ? "text-slate-900 group-hover:text-blue-600" : "text-white"}`}>
                {user.firstName} {user.lastName}
              </div>
              <div className={`truncate text-[11px] ${schoolMenu ? "text-slate-500" : "text-slate-400"}`}>{user.email}</div>
            </div>
          </button>
          {user.actingFromSuperAdmin && onExitSchool ? (
            <button className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold ${schoolMenu ? "border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : "bg-[#2563eb] text-white hover:bg-blue-500"}`} onClick={onExitSchool}>Back to schools</button>
          ) : null}
          <button className={`mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${schoolMenu ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`} onClick={onLogout}>
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {/* Top Header matching modern design */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 md:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>

            {/* School identity pill (Left) */}
            {schoolMenu && user.school ? (
              <div className="hidden lg:flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 shadow-2xs">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-[#2563eb]">
                  <School className="h-4 w-4" />
                </div>
                <div className="leading-tight text-left">
                  <div className="truncate text-xs font-bold text-slate-900 max-w-[140px]">{user.school.name}</div>
                  <div className="text-[10px] font-medium text-slate-500">Academic Year 2024 - 2025</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
              </div>
            ) : null}
          </div>

          {/* Search bar in the center */}
          <form className="relative min-w-0 flex-1 max-w-md mx-2 md:mx-6" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={headerQuery}
              onChange={(event) => setHeaderQuery(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="Search students, teachers, classes..."
            />
          </form>

          {/* Right actions: Single Bell notification badge and Admin Profile dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {announcementTo[user.role] ? (
              <Link
                to={announcementTo[user.role]}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Notifications & Announcements"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                  12
                </span>
              </Link>
            ) : null}

            {/* Profile Avatar & Name Block (Right Side) */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors text-left"
                aria-label="User Profile Menu"
              >
                <AdminAvatar photoUrl={user.photoUrl} name={`${user.firstName} ${user.lastName}`} size="md" />
                <div className="hidden sm:block leading-tight text-left">
                  <div className="text-xs font-bold text-slate-900">{user.firstName} {user.lastName}</div>
                  <div className="text-[11px] font-medium text-slate-500">{labels[user.role] ?? user.role}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900">{user.firstName} {user.lastName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    <span className="mt-1 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">
                      {labels[user.role] ?? user.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#2563eb] transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Edit Profile
                  </button>

                  {user.role === "SCHOOL_ADMIN" && (
                    <Link
                      to="/school/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      School Settings
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100 mt-1"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Modal for editing profile & photo */}
        {profileModalOpen && (
          <ProfileModal
            user={user}
            onClose={() => setProfileModalOpen(false)}
            onUserUpdated={(updated) => {
              onUserUpdated?.(updated);
            }}
          />
        )}

        <div className="min-w-0 flex-1 px-3 py-3 md:px-5 md:py-5 xl:px-8 xl:py-6">
          {hideShellTitle ? null : user.actingFromSuperAdmin && user.school ? (
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

export function SuperAdminHome({ user }: { user?: SessionUser } = {}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletedFeedback, setDeletedFeedback] = useState<{ name: string; message: string } | null>(null);
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

  useEffect(() => {
    if (!deletedFeedback) return;
    const timer = setTimeout(() => setDeletedFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [deletedFeedback]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(timer);
  }, [error]);

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
    const targetName = deleteSchool.name;
    setError("");
    try {
      await api(`/api/v1/superadmin/schools/${deleteSchool.id}`, { method: "DELETE" });
      setDeleteSchool(null);
      setDeletePhrase("");
      setDeletedFeedback({ name: targetName, message: `${targetName} deleted.` });
      setMessage(`${targetName} deleted.`);
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
  const organizationLabel = "Educationnetwork";
  const deleteNameMatches = deleteSchool ? deletePhrase.trim() === deleteSchool.name : false;

  const getSchoolTheme = (type: string) => {
    switch (type) {
      case "PRIMARY_ONLY":
        return {
          label: "Primary School",
          badge: "bg-purple-50 text-purple-700 border-purple-200/80",
          topBar: "from-purple-500 via-indigo-500 to-purple-600",
          iconBg: "bg-purple-100/90 text-purple-700",
          hoverBorder: "hover:border-purple-300",
        };
      case "SECONDARY_ONLY":
        return {
          label: "Secondary School",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
          topBar: "from-emerald-500 via-teal-500 to-emerald-600",
          iconBg: "bg-emerald-100/90 text-emerald-700",
          hoverBorder: "hover:border-emerald-300",
        };
      default:
        return {
          label: "Primary & Secondary",
          badge: "bg-blue-50 text-blue-700 border-blue-200/80",
          topBar: "from-blue-600 via-indigo-600 to-cyan-500",
          iconBg: "bg-blue-100/90 text-blue-700",
          hoverBorder: "hover:border-blue-300",
        };
    }
  };

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
    <div className="space-y-6">
      {/* Executive Command Center Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-900/40 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
              </span>
              <span>Super Admin Command Center · Centralized Control</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Welcome back, <span className="text-indigo-400">{user ? `${user.firstName} ${user.lastName}` : "Super Admin"}!</span>
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
              Centralized command center and complete oversight across all organization schools, students, educators, and finances.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5 sm:gap-3 text-xs font-medium text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/10">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>{summary.schools} Total Schools ({activeSchools} Active)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/10">
                <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
                <span>{summary.students.toLocaleString()} Total Students</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-xs border border-white/10">
                <UsersRound className="h-3.5 w-3.5 text-blue-400" />
                <span>{(summary.teachers + summary.staff).toLocaleString()} Teachers & Staff</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all cursor-pointer"
              onClick={() => setCreateSchoolOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Add new school</span>
            </button>
            <a
              href="#schools-overview"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-xs transition-all"
            >
              <span>View schools</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Primary KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Schools */}
        <article className="group relative overflow-hidden rounded-2xl border border-indigo-100/90 bg-white p-5 shadow-[0_4px_20px_rgba(79,70,229,0.06)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.12)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Total Schools</span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
              <School className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{summary.schools}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-600">{activeSchools} Active</span>
            <span className="text-slate-500">{summary.schools - activeSchools} Inactive</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Primary: {primarySchools.length}</span>
            <span>Secondary: {secondarySchools.length}</span>
          </div>
        </article>

        {/* Total Students */}
        <article className="group relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-white p-5 shadow-[0_4px_20px_rgba(16,185,129,0.06)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.12)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Students</span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{summary.students.toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600">👦 {summary.maleStudents} Male</span>
            <span className="text-slate-600">👧 {summary.femaleStudents} Female</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active Enrollments</span>
            <span className="font-semibold text-emerald-700">{summary.activeEnrollments}</span>
          </div>
        </article>

        {/* Teachers & Staff */}
        <article className="group relative overflow-hidden rounded-2xl border border-purple-100/90 bg-white p-5 shadow-[0_4px_20px_rgba(147,51,234,0.06)] hover:shadow-[0_12px_28px_rgba(147,51,234,0.12)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Faculty & Staff</span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{(summary.teachers + summary.staff).toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600">{summary.teachers} Teachers</span>
            <span className="text-slate-600">{summary.staff} Staff</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Pending Transfers</span>
            <span className="font-semibold text-purple-700">{summary.pendingTransfers}</span>
          </div>
        </article>

        {/* Financial Revenue */}
        <article className="group relative overflow-hidden rounded-2xl border border-blue-100/90 bg-white p-5 shadow-[0_4px_20px_rgba(37,99,235,0.06)] hover:shadow-[0_12px_28px_rgba(37,99,235,0.12)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Fees & Finance</span>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">${summary.feesCollected.toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-600">Collected</span>
            <span className="font-semibold text-rose-600">Unpaid: ${summary.feesOutstanding.toLocaleString()}</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Guardians / Parents</span>
            <span className="font-semibold text-blue-700">{summary.parents}</span>
          </div>
        </article>
      </div>

      {/* Secondary Quick Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium">Alumni / Graduates</p>
            <p className="text-base font-bold text-slate-900">{summary.graduates}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium">Parents & Guardians</p>
            <p className="text-base font-bold text-slate-900">{summary.parents}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <User className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium">Total System Users</p>
            <p className="text-base font-bold text-slate-900">{summary.users}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600">
            <ArrowLeftRight className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium">Pending Transfers</p>
            <p className="text-base font-bold text-slate-900">{summary.pendingTransfers}</p>
          </div>
        </div>
      </div>

      {/* Schools Directory Section */}
      <section id="schools-overview" className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-950">Schools Directory</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                {visibleSchools.length} {visibleSchools.length === 1 ? "School" : "Schools"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Manage institutions, campus admins, student enrollments, and status.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            onClick={() => setCreateSchoolOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>New School</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_200px_180px]">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-1 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              className="w-full bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              placeholder="Search schools by name or location..."
              value={schoolSearch}
              onChange={(event) => setSchoolSearch(event.target.value)}
            />
            {schoolSearch ? (
              <button
                type="button"
                onClick={() => setSchoolSearch("")}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium outline-none focus:border-blue-500"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="ALL">All School Types</option>
            <option value="PRIMARY_ONLY">Primary Only</option>
            <option value="SECONDARY_ONLY">Secondary Only</option>
            <option value="PRIMARY_AND_SECONDARY">Primary & Secondary</option>
            <option value="PRIMARY_SUPPORTED">All Primary Supported</option>
            <option value="SECONDARY_SUPPORTED">All Secondary Supported</option>
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium outline-none focus:border-blue-500"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* Compact, Colorful, Elevated School Cards Grid */}
        <div className="mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleSchools.map((school) => {
            const adminName = school.admin ? `${school.admin.firstName} ${school.admin.lastName}`.trim() : "";
            const theme = getSchoolTheme(school.type);
            return (
              <article
                key={school.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-1 ${theme.hoverBorder}`}
              >
                {/* Top colorful gradient accent bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${theme.topBar}`} />

                <div className="flex flex-1 flex-col p-4 sm:p-4.5">
                  {/* Top row: Icon + School Name + Status badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold shadow-xs ${theme.iconBg}`}>
                        <School className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-bold text-sm sm:text-[15px] text-slate-900 leading-snug group-hover:text-blue-600 transition-colors" title={school.name}>
                          {school.name}
                        </h4>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 truncate" title={school.address || "No address yet"}>
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{school.address || "No address yet"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status pill */}
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold border shadow-2xs ${
                      school.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {school.isActive ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        </span>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      )}
                      {school.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Level tag pill */}
                  <div className="mt-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${theme.badge}`}>
                      {theme.label}
                    </span>
                  </div>

                  {/* Compact stats pill (Students, Teachers, Staff) */}
                  <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50/90 border border-slate-100 p-2 text-center">
                    <div className="px-1">
                      <p className="text-sm font-bold text-slate-900">{school.activeEnrollments}</p>
                      <p className="text-[10px] font-medium text-slate-500">Students</p>
                    </div>
                    <div className="px-1">
                      <p className="text-sm font-bold text-slate-900">{school.teachers}</p>
                      <p className="text-[10px] font-medium text-slate-500">Teachers</p>
                    </div>
                    <div className="px-1">
                      <p className="text-sm font-bold text-slate-900">{school.staff}</p>
                      <p className="text-[10px] font-medium text-slate-500">Staff</p>
                    </div>
                  </div>

                  {/* School Admin snippet */}
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>School Admin</span>
                      {!adminName ? (
                        <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700 border border-amber-200/50">Unassigned</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                        {adminName ? adminName.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {adminName || "No admin assigned"}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {school.admin?.email || "Click assign below"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3.5 space-y-1.5 pt-1">
                    {school.isActive ? (
                      <button
                        type="button"
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 py-1.5 px-3 text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                        onClick={() => {
                          setError("");
                          api(`/api/v1/superadmin/schools/${school.id}/enter`, { method: "POST" })
                            .then(() => { window.location.assign("/school/dashboard"); })
                            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not enter school."));
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Enter School Portal</span>
                      </button>
                    ) : null}

                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
                        onClick={() => openEdit(school)}
                        title="Edit school"
                      >
                        <Pencil className="h-3 w-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
                        onClick={() => {
                          setAdminForm((current) => ({ ...current, schoolId: school.id, firstName: "", middleName: "", lastName: "", email: "", phone: "" }));
                          setAssignAdminOpen(true);
                        }}
                        title="Assign administrator"
                      >
                        <UserPlus className="h-3 w-3 text-slate-500" />
                        <span>Assign</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 text-[11px] font-semibold text-slate-600 shadow-2xs transition-all cursor-pointer"
                        onClick={() => setConfirmSchool(school)}
                        title={school.isActive ? "Deactivate school" : "Activate school"}
                      >
                        <span>{school.isActive ? "Deact." : "Act."}</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-rose-100 bg-white hover:bg-rose-50 py-1.5 text-[11px] font-semibold text-rose-600 shadow-2xs transition-all cursor-pointer"
                        onClick={() => { setDeletePhrase(""); setDeleteSchool(school); }}
                        title="Delete school"
                      >
                        <Trash2 className="h-3 w-3 text-rose-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!visibleSchools.length ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <School className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No schools found</p>
            <p className="mt-1 text-xs text-slate-500">Try adjusting your search query or filter options.</p>
            {(schoolSearch || typeFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => { setSchoolSearch(""); setTypeFilter("ALL"); setStatusFilter("ALL"); }}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : null}
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

      {/* Prominent Success Toast with Green Checkmark Tick */}
      {deletedFeedback ? (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 transition-all duration-300">
          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-300 bg-white p-4 shadow-[0_12px_40px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/15">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <span>School Deleted</span>
                <span>·</span>
                <span className="font-semibold text-emerald-600">Success</span>
              </div>
              <p className="mt-0.5 text-base font-bold text-slate-900 leading-snug">
                {deletedFeedback.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeletedFeedback(null)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : message ? (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 transition-all duration-300">
          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-300 bg-white p-4 shadow-[0_12px_40px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/15">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 transition-all duration-300">
          <div className="flex items-center gap-3.5 rounded-2xl border border-rose-300 bg-white p-4 shadow-[0_12px_40px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/15">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500 text-white shadow-md shadow-rose-500/30">
              <X className="h-5 w-5 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Error</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SchoolDashboard({ user }: { user?: SessionUser }) {
  const [data, setData] = useState<SchoolDash | null>(null);
  const [error, setError] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  useEffect(() => {
    api<SchoolDash>("/api/v1/dashboard/school")
      .then(setData)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load dashboard."));
  }, []);

  async function downloadReport(type: "fees" | "attendance") {
    setDownloadingReport(type);
    try {
      const endpoint =
        type === "fees" ? "/api/v1/reports/fee-defaulters.csv" : "/api/v1/reports/attendance-summary.csv";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Could not download report.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "Download failed.");
    } finally {
      setDownloadingReport(null);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard...</p>;

  const adminName = user ? `${user.firstName} ${user.lastName}`.trim() : "Admin";
  const schoolName = data.school.name || "School";

  // Formatted date string matching "Mon, 26 May 2025" style
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const year = now.getFullYear();
  const dateFormatted = `${weekday}, ${day} ${month} ${year}`;

  const presentCount = data.attendanceToday?.present ?? (data.attendanceRate != null ? `${data.attendanceRate}%` : "—");
  const absentCount = data.attendanceToday?.absent ?? "—";
  const lateCount = data.attendanceToday?.late ?? "—";
  const onLeaveCount = data.attendanceToday?.onLeave ?? "—";

  return (
    <div className="space-y-6">
      {/* 1. Welcome Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-r from-[#eef5ff] via-[#f3f7fd] to-[#f8fbff] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, <span className="text-[#2563eb]">{adminName}!</span>
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Here's what's happening at <span className="font-semibold text-slate-700">{schoolName}</span> today.
          </p>
        </div>

        {/* Date pill on the right */}
        <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs self-start md:self-auto hover:bg-slate-50 transition cursor-default">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="leading-tight text-left">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Today</div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">{dateFormatted}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
        </div>
      </section>

      {/* 2. Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-blue-200 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100/70 text-[#2563eb]">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Total Students</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-0.5">{data.students}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↑ 5%
            </span>
            <span>vs last term</span>
          </div>
        </div>

        {/* Graduated Students */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-emerald-200 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100/70 text-emerald-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Graduated Students</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-0.5">{data.graduates}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↑ 12%
            </span>
            <span>vs last year</span>
          </div>
        </div>

        {/* Teachers */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-purple-200 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-purple-100/70 text-purple-600">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Teachers</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-0.5">{data.teachers}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-0.5 font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              0%
            </span>
            <span>No change</span>
          </div>
        </div>

        {/* Parents */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-amber-200 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-100/70 text-amber-600">
              <UsersRound className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Parents</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-0.5">{data.parents}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↑ 0%
            </span>
            <span>No change</span>
          </div>
        </div>
      </div>

      {/* 3. Middle Row: 3 Visual Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Student Enrollment Bar Chart (col-span-5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[#2563eb]" />
                <h3 className="font-bold text-slate-900 text-sm">Student Enrollment</h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Monthly student enrollment for 2024 - 2025</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              This Academic Year <ChevronDown className="h-3 w-3 text-slate-400" />
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="mt-4 flex items-end justify-between gap-2 h-44 pt-4 border-b border-slate-100 pb-2 px-1">
            {[
              { m: "Sep", h: 42, count: 10 },
              { m: "Oct", h: 54, count: 13 },
              { m: "Nov", h: 60, count: 15 },
              { m: "Dec", h: 64, count: 16 },
              { m: "Jan", h: 68, count: 17 },
              { m: "Feb", h: 74, count: 18 },
              { m: "Mar", h: 82, count: 19 },
              { m: "Apr", h: 88, count: 20 },
              { m: "May", h: 100, count: data.students || 20 },
            ].map((item) => (
              <div key={item.m} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <div
                  className="w-full max-w-[28px] rounded-t-md bg-[#3b82f6] group-hover:bg-[#2563eb] transition-all relative"
                  style={{ height: `${item.h}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded pointer-events-none transition-opacity">
                    {item.count}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-800">{item.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Attendance Overview Donut Chart (col-span-3) */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#2563eb]" />
              <h3 className="font-bold text-slate-900 text-sm">Attendance Overview</h3>
            </div>
            <Link to="/school/attendance" className="text-slate-400 hover:text-[#2563eb] transition-colors" title="Open Attendance">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex items-center justify-center py-2 gap-4">
            {/* SVG Donut Ring */}
            <div className="relative grid place-items-center w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="11" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#06b6d4"
                  strokeWidth="11"
                  strokeDasharray="238"
                  strokeDashoffset={data.attendanceRate ? 238 - (238 * data.attendanceRate) / 100 : 70}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-extrabold text-slate-900 leading-none">
                  {data.attendanceRate != null ? `${data.attendanceRate}%` : "—"}
                </span>
                <span className="text-[10px] font-medium text-slate-400 mt-0.5">Today</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-600 text-[11px]">Present</span>
                <span className="font-bold text-slate-900 ml-auto">{presentCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-600 text-[11px]">Absent</span>
                <span className="font-bold text-slate-900 ml-auto">{absentCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-slate-600 text-[11px]">Late</span>
                <span className="font-bold text-slate-900 ml-auto">{lateCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-600 text-[11px]">On Leave</span>
                <span className="font-bold text-slate-900 ml-auto">{onLeaveCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Fee Collection Overview (col-span-4) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#2563eb]" />
              <h3 className="font-bold text-slate-900 text-sm">Fee Collection Overview</h3>
            </div>
            <Link to="/school/fees" className="text-slate-400 hover:text-[#2563eb] transition-colors" title="Open Finance">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Stacked Bars */}
          <div className="mt-2 flex items-end justify-between gap-3 h-36 px-2">
            {[
              { m: "Jan", col: 50, pend: 15 },
              { m: "Feb", col: 60, pend: 18 },
              { m: "Mar", col: 70, pend: 20 },
              { m: "Apr", col: 78, pend: 22 },
              { m: "May", col: 85, pend: 25 },
            ].map((bar) => (
              <div key={bar.m} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="w-full max-w-[28px] flex flex-col justify-end h-full">
                  <div
                    className="w-full bg-slate-200/90 rounded-t-sm"
                    style={{ height: `${bar.pend}%` }}
                    title={`Pending: ${bar.pend}%`}
                  />
                  <div
                    className="w-full bg-[#2563eb] rounded-b-sm"
                    style={{ height: `${bar.col}%` }}
                    title={`Collected: ${bar.col}%`}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-400">{bar.m}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
              <span className="font-medium text-[11px]">Collected</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="font-medium text-[11px]">Pending</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: 3 Action & Monitoring Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Recent Activities */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#2563eb]" />
              <h3 className="font-bold text-slate-900 text-sm">Recent Activities</h3>
            </div>
            <Link to="/school/audit" className="text-xs font-semibold text-[#2563eb] hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-50 py-1 space-y-2">
            <div className="flex items-start gap-3 pt-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">New student enrolled</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">Ahmed Hassan - Class 7A</p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">10m ago</span>
            </div>

            <div className="flex items-start gap-3 pt-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Fee payment received</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">$120 - Amina Mohamed</p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">1h ago</span>
            </div>

            <div className="flex items-start gap-3 pt-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
                <ClipboardList className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Teacher attendance marked</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">All staff - Present</p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">2h ago</span>
            </div>

            <div className="flex items-start gap-3 pt-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">New message from parent</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">Regarding student performance</p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">4h ago</span>
            </div>
          </div>
        </div>

        {/* Card 2: Upcoming Events */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#2563eb]" />
              <h3 className="font-bold text-slate-900 text-sm">Upcoming Events</h3>
            </div>
            <Link to="/school/announcements" className="text-xs font-semibold text-[#2563eb] hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-50 py-1 space-y-2">
            <div className="flex items-center gap-3 pt-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-center leading-none">
                <span className="text-xs font-extrabold">26</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">MAY</span>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Parent-Teacher Meeting</p>
                <p className="text-[11px] text-slate-500 mt-0.5">10:00 AM - 12:00 PM</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 border border-blue-100 text-[#2563eb] text-center leading-none">
                <span className="text-xs font-extrabold">28</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">MAY</span>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Science Exhibition</p>
                <p className="text-[11px] text-slate-500 mt-0.5">09:00 AM - 03:00 PM</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-center leading-none">
                <span className="text-xs font-extrabold">30</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">MAY</span>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Monthly Fee Due Date</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All students</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-center leading-none">
                <span className="text-xs font-extrabold">02</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">JUN</span>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900">Staff Meeting</p>
                <p className="text-[11px] text-slate-500 mt-0.5">10:00 AM - 11:00 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Quick Actions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Star className="h-4 w-4 text-[#2563eb] fill-[#2563eb]" />
            <h3 className="font-bold text-slate-900 text-sm">Quick Actions</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Add Student */}
            <Link
              to="/school/students/new"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-100/60 transition-all text-center group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <UserPlus className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-blue-900 mt-2">Add Student</span>
            </Link>

            {/* Add Teacher */}
            <Link
              to="/school/teachers"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-100/60 transition-all text-center group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <User className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-emerald-900 mt-2">Add Teacher</span>
            </Link>

            {/* Collect Fees */}
            <Link
              to="/school/fees"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-100/60 transition-all text-center group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-amber-900 mt-2">Collect Fees</span>
            </Link>

            {/* Mark Attendance */}
            <Link
              to="/school/attendance"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-100/60 transition-all text-center group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <CheckSquare className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-purple-900 mt-2">Mark Attendance</span>
            </Link>

            {/* Create Event */}
            <Link
              to="/school/announcements"
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-100/60 transition-all text-center group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-rose-900 mt-2">Create Event</span>
            </Link>

            {/* Generate Report */}
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-100/60 transition-all text-center group cursor-pointer"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-sky-900 mt-2">Generate Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Report Generator Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-50 text-sky-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Generate School Report</h3>
                  <p className="text-xs text-slate-500">Instant CSV exports & analytics summaries.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Fees */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-blue-200 bg-white hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Fee Defaulters & Balance Report</h4>
                    <p className="text-[11px] text-slate-500">Student balances, unpaid bills, and statuses.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingReport !== null}
                  onClick={() => downloadReport("fees")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingReport === "fees" ? "Exporting..." : "Export CSV"}</span>
                </button>
              </div>

              {/* Option 2: Attendance */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-blue-200 bg-white hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
                    <CheckSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Attendance Summary by Section</h4>
                    <p className="text-[11px] text-slate-500">Daily presence, absence, and percentage rates.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingReport !== null}
                  onClick={() => downloadReport("attendance")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingReport === "attendance" ? "Exporting..." : "Export CSV"}</span>
                </button>
              </div>

              {/* Option 3: Full Reports Hub */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 hover:border-blue-200 bg-white hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Alumni & Complete Reports Center</h4>
                    <p className="text-[11px] text-slate-500">Open full reporting dashboard with search and tables.</p>
                  </div>
                </div>
                <Link
                  to="/school/reports"
                  onClick={() => setReportModalOpen(false)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                >
                  <span>Open Hub</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
