import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, GraduationCap, Mail, Pencil, Phone, Plus, Trash2, UserCheck, UserRound, UsersRound } from "lucide-react";
import { api } from "../lib/api";
import { PasswordLinkDialog, passwordLinkUrl } from "../components/PasswordLinkDialog";
import { Avatar, DataTable, FilterBar, avatarTone, filterInputClass, initials } from "../components/PeopleList";

type Teacher = {
  id: string;
  publicId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  qualification: string | null;
  status: string;
  isActive: boolean;
  assignmentCount: number;
  assignments: Array<{ id: string; year: string; level: string; section: string; subject: string }>;
};

type Placement = {
  id: string;
  name: string;
  isCurrent: boolean;
  classes: Array<{
    id: string;
    label: string;
    band: "Primary" | "Secondary";
    sections: Array<{
      id: string;
      name: string;
      studentCount: number;
      assignedSubjectIds: string[];
      subjects: Array<{ id: string; name: string; code: string }>;
    }>;
    subjects: Array<{ id: string; name: string; code: string }>;
  }>;
};

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", qualification: "" });
  const [invitePath, setInvitePath] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [assignOnCreate, setAssignOnCreate] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignFilter, setAssignFilter] = useState("ALL");

  async function load() {
    const [teacherRows, years] = await Promise.all([
      api<Teacher[]>("/api/v1/teachers"),
      api<Placement[]>("/api/v1/teacher-placement"),
    ]);
    setTeachers(teacherRows);
    setPlacement(years);
    const year = years[0];
    setYearId((current) => current || year?.id || "");
    setClassId((current) => current || year?.classes[0]?.id || "");
    setSectionId((current) => current || year?.classes[0]?.sections[0]?.id || "");
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load teachers."));
  }, []);

  const year = placement.find((item) => item.id === yearId);
  const classGroup = year?.classes.find((item) => item.id === classId);
  const section = classGroup?.sections.find((item) => item.id === sectionId);
  const availableSubjects = (section?.subjects ?? []).filter(
    (subject) => !section?.assignedSubjectIds.includes(subject.id),
  );
  const visibleSubjects = availableSubjects.filter((subject) => {
    const query = subjectQuery.trim().toLowerCase();
    return !query || `${subject.name} ${subject.code}`.toLowerCase().includes(query);
  });
  const filtered = useMemo(() => teachers.filter((teacher) => {
    const hay = `${teacher.name} ${teacher.publicId} ${teacher.email} ${teacher.phone}`.toLowerCase();
    if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
    if (statusFilter === "ACTIVE" && (!teacher.isActive || teacher.status !== "ACTIVE")) return false;
    if (statusFilter === "INVITED" && teacher.status !== "INVITED") return false;
    if (statusFilter === "INACTIVE" && teacher.isActive) return false;
    if (assignFilter === "ASSIGNED" && teacher.assignmentCount === 0) return false;
    if (assignFilter === "UNASSIGNED" && teacher.assignmentCount > 0) return false;
    return true;
  }), [teachers, q, statusFilter, assignFilter]);

  async function createTeacher(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (assignOnCreate && (!sectionId || selectedSubjectIds.length === 0)) {
      setError("Choose a section and at least one available subject, or turn off Assign now.");
      return;
    }
    try {
      const created = await api<{ setPasswordPath: string }>("/api/v1/teachers", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          assignment: assignOnCreate && sectionId && selectedSubjectIds.length
            ? { sectionId, subjectIds: selectedSubjectIds }
            : undefined,
        }),
      });
      setInviteEmail(form.email);
      setInvitePath(passwordLinkUrl(created.setPasswordPath));
      setForm({ firstName: "", lastName: "", email: "", phone: "", qualification: "" });
      setSelectedSubjectIds([]);
      setAssignOnCreate(false);
      await load();
      setIsCreating(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the teacher.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{isCreating ? "Add New Teacher" : "Teachers Dashboard"}</h1>
          <p className="mt-1 text-sm text-slate-500">{isCreating ? "Enter teacher information and optionally assign a section and subjects." : "View and manage your school's teaching team."}</p>
        </div>
        {isCreating ? (
          <button type="button" onClick={() => { setIsCreating(false); setError(""); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to Teachers
          </button>
        ) : (
          <button type="button" onClick={() => { setIsCreating(true); setError(""); setInvitePath(""); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Create New Teacher
          </button>
        )}
      </div>

      <form onSubmit={createTeacher} className={isCreating ? "space-y-4" : "hidden"}>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><UserRound className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-950">Teacher Information</h2>
              <p className="text-sm text-slate-500">Personal and contact details.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-medium text-slate-700">First name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5 outline-none focus:border-blue-500" placeholder="Enter first name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700">Last name *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5 outline-none focus:border-blue-500" placeholder="Enter last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700">Email *
              <span className="relative mt-1.5 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] py-2.5 pl-9 pr-3 outline-none focus:border-blue-500" placeholder="teacher@example.com" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></span>
            </label>
            <label className="text-sm font-medium text-slate-700">Phone *
              <span className="relative mt-1.5 block"><Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] py-2.5 pl-9 pr-3 outline-none focus:border-blue-500" placeholder="Enter phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></span>
            </label>
            <label className="text-sm font-medium text-slate-700">Qualification *
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5 outline-none focus:border-blue-500" placeholder="e.g. B.Ed, M.Sc" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} required />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><GraduationCap className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-slate-950">Class & Subject Assignment</h2>
                <p className="text-sm text-slate-500">Optional — you can assign the teacher later.</p>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-[#2563eb]" checked={assignOnCreate} onChange={(event) => {
                setAssignOnCreate(event.target.checked);
                if (!event.target.checked) setSelectedSubjectIds([]);
              }} />
              Assign now
            </label>
          </div>

          {assignOnCreate ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Academic year
                  <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5" value={yearId} onChange={(event) => {
                    const next = placement.find((item) => item.id === event.target.value);
                    setYearId(event.target.value);
                    setClassId(next?.classes[0]?.id ?? "");
                    setSectionId(next?.classes[0]?.sections[0]?.id ?? "");
                    setSelectedSubjectIds([]);
                  }}>
                    {placement.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " · Current" : ""}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Class / Form
                  <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5" value={classId} onChange={(event) => {
                    const next = year?.classes.find((item) => item.id === event.target.value);
                    setClassId(event.target.value);
                    setSectionId(next?.sections[0]?.id ?? "");
                    setSelectedSubjectIds([]);
                  }}>
                    {year?.classes.map((item) => <option key={item.id} value={item.id}>{item.band} · {item.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Section
                  <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2.5" value={sectionId} onChange={(event) => {
                    setSectionId(event.target.value);
                    setSelectedSubjectIds([]);
                  }}>
                    {classGroup?.sections.map((item) => <option key={item.id} value={item.id}>Section {item.name} · {item.studentCount} students</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Available Subjects</h3>
                    <p className="text-sm text-slate-500">Only admin-created subjects without a teacher in this section are shown.</p>
                  </div>
                  <input className="rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-sm" placeholder="Search subjects..." value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} />
                </div>
                {visibleSubjects.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {visibleSubjects.map((subject) => {
                      const selected = selectedSubjectIds.includes(subject.id);
                      return (
                        <button key={subject.id} type="button" onClick={() => setSelectedSubjectIds((current) => selected ? current.filter((id) => id !== subject.id) : [...current, subject.id])} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                          <span className={`grid h-5 w-5 place-items-center rounded border ${selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-slate-300"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
                          <BookOpen className="h-5 w-5 text-[#2563eb]" />
                          <span><span className="block text-sm font-semibold text-slate-900">{subject.name}</span><span className="text-xs text-slate-500">Code: {subject.code}</span></span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">No unassigned subjects are available for this section.</p>
                )}
              </div>
            </>
          ) : null}
        </section>

        <div className="flex justify-end">
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Create Teacher{assignOnCreate && selectedSubjectIds.length ? " & Assign Subjects" : ""}
          </button>
        </div>
      </form>
      {invitePath ? <PasswordLinkDialog email={inviteEmail} url={invitePath} onClose={() => setInvitePath("")} /> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className={isCreating ? "hidden" : "space-y-6"}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TeacherStat icon={<UsersRound className="h-5 w-5" />} label="Total Teachers" value={teachers.length} tone="blue" />
          <TeacherStat icon={<UserCheck className="h-5 w-5" />} label="Active Teachers" value={teachers.filter((teacher) => teacher.isActive).length} tone="green" />
          <TeacherStat icon={<BookOpen className="h-5 w-5" />} label="Assigned" value={teachers.filter((teacher) => teacher.assignmentCount > 0).length} tone="violet" />
          <TeacherStat icon={<UserRound className="h-5 w-5" />} label="Unassigned" value={teachers.filter((teacher) => teacher.assignmentCount === 0).length} tone="amber" />
        </div>

        <FilterBar>
        <input className={filterInputClass()} placeholder="Search name, ID, email..." value={q} onChange={(event) => setQ(event.target.value)} />
        <select className={filterInputClass()} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select className={filterInputClass()} value={assignFilter} onChange={(event) => setAssignFilter(event.target.value)}>
          <option value="ALL">All assignments</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="UNASSIGNED">Unassigned</option>
        </select>
        <div className="flex items-center text-sm text-slate-500">{filtered.length} teachers</div>
        </FilterBar>

        <DataTable
          headers={["Profile", "ID", "Name", "Contact", "Assignments", "Status", ""]}
          empty={filtered.length === 0 ? "No teachers match these filters." : undefined}
        >
        {filtered.map((teacher) => (
          <Fragment key={teacher.id}>
            <tr className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3">
                <Avatar name={teacher.name} seed={teacher.publicId} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{teacher.publicId}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{teacher.name}</div>
                <div className="text-xs text-slate-400">{teacher.qualification || "Qualification not added"}</div>
              </td>
              <td className="px-4 py-3">
                <div>{teacher.phone}</div>
                <div className="text-xs text-slate-400">{teacher.email}</div>
              </td>
              <td className="px-4 py-3 text-slate-600">{teacher.assignmentCount}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${teacher.isActive && teacher.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {teacher.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100"
                  to={`/school/teachers/${teacher.id}`}
                >
                  View
                </Link>
              </td>
            </tr>
          </Fragment>
        ))}
        </DataTable>
      </div>
    </div>
  );
}

type TeacherProfile = {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  qualification: string | null;
  status: string;
  hasLogin: boolean;
  isActive: boolean;
  schools: Array<{ id: string; name: string }>;
  createdAt: string;
  nationalId: string | null;
  address: string | null;
  dateOfBirth: string | null;
  assignments: Array<{
    id: string;
    sectionId: string;
    classGroupId: string;
    academicYearId: string;
    year: string;
    isCurrentYear: boolean;
    level: string;
    section: string;
    subject: string;
    school?: string;
    status: string;
    term1: "PUBLISHED" | "NOT_PUBLISHED";
    term2: "PUBLISHED" | "NOT_PUBLISHED";
  }>;
};

const subjectDot = ["bg-amber-400", "bg-teal-500", "bg-rose-500", "bg-blue-500", "bg-violet-500", "bg-orange-400"];

function factDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US");
}

export function TeacherProfilePage() {
  const { teacherId } = useParams();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", qualification: "", dateOfBirth: "", address: "", nationalId: "" });
  const [pickedSubjects, setPickedSubjects] = useState<string[]>([]);
  const [openClass, setOpenClass] = useState("");
  const [yearView, setYearView] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState("");
  const [passwordLink, setPasswordLink] = useState("");

  async function loadProfile() {
    if (!teacherId) return;
    const [data, years] = await Promise.all([
      api<TeacherProfile>(`/api/v1/teachers/${teacherId}`),
      api<Placement[]>("/api/v1/teacher-placement"),
    ]);
    setProfile(data);
    setPlacement(years);
    const year = years.find((item) => item.isCurrent) ?? years[0];
    setYearId((current) => current || year?.id || "");
    setClassId((current) => current || year?.classes[0]?.id || "");
    setEditForm({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      qualification: data.qualification ?? "",
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
      address: data.address ?? "",
      nationalId: data.nationalId ?? "",
    });
    const currentYear = data.assignments.find((item) => item.isCurrentYear)?.academicYearId ?? data.assignments[0]?.academicYearId ?? "";
    setYearView((current) => current || currentYear);
  }

  useEffect(() => {
    loadProfile().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load teacher profile."));
  }, [teacherId]);

  const assignmentsByYear = useMemo(() => {
    const groups = new Map<string, { id: string; year: string; isCurrent: boolean; rows: TeacherProfile["assignments"] }>();
    for (const assignment of profile?.assignments ?? []) {
      const group = groups.get(assignment.academicYearId) ?? {
        id: assignment.academicYearId,
        year: assignment.year,
        isCurrent: assignment.isCurrentYear,
        rows: [],
      };
      group.rows.push(assignment);
      groups.set(assignment.academicYearId, group);
    }
    return [...groups.values()].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.year.localeCompare(a.year));
  }, [profile]);

  const assignYear = placement.find((item) => item.id === yearId);
  const assignClass = assignYear?.classes.find((item) => item.id === classId);
  const assignSection = assignClass?.sections.find((item) => item.id === sectionId);
  const openSubjects = (assignSection?.subjects ?? []).filter((subject) => !assignSection?.assignedSubjectIds.includes(subject.id));

  async function assignFromProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!teacherId || !sectionId || !pickedSubjects.length) return;
    setAssigning(true);
    setError("");
    setNotice("");
    try {
      await api("/api/v1/teacher-assignments", {
        method: "POST",
        body: JSON.stringify({ teacherId, sectionId, subjectIds: pickedSubjects }),
      });
      setNotice("Section and subjects assigned.");
      setPickedSubjects([]);
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign the section.");
    } finally {
      setAssigning(false);
    }
  }

  async function saveTeacher(event: React.FormEvent) {
    event.preventDefault();
    if (!teacherId) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/v1/teachers/${teacherId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          qualification: editForm.qualification || null,
          dateOfBirth: editForm.dateOfBirth || null,
          address: editForm.address || null,
          nationalId: editForm.nationalId || null,
        }),
      });
      await loadProfile();
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update teacher.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    setRemovingId(id);
    setError("");
    try {
      await api(`/api/v1/teacher-assignments/${id}`, { method: "DELETE" });
      await loadProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the subject.");
    } finally {
      setRemovingId("");
    }
  }

  if (error && !profile) return <p className="text-red-600">{error}</p>;
  if (!profile) return <p className="text-slate-500">Loading teacher profile...</p>;

  const viewed = assignmentsByYear.find((group) => group.id === yearView) ?? assignmentsByYear[0];
  const classGroups = [...(viewed?.rows ?? []).reduce((groups, row) => {
    const classGroup = groups.get(row.classGroupId) ?? { id: row.classGroupId, level: row.level, sections: new Map<string, { id: string; name: string; subjects: TeacherProfile["assignments"] }>() };
    const section = classGroup.sections.get(row.sectionId) ?? { id: row.sectionId, name: row.section, subjects: [] };
    section.subjects.push(row);
    classGroup.sections.set(row.sectionId, section);
    groups.set(row.classGroupId, classGroup);
    return groups;
  }, new Map<string, { id: string; level: string; sections: Map<string, { id: string; name: string; subjects: TeacherProfile["assignments"] }> }>()).values()];
  const shownClass = openClass || classGroups[0]?.id || "";
  const facts = [
    { label: "Date of birth", value: factDate(profile.dateOfBirth) },
    { label: "Phone", value: profile.phone || "—" },
    { label: "Specialist", value: profile.qualification || "—" },
    { label: "Address", value: profile.address || "—" },
    { label: "NIRA", value: profile.nationalId || "—" },
    { label: "Joined", value: factDate(profile.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Teachers › Teacher Profile</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Teacher Profile</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/school/teachers" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2563eb]">
            <ArrowLeft className="h-4 w-4" /> Back to Teachers
          </Link>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white">
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2563eb]" onClick={() => {
            api<{ setPasswordPath: string }>(`/api/v1/teachers/${teacherId}/access`, { method: "POST" })
              .then((result) => setPasswordLink(passwordLinkUrl(result.setPasswordPath)))
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update login access."));
          }}>
            {profile.hasLogin ? "Reset password" : "Invite login"}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold text-white ${avatarTone(profile.publicId)}`}>
            {initials(profile.name)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-950">{profile.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{profile.isActive ? "Active" : "Inactive"}</span>
            </div>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-500">{profile.publicId}</p>
            <p className="text-sm font-medium text-blue-700">{profile.email}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{fact.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Classes, sections & subjects</h3>
            <p className="mt-1 text-sm text-slate-500">View all classes, sections, and subjects assigned to this teacher, organized by school and academic year.</p>
          </div>
          <Link to="/school/teachers" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Check className="h-4 w-4" /> Done</Link>
        </div>
        {notice ? <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</p> : null}
        {passwordLink ? <PasswordLinkDialog url={passwordLink} onClose={() => setPasswordLink("")} /> : null}
        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">My school</p>
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">{profile.schools.map((school) => school.name).join(", ") || "This school"}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {assignmentsByYear.map((group) => (
            <button key={group.id} type="button" className={`rounded-full px-3 py-1.5 text-sm font-semibold ${(viewed?.id ?? "") === group.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => { setYearView(group.id); setOpenClass(""); }}>{group.year}</button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {classGroups.map((classGroup) => {
            const sections = [...classGroup.sections.values()];
            const open = shownClass === classGroup.id;
            return (
              <article key={classGroup.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <button type="button" className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left" onClick={() => setOpenClass(open ? "" : classGroup.id)}>
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-900"><GraduationCap className="h-4 w-4 text-blue-600" /> {classGroup.level}</span>
                  <span className="text-xs text-slate-500">{sections.length} section{sections.length === 1 ? "" : "s"}</span>
                </button>
                {open ? (
                  <div className="space-y-3 p-4">
                    {sections.map((section) => (
                      <div key={section.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">Section {section.name}</p>
                          <p className="text-xs text-slate-500">{section.subjects.length} subject{section.subjects.length === 1 ? "" : "s"}</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {section.subjects.map((subject, index) => (
                            <div key={subject.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><span className={`h-2.5 w-2.5 rounded-full ${subjectDot[index % subjectDot.length]}`} />{subject.subject}</span>
                              <button type="button" className="text-slate-400 hover:text-rose-600" disabled={removingId === subject.id} onClick={() => void removeAssignment(subject.id)} aria-label={`Remove ${subject.subject}`}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          {!classGroups.length ? <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No classes or subjects are assigned yet.</p> : null}
        </div>
        <form onSubmit={assignFromProfile} className="mt-6 border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Add assignment</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">Academic year *
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800" value={yearId} onChange={(event) => {
                const next = placement.find((item) => item.id === event.target.value);
                setYearId(event.target.value);
                setClassId(next?.classes[0]?.id ?? "");
                setSectionId("");
                setPickedSubjects([]);
              }}>
                {placement.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Class *
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800" value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); setPickedSubjects([]); }}>
                {assignYear?.classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Section *
              <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800" value={sectionId} onChange={(event) => { setSectionId(event.target.value); setPickedSubjects([]); }}>
                <option value="">Select section</option>
                {assignClass?.sections.map((item) => <option key={item.id} value={item.id}>Section {item.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {openSubjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={pickedSubjects.includes(subject.id)} onChange={(event) => setPickedSubjects((current) => event.target.checked ? [...current, subject.id] : current.filter((id) => id !== subject.id))} />
                {subject.name}
              </label>
            ))}
          </div>
          {sectionId && !openSubjects.length ? <p className="mt-3 text-sm text-slate-500">This section has no free subject. Add subjects to the section first.</p> : null}
          <button disabled={assigning || !pickedSubjects.length} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {assigning ? "Adding..." : "Add"}</button>
        </form>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form onSubmit={saveTeacher} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Edit Teacher</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">First name<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required /></label>
              <label className="text-sm font-medium text-slate-700">Last name<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} required /></label>
              <label className="text-sm font-medium text-slate-700">Phone<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} required /></label>
              <label className="text-sm font-medium text-slate-700">Specialist<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.qualification} onChange={(event) => setEditForm({ ...editForm, qualification: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Date of birth<input type="date" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.dateOfBirth} onChange={(event) => setEditForm({ ...editForm, dateOfBirth: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">NIRA<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.nationalId} onChange={(event) => setEditForm({ ...editForm, nationalId: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Address<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button disabled={saving} className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TeacherStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "green" | "violet" | "amber" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

export function SetPasswordPage() {
  const params = useParams();
  const token = (params.token || new URLSearchParams(window.location.search).get("token") || "").trim();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid" | "saved">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (token.length < 20) {
      setLinkState(sessionStorage.getItem("emp_password_saved") === "1" ? "saved" : "invalid");
      return;
    }
    sessionStorage.removeItem("emp_password_saved");
    fetch("/api/v1/auth/set-password/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => setLinkState(response.ok ? "ready" : "invalid"))
      .catch(() => setLinkState("invalid"));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/v1/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? "Could not save the password.");
      sessionStorage.setItem("emp_password_saved", "1");
      window.history.replaceState(null, "", "/set-password");
      setLinkState("saved");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save the password.";
      if (message === "This link is no longer valid.") setLinkState("invalid");
      else setError(message);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f9fafb] px-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Set password</h1>
        {linkState === "checking" ? <p className="mt-6 text-sm text-slate-500">Checking this link...</p> : null}
        {linkState === "invalid" ? <p className="mt-6 rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{token ? "This link is no longer valid. Ask the school for a new one." : "Open the full link copied by the school. The address must include the long code after set-password."}</p> : null}
        {linkState === "saved" ? <p className="mt-6 rounded-xl bg-blue-50 px-3 py-3 text-sm text-blue-700">Password saved. This link has been used and cannot be opened again. Sign in with your email.</p> : null}
        {linkState === "ready" ? (
          <form onSubmit={submit}>
            <span className="relative mt-6 block">
              <input className="w-full rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 pr-16 text-slate-800" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
            {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-red-600">{error}</p> : null}
            <button className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">Save password</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
