import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, ClipboardList, GraduationCap, School, Search } from "lucide-react";
import { api } from "../lib/api";

type Profile = {
  name: string;
  firstName: string;
  lastName: string;
  publicId: string;
  email: string;
  phone: string | null;
  qualification: string | null;
  status: string;
  schools: number;
  classes: number;
  subjects: number;
  pendingMarks: number;
  announcements: number;
};

type SchoolCard = {
  id: string;
  name: string;
  code: string;
  type: string;
  active: boolean;
  classes: Array<{ label: string; year: string; sections: string[] }>;
  subjects: string[];
};

type AssignmentRow = {
  id: string;
  schoolId: string;
  school: string;
  year: string;
  academicYearId: string;
  classLabel: string;
  section: string;
  subject: string;
  status: string;
};

type YearOption = { id: string; name: string; isCurrent: boolean };
type ExamOption = { id: string; name: string; type: string; term: string; termLabel: string; year: string };

type SheetRow = {
  examId: string;
  examSubjectId: string;
  sectionId: string;
  subjectId: string;
  schoolId: string;
  school: string;
  academicYearId: string;
  year: string;
  term: string;
  termLabel: string;
  examName: string;
  examType: string;
  examDate: string | null;
  classLabel: string;
  section: string;
  subject: string;
  students: number;
  maxMarks: number;
  status: string;
};

type MarkRow = {
  enrollmentId: string;
  student: string;
  permanentId: string;
  rollNumber: number;
  marks: number | null;
  isAbsent: boolean;
  comment: string;
  state: string;
  rejectReason: string | null;
  canEdit: boolean;
};

const field = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function statusLabel(status: string) {
  if (status === "READY") return "Ready to Enter";
  if (status === "DRAFT") return "Draft";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "SUBMITTED") return "Submitted";
  if (status === "RETURNED") return "Returned for Correction";
  if (status === "APPROVED") return "Approved";
  if (status === "PUBLISHED") return "Published";
  return status;
}

function statusClass(status: string) {
  if (status === "READY") return "bg-emerald-50 text-emerald-700";
  if (status === "DRAFT" || status === "IN_PROGRESS") return "bg-amber-50 text-amber-700";
  if (status === "SUBMITTED") return "bg-blue-50 text-blue-700";
  if (status === "RETURNED") return "bg-red-50 text-red-700";
  if (status === "APPROVED" || status === "PUBLISHED") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

function day(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function rememberSchool(schoolId: string) {
  sessionStorage.setItem("teacherSchoolId", schoolId);
}

function rememberedSchool() {
  return sessionStorage.getItem("teacherSchoolId") ?? "";
}

function ProfileCard({ profile, showLink = true }: { profile: Profile; showLink?: boolean }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-lg font-semibold text-white">{initials(profile.name)}</span>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{profile.name}</h2>
            <p className="text-sm text-slate-500">{profile.publicId}</p>
          </div>
        </div>
        {showLink ? <Link to="/teacher/profile" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">View my profile</Link> : null}
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Email" value={profile.email} />
        <Fact label="Phone" value={profile.phone || "Not recorded"} />
        <Fact label="Qualification" value={profile.qualification || "Not recorded"} />
        <Fact label="Account" value={profile.status} />
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Count label="Assigned schools" value={profile.schools} />
        <Count label="Assigned classes" value={profile.classes} />
        <Count label="Assigned subjects" value={profile.subjects} />
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <p className="text-xs text-blue-700">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function TeacherDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Profile>("/api/v1/teacher/me")
      .then(setProfile)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load your profile."));
  }, []);

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="text-sm text-slate-500">Loading your dashboard...</p>;

  return (
    <div className="space-y-5">
      <ProfileCard profile={profile} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Count label="Marks still to finish" value={profile.pendingMarks} />
        <Count label="Announcements" value={profile.announcements} />
        <Link to="/teacher/marks" className="rounded-xl bg-blue-600 px-4 py-3 text-white shadow-sm hover:bg-blue-500">
          <p className="text-xs text-blue-100">Next step</p>
          <p className="mt-1 text-lg font-semibold">Enter marks</p>
        </Link>
      </div>
    </div>
  );
}

export function TeacherProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Profile>("/api/v1/teacher/me").then(setProfile).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load your profile."));
  }, []);
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="text-sm text-slate-500">Loading profile...</p>;
  return <ProfileCard profile={profile} showLink={false} />;
}

export function TeacherSchoolsPage() {
  const [schools, setSchools] = useState<SchoolCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<SchoolCard[]>("/api/v1/teacher/schools")
      .then(setSchools)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load schools."))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-slate-500">Loading your schools...</p>;
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!schools.length) return <Empty text="You are not assigned to a school yet." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {schools.map((school) => (
        <article key={school.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><School className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-slate-950">{school.name}</h2>
                <p className="text-sm text-slate-500">{school.code} · {school.type}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${school.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{school.active ? "Active" : "Inactive"}</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            {school.classes.map((item) => (
              <p key={`${item.year}-${item.label}`}>{item.year} · {item.label} · {item.sections.map((section) => `Section ${section}`).join(", ")}</p>
            ))}
            <p className="text-slate-500">Subjects: {school.subjects.join(", ") || "None"}</p>
          </div>
          <Link to={`/teacher/assignments?school=${school.id}`} onClick={() => rememberSchool(school.id)} className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">View school</Link>
        </article>
      ))}
    </div>
  );
}

export function TeacherAssignmentsPage() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [schoolId, setSchoolId] = useState(params.get("school") ?? rememberedSchool());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<AssignmentRow[]>("/api/v1/teacher/assignments")
      .then((data) => {
        setRows(data);
        setSchoolId((current) => current && data.some((row) => row.schoolId === current) ? current : data[0]?.schoolId ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load assignments."))
      .finally(() => setLoading(false));
  }, []);
  const schools = [...new Map(rows.map((row) => [row.schoolId, row.school])).entries()];
  const visible = rows.filter((row) => row.schoolId === schoolId);
  const years = [...new Set(visible.map((row) => row.year))];
  if (loading) return <p className="text-sm text-slate-500">Loading assignments...</p>;
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!rows.length) return <Empty text="You have no class or subject assignments yet." />;
  return (
    <div className="space-y-4">
      <label className="block max-w-sm text-sm text-slate-600">School
        <select className={`${field} mt-1.5 w-full`} value={schoolId} onChange={(event) => { setSchoolId(event.target.value); rememberSchool(event.target.value); }}>
          {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      {years.map((year) => (
        <section key={year} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-950">{year}</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Class / form</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.filter((row) => row.year === year).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.classLabel}</td>
                  <td className="px-4 py-3">{row.section}</td>
                  <td className="px-4 py-3">{row.subject}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export function TeacherExamsPage() {
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [schoolId, setSchoolId] = useState(rememberedSchool());
  const [years, setYears] = useState<YearOption[]>([]);
  const [yearId, setYearId] = useState("");
  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<SchoolCard[]>("/api/v1/teacher/schools").then((rows) => {
      setSchools(rows.map((row) => ({ id: row.id, name: row.name })));
      setSchoolId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load schools."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    rememberSchool(schoolId);
    setYearId("");
    api<YearOption[]>(`/api/v1/teacher/years?schoolId=${schoolId}`)
      .then((rows) => {
        setYears(rows);
        setYearId(rows.find((row) => row.isCurrent)?.id ?? rows[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load academic years."));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !yearId) {
      setSheets([]);
      return;
    }
    api<{ sheets: SheetRow[] }>(`/api/v1/teacher/exams?schoolId=${schoolId}&academicYearId=${yearId}`)
      .then((data) => setSheets(data.sheets))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load exams."));
  }, [schoolId, yearId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="text-sm text-slate-600">School
          <select className={`${field} mt-1.5 w-full`} value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">Academic year
          <select className={`${field} mt-1.5 w-full`} value={yearId} onChange={(event) => setYearId(event.target.value)}>
            {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · current" : ""}</option>)}
            {!years.length ? <option value="">No academic year</option> : null}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-500">These exams were created by the school. You can enter marks only for your own classes and subjects.</p>
      {loading ? <p className="text-sm text-slate-500">Loading exams...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      {!loading && yearId && !sheets.length ? <Empty text="No exam is currently available for this school and academic year." /> : null}
      {sheets.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={`${sheet.examSubjectId}-${sheet.sectionId}`} className="border-t border-slate-100">
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{sheet.termLabel}</p><p className="text-xs text-slate-500">{sheet.examType}</p></td>
                  <td className="px-4 py-3">{sheet.classLabel}</td>
                  <td className="px-4 py-3">{sheet.section}</td>
                  <td className="px-4 py-3">{sheet.subject}</td>
                  <td className="px-4 py-3">{day(sheet.examDate)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(sheet.status)}`}>{statusLabel(sheet.status)}</span></td>
                  <td className="px-4 py-3"><Link className="font-semibold text-blue-700" to={`/teacher/marks?school=${sheet.schoolId}&year=${sheet.academicYearId}&exam=${sheet.examId}&section=${sheet.sectionId}&subject=${sheet.subjectId}&term=${sheet.term}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function TeacherMarksPage() {
  const [params, setParams] = useSearchParams();
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [schoolId, setSchoolId] = useState(params.get("school") ?? rememberedSchool());
  const [years, setYears] = useState<YearOption[]>([]);
  const [yearId, setYearId] = useState(params.get("year") ?? "");
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examId, setExamId] = useState(params.get("exam") ?? "");
  const [sheets, setSheets] = useState<SheetRow[] | null>(null);
  const [open, setOpen] = useState<SheetRow | null>(null);
  const [markRows, setMarkRows] = useState<MarkRow[]>([]);
  const [examSubjectId, setExamSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState(100);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SchoolCard[]>("/api/v1/teacher/schools").then((rows) => {
      const options = rows.map((row) => ({ id: row.id, name: row.name }));
      setSchools(options);
      setSchoolId((current) => current && options.some((row) => row.id === current) ? current : options[0]?.id ?? "");
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load your schools."));
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    rememberSchool(schoolId);
    api<YearOption[]>(`/api/v1/teacher/years?schoolId=${schoolId}`)
      .then((rows) => {
        setYears(rows);
        setYearId((current) => current && rows.some((row) => row.id === current) ? current : rows.find((row) => row.isCurrent)?.id ?? rows[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load academic years."));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !yearId) {
      setExams([]);
      return;
    }
    api<{ exams: ExamOption[] }>(`/api/v1/teacher/exams?schoolId=${schoolId}&academicYearId=${yearId}`)
      .then((data) => {
        setExams(data.exams);
        setExamId((current) => current && data.exams.some((row) => row.id === current) ? current : data.exams[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load exams."));
  }, [schoolId, yearId]);

  useEffect(() => {
    const section = params.get("section");
    if (!section || !schoolId || !yearId || !examId) return;
    let cancelled = false;
    api<SheetRow[]>(`/api/v1/teacher/marksheets?schoolId=${schoolId}&academicYearId=${yearId}&examId=${examId}`)
      .then((rows) => { if (!cancelled) setSheets(rows); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not find marksheets."); });
    return () => { cancelled = true; };
  }, [schoolId, yearId, examId, params]);

  useEffect(() => {
    const section = params.get("section");
    const subject = params.get("subject");
    const term = params.get("term");
    const exam = params.get("exam");
    if (!section || !subject || !term || !exam || !sheets) return;
    const match = sheets.find((sheet) => sheet.sectionId === section && sheet.subjectId === subject && sheet.term === term && sheet.examId === exam);
    if (match) void openSheet(match);
    // The linked sheet opens once. openSheet then removes the section from the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, params]);

  async function findSheets() {
    if (!schoolId || !yearId || !examId) return;
    setError("");
    setMessage("");
    setOpen(null);
    setBusy(true);
    try {
      const rows = await api<SheetRow[]>(`/api/v1/teacher/marksheets?schoolId=${schoolId}&academicYearId=${yearId}&examId=${examId}`);
      setSheets(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not find marksheets.");
    } finally {
      setBusy(false);
    }
  }

  async function openSheet(sheet: SheetRow) {
    setError("");
    setBusy(true);
    try {
      const data = await api<{ examSubjectId: string; maxMarks: number; rows: MarkRow[] }>(`/api/v1/my-marks?sectionId=${sheet.sectionId}&subjectId=${sheet.subjectId}&term=${sheet.term}`);
      setOpen(sheet);
      setExamSubjectId(data.examSubjectId);
      setMaxMarks(data.maxMarks);
      setMarkRows(data.rows);
      setParams({ school: sheet.schoolId, year: sheet.academicYearId, exam: sheet.examId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this marksheet.");
    } finally {
      setBusy(false);
    }
  }

  function update(enrollmentId: string, patch: Partial<MarkRow>) {
    setMarkRows((current) => current.map((row) => row.enrollmentId === enrollmentId ? { ...row, ...patch } : row));
  }

  function invalidRow(row: MarkRow) {
    if (!row.canEdit) return "";
    if (row.isAbsent) return row.comment.trim() ? "" : "An absent student needs a remark.";
    if (row.marks == null || Number.isNaN(row.marks)) return "Enter a mark.";
    if (!Number.isInteger(row.marks) || row.marks < 0) return "Marks cannot be negative.";
    if (row.marks > maxMarks) return `Marks cannot be higher than ${maxMarks}.`;
    return "";
  }

  async function save(submit: boolean) {
    if (!open) return;
    const problem = markRows.map(invalidRow).find(Boolean);
    if (submit && problem) {
      setError(problem);
      setConfirming(false);
      return;
    }
    const draftProblem = markRows.map((row) => {
      if (!row.canEdit || row.marks == null || row.isAbsent) return "";
      if (!Number.isInteger(row.marks) || row.marks < 0 || row.marks > maxMarks) return `Marks must be from 0 to ${maxMarks}.`;
      return "";
    }).find(Boolean);
    if (draftProblem) {
      setError(draftProblem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/my-marks?sectionId=${open.sectionId}`, {
        method: "PUT",
        body: JSON.stringify({
          examSubjectId,
          rows: markRows.filter((row) => row.canEdit).map((row) => ({
            enrollmentId: row.enrollmentId,
            marks: row.isAbsent ? null : row.marks,
            isAbsent: row.isAbsent,
            comment: row.comment,
          })),
        }),
      });
      if (submit) {
        await api(`/api/v1/my-marks/submit?sectionId=${open.sectionId}`, {
          method: "POST",
          body: JSON.stringify({ examSubjectId }),
        });
        setMessage("Marks submitted. The school admin can now review them. They are not published yet.");
        setConfirming(false);
        setOpen(null);
        await findSheets();
        return;
      }
      setMessage("Draft saved. The marks have not been submitted.");
      await openSheet(open);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save marks.");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    const reason = markRows.find((row) => row.rejectReason)?.rejectReason;
    return (
      <div className="space-y-4">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600" onClick={() => { setOpen(null); setConfirming(false); setError(""); }}>
          <ArrowLeft className="h-4 w-4" /> Back to marksheets
        </button>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{open.school}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{open.subject}</h2>
          <p className="mt-1 text-sm text-slate-500">{open.year} · {open.termLabel} · {open.classLabel} · Section {open.section} · Maximum {maxMarks}</p>
          {reason ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Returned for correction: {reason}</p> : null}
        </section>
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Marks</th>
                <th className="px-4 py-3">Maximum</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {markRows.map((row) => (
                <tr key={row.enrollmentId} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{row.permanentId}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.student}</td>
                  <td className="px-4 py-3">{row.rollNumber}</td>
                  <td className="px-4 py-3">
                    <input className={`${field} w-24`} type="number" min={0} max={maxMarks} disabled={!row.canEdit || row.isAbsent} value={row.marks ?? ""} onChange={(event) => update(row.enrollmentId, { marks: event.target.value === "" ? null : Number(event.target.value) })} />
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <input type="checkbox" disabled={!row.canEdit} checked={row.isAbsent} onChange={(event) => update(row.enrollmentId, { isAbsent: event.target.checked, marks: null })} /> Absent
                    </label>
                  </td>
                  <td className="px-4 py-3">{maxMarks}</td>
                  <td className="px-4 py-3"><input className={`${field} w-full`} disabled={!row.canEdit} value={row.comment} onChange={(event) => update(row.enrollmentId, { comment: event.target.value })} /></td>
                </tr>
              ))}
              {!markRows.length ? <tr><td className="px-4 py-8 text-slate-500" colSpan={6}>No students are enrolled in this section.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {confirming ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Send these marks to the school admin?</p>
            <p className="mt-1">They  addmin will check your puplished marks.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded-xl border border-blue-200 bg-white px-4 py-2 font-semibold" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void save(true)}>Confirm submission</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => void save(false)}>Save draft</button>
            <button type="button" disabled={busy || !markRows.some((row) => row.canEdit)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => setConfirming(true)}>Submit marks</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Calendar className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold text-slate-950">Select exam to enter marks</h2>
            <p className="mt-1 text-sm text-slate-500">Choose your school, academic year, and exam. Only exams for your assigned classes and subjects are shown.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <Step label="1" title="School">
            <select className={`${field} w-full`} value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setSheets(null); setExamId(""); }}>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </Step>
          <Step label="2" title="Academic year">
            <select className={`${field} w-full`} value={yearId} onChange={(event) => { setYearId(event.target.value); setSheets(null); setExamId(""); }}>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              {!years.length ? <option value="">No academic year</option> : null}
            </select>
          </Step>
          <Step label="3" title="Exam">
            <select className={`${field} w-full`} value={examId} onChange={(event) => { setExamId(event.target.value); setSheets(null); }}>
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.termLabel}</option>)}
              {!exams.length ? <option value="">No exam</option> : null}
            </select>
          </Step>
          <button type="button" disabled={!examId || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" onClick={() => void findSheets()}>
            <Search className="h-4 w-4" /> Find marksheets
          </button>
        </div>
      </section>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {sheets && !sheets.length ? <Empty text="No marksheet is available for this school, year, and exam." /> : null}
      {sheets && sheets.length ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <ClipboardList className="h-5 w-5 text-blue-700" />
            <div>
              <h2 className="font-semibold text-slate-950">Available marksheets</h2>
              <p className="text-sm text-slate-500">You can enter marks only for the subjects assigned to you.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Exam</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => (
                  <tr key={`${sheet.examSubjectId}-${sheet.sectionId}`} className="border-t border-slate-100">
                    <td className="px-4 py-3">{sheet.year}</td>
                    <td className="px-4 py-3">{sheet.termLabel}</td>
                    <td className="px-4 py-3">{sheet.classLabel}</td>
                    <td className="px-4 py-3">{sheet.section}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{sheet.subject}</td>
                    <td className="px-4 py-3">{sheet.students}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(sheet.status)}`}>{statusLabel(sheet.status)}</span></td>
                    <td className="px-4 py-3"><button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500" onClick={() => void openSheet(sheet)}>Open marksheet</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Step({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <label className="text-sm text-slate-600">
      <span className="mb-1.5 flex items-center gap-2 font-medium text-slate-800"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs text-white">{label}</span>{title}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  );
}
