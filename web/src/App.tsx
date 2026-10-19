import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, homeByRole, type SessionUser } from "./lib/api";
import { AcademicYearPage, AcademicYearsPage, ClassGroupPage, SectionPage, SubjectsPage } from "./pages/AcademicPages";
import { AttendancePage } from "./pages/AttendancePage";
import { SchoolAttendanceDashboard } from "./pages/SchoolAttendanceDashboard";
import { SchoolSettingsPage } from "./pages/SchoolSettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { PortalLoginPage } from "./pages/PortalLoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";
import { SearchPage } from "./pages/SearchPage";
import {
  AccountantDashboard,
  RoleHome,
  SchoolDashboard,
  Shell,
  SuperAdminHome,
} from "./pages/Shell";
import { NewStudentPage, StudentProfilePage, StudentsPage } from "./pages/StudentPages";
import { AlumniSectionTransferPage } from "./pages/AlumniSectionTransferPage";
import { AlumniPage, AlumniProfilePage, PromotionHistoryPage, PromotionPage } from "./pages/PromotionPages";
import { FeesPage } from "./pages/FeesPage";
import { ParentChildPage, ParentDashboard, ParentFeesPage, SchoolParentProfilePage, SchoolParentsPage } from "./pages/ParentPages";
import { TransfersPage } from "./pages/TransferPages";
import { ExamsPage, StudentResultsPage } from "./pages/ResultsPages";
import { TeacherAssignmentsPage, TeacherDashboard, TeacherExamsPage, TeacherMarksPage, TeacherProfilePage as MyTeacherProfile, TeacherSchoolsPage } from "./pages/TeacherPortalPages";
import { ResultsBoardPage } from "./pages/MarksPages";
import { AnnouncementsInboxPage, SchoolAnnouncementsPage } from "./pages/AnnouncementPages";
import { StaffPage, StaffProfilePage } from "./pages/StaffPage";
import { SetPasswordPage, TeacherProfilePage, TeachersPage } from "./pages/TeacherPages";

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<SessionUser>("/api/v1/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onSuccess={setUser} />} />
      <Route path="/super-admin/login" element={<PortalLoginPage portal="super" onSuccess={setUser} />} />
      <Route path="/parent/login" element={<PortalLoginPage portal="parent" onSuccess={setUser} />} />
      <Route path="/student/login" element={<PortalLoginPage portal="student" onSuccess={setUser} />} />
      <Route path="/teacher/login" element={<PortalLoginPage portal="teacher" onSuccess={setUser} />} />
      <Route path="/school/login" element={<PortalLoginPage portal="school" onSuccess={setUser} />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/set-password/:token" element={<SetPasswordPage />} />
      <Route path="/superadmin/dashboard" element={<Protected user={user} role="SUPER_ADMIN" title="Super Admin dashboard"><SuperAdminHome /></Protected>} />
      <Route path="/school/dashboard" element={<Protected user={user} role="SCHOOL_ADMIN" title="School dashboard"><SchoolDashboard /></Protected>} />
      <Route path="/school/reports" element={<Protected user={user} role="SCHOOL_ADMIN" title="Reports"><ReportsPage /></Protected>} />
      <Route path="/school/search" element={<Protected user={user} role="SCHOOL_ADMIN" title="Search"><SearchPage /></Protected>} />
      <Route path="/school/audit" element={<Protected user={user} role="SCHOOL_ADMIN" title="Audit"><AuditPage /></Protected>} />
      <Route path="/school/academic-years" element={<Protected user={user} role="SCHOOL_ADMIN" title="Academic years"><AcademicYearsPage /></Protected>} />
      <Route path="/school/academic-years/:academicYearId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Classes"><AcademicYearPage /></Protected>} />
      <Route path="/school/classes/:classGroupId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Sections"><ClassGroupPage /></Protected>} />
      <Route path="/school/sections/:sectionId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Section students"><SectionPage /></Protected>} />
      <Route path="/school/subjects" element={<Protected user={user} role="SCHOOL_ADMIN" title="Subjects"><SubjectsPage /></Protected>} />
      <Route path="/school/students" element={<Protected user={user} role="SCHOOL_ADMIN" title="Students"><StudentsPage /></Protected>} />
      <Route path="/school/students/new" element={<Protected user={user} role="SCHOOL_ADMIN" title="Students"><NewStudentPage /></Protected>} />
      <Route path="/school/students/:studentId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Student profile"><StudentProfilePage /></Protected>} />
      <Route path="/school/parents" element={<Protected user={user} role="SCHOOL_ADMIN" title="Parents"><SchoolParentsPage /></Protected>} />
      <Route path="/school/parents/:parentId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Parent profile"><SchoolParentProfilePage /></Protected>} />
      <Route path="/school/teachers" element={<Protected user={user} role="SCHOOL_ADMIN" title="Teachers"><TeachersPage /></Protected>} />
      <Route path="/school/teachers/:teacherId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Teacher profile"><TeacherProfilePage /></Protected>} />
      <Route path="/school/staff" element={<Protected user={user} role="SCHOOL_ADMIN" title="Staff"><StaffPage /></Protected>} />
      <Route path="/school/staff/:staffId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Staff profile"><StaffProfilePage /></Protected>} />
      <Route path="/school/exams" element={<Protected user={user} role="SCHOOL_ADMIN" title="Exams"><ExamsPage /></Protected>} />
      <Route path="/school/marks" element={<PortalIndex user={user} role="SCHOOL_ADMIN" to="/school/results" />} />
      <Route path="/school/results" element={<Protected user={user} role="SCHOOL_ADMIN" title="Results"><ResultsBoardPage /></Protected>} />
      <Route path="/school/promotion" element={<Protected user={user} role="SCHOOL_ADMIN" title="Promotion"><PromotionPage /></Protected>} />
      <Route path="/school/promotion/history" element={<Protected user={user} role="SCHOOL_ADMIN" title="Promotion history"><PromotionHistoryPage /></Protected>} />
      <Route path="/school/alumni" element={<Protected user={user} role="SCHOOL_ADMIN" title="Alumni"><AlumniPage /></Protected>} />
      <Route path="/school/alumni/transfer-section" element={<Protected user={user} role="SCHOOL_ADMIN" title="Transfer section"><AlumniSectionTransferPage /></Protected>} />
      <Route path="/school/alumni/:studentId" element={<Protected user={user} role="SCHOOL_ADMIN" title="Student profile"><AlumniProfilePage /></Protected>} />
      <Route path="/school/transfers" element={<Protected user={user} role="SCHOOL_ADMIN" title="Transfers"><TransfersPage /></Protected>} />
      <Route path="/teacher/dashboard" element={<Protected user={user} role="TEACHER" title="Dashboard"><TeacherDashboard /></Protected>} />
      <Route path="/teacher/profile" element={<Protected user={user} role="TEACHER" title="My Profile"><MyTeacherProfile /></Protected>} />
      <Route path="/teacher/schools" element={<Protected user={user} role="TEACHER" title="My Schools"><TeacherSchoolsPage /></Protected>} />
      <Route path="/teacher/assignments" element={<Protected user={user} role="TEACHER" title="My Assignments"><TeacherAssignmentsPage /></Protected>} />
      <Route path="/teacher/exams" element={<Protected user={user} role="TEACHER" title="Exams & Results"><TeacherExamsPage /></Protected>} />
      <Route path="/teacher/marks" element={<Protected user={user} role="TEACHER" title="Marks Entry"><TeacherMarksPage /></Protected>} />
      <Route path="/teacher/attendance" element={<Protected user={user} role="TEACHER" title="Attendance"><AttendancePage /></Protected>} />
      <Route path="/school/attendance" element={<Protected user={user} role="SCHOOL_ADMIN" title="Attendance"><SchoolAttendanceDashboard /></Protected>} />
      <Route path="/accountant/dashboard" element={<Protected user={user} role="ACCOUNTANT" title="Accountant dashboard"><AccountantDashboard /></Protected>} />
      <Route path="/accountant/fees" element={<Protected user={user} role="ACCOUNTANT" title="Fees"><FeesPage /></Protected>} />
      <Route path="/staff/dashboard" element={<Protected user={user} role="STAFF" title="Staff dashboard">{user ? <RoleHome user={user} /> : null}</Protected>} />
      <Route path="/parent/dashboard" element={<Protected user={user} role="PARENT" title="My children"><ParentDashboard /></Protected>} />
      <Route path="/parent/fees" element={<Protected user={user} role="PARENT" title="Fees"><ParentFeesPage /></Protected>} />
      <Route path="/parent/children/:studentId" element={<Protected user={user} role="PARENT" title="Child profile"><ParentChildPage /></Protected>} />
      <Route path="/school/fees" element={<Protected user={user} role="SCHOOL_ADMIN" title="Fees"><FeesPage /></Protected>} />
      <Route path="/school/settings" element={<Protected user={user} role="SCHOOL_ADMIN" title="Settings"><SchoolSettingsPage /></Protected>} />
      <Route path="/school/announcements" element={<Protected user={user} role="SCHOOL_ADMIN" title="Announcements"><SchoolAnnouncementsPage /></Protected>} />
      <Route path="/teacher/announcements" element={<Protected user={user} role="TEACHER" title="Announcements"><AnnouncementsInboxPage /></Protected>} />
      <Route path="/parent/announcements" element={<Protected user={user} role="PARENT" title="Announcements"><AnnouncementsInboxPage /></Protected>} />
      <Route path="/accountant/announcements" element={<Protected user={user} role="ACCOUNTANT" title="Announcements"><AnnouncementsInboxPage /></Protected>} />
      <Route path="/staff/announcements" element={<Protected user={user} role="STAFF" title="Announcements"><AnnouncementsInboxPage /></Protected>} />
      <Route path="/student/dashboard" element={<Protected user={user} role="STUDENT" title="Dashboard"><StudentResultsPage /></Protected>} />
      <Route path="/student/announcements" element={<Protected user={user} role="STUDENT" title="Announcements"><AnnouncementsInboxPage /></Protected>} />
      <Route path="/superadmin" element={<PortalIndex user={user} role="SUPER_ADMIN" to="/superadmin/dashboard" />} />
      <Route path="/school" element={<PortalIndex user={user} role="SCHOOL_ADMIN" to="/school/dashboard" />} />
      <Route path="/teacher" element={<PortalIndex user={user} role="TEACHER" to="/teacher/dashboard" />} />
      <Route path="/parent" element={<PortalIndex user={user} role="PARENT" to="/parent/dashboard" />} />
      <Route path="/student" element={<PortalIndex user={user} role="STUDENT" to="/student/dashboard" />} />
      <Route path="/staff" element={<PortalIndex user={user} role="STAFF" to="/staff/dashboard" />} />
      <Route path="/accountant" element={<PortalIndex user={user} role="ACCOUNTANT" to="/accountant/dashboard" />} />
      <Route path="/superadmin/*" element={<Protected user={user} role="SUPER_ADMIN" title="Not found"><MissingPage /></Protected>} />
      <Route path="/school/*" element={<Protected user={user} role="SCHOOL_ADMIN" title="Not found"><MissingPage /></Protected>} />
      <Route path="/teacher/*" element={<Protected user={user} role="TEACHER" title="Not found"><MissingPage /></Protected>} />
      <Route path="/parent/*" element={<Protected user={user} role="PARENT" title="Not found"><MissingPage /></Protected>} />
      <Route path="/student/*" element={<Protected user={user} role="STUDENT" title="Not found"><MissingPage /></Protected>} />
      <Route path="/staff/*" element={<Protected user={user} role="STAFF" title="Not found"><MissingPage /></Protected>} />
      <Route path="/accountant/*" element={<Protected user={user} role="ACCOUNTANT" title="Not found"><MissingPage /></Protected>} />
      <Route path="*" element={<Start user={user} />} />
    </Routes>
  );
}

function Start({ user }: { user: SessionUser | null }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeByRole[user.role] ?? "/login"} replace />;
}

const portalName: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  STAFF: "Staff",
  ACCOUNTANT: "Accountant",
};

function AccessDenied({ user }: { user: SessionUser }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">You don't have access to this portal</h1>
        <p className="mt-2 text-sm text-slate-500">This page belongs to a different role. Your account uses the {portalName[user.role] ?? user.role} portal.</p>
        <Link to={homeByRole[user.role] ?? "/login"} className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-medium text-white">Go to your portal</Link>
      </section>
    </main>
  );
}

function MissingPage() {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">This page is not part of your portal.</p>;
}

function PortalIndex({ user, role, to }: { user: SessionUser | null; role: string; to: string }) {
  if (!user) return <Navigate to={role === "SUPER_ADMIN" ? "/super-admin/login" : "/login"} replace />;
  if (user.role !== role) return <AccessDenied user={user} />;
  return <Navigate to={to} replace />;
}

function Protected({
  user,
  role,
  title,
  children,
}: {
  user: SessionUser | null;
  role: string;
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  if (!user) return <Navigate to={role === "SUPER_ADMIN" ? "/super-admin/login" : "/login"} replace />;
  if (user.role !== role) return <AccessDenied user={user} />;
  return (
    <Shell
      user={user}
      title={title}
      onLogout={async () => {
        await api("/api/v1/auth/logout", { method: "POST" });
        navigate(user.role === "SUPER_ADMIN" ? "/super-admin/login" : "/login");
      }}
      onExitSchool={
        user.actingFromSuperAdmin
          ? async () => {
              await api("/api/v1/superadmin/exit-school", { method: "POST" });
              window.location.assign("/superadmin/dashboard");
            }
          : undefined
      }
    >
      {children}
    </Shell>
  );
}
