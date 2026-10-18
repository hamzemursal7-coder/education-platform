import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";

const base = process.env.PORTAL_TEST_API ?? "http://localhost:4000";

const roles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "STAFF", "ACCOUNTANT"] as const;

async function activeUser(role: UserRole) {
  return prisma.user.findFirst({
    where: {
      role,
      status: "ACTIVE",
      ...(role === "TEACHER" ? { teacher: { isNot: null } } : {}),
      ...(role === "PARENT" ? { guardian: { isNot: null } } : {}),
      ...(role === "STUDENT" ? { personKey: { not: null } } : {}),
      ...(role === "SCHOOL_ADMIN" || role === "ACCOUNTANT" ? { schoolId: { not: null } } : {}),
    },
    select: { id: true, role: true, schoolId: true, personKey: true },
  });
}

function cookieFor(user: { id: string; role: UserRole; schoolId: string | null }) {
  return `emp_access=${signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId })}`;
}

async function call(path: string, cookie?: string) {
  const response = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  return { status: response.status, text };
}

test("each role can open its own portal API and is refused from the others", async () => {
  const users = Object.fromEntries(await Promise.all(roles.map(async (role) => [role, await activeUser(role)]))) as Record<(typeof roles)[number], Awaited<ReturnType<typeof activeUser>>>;
  let temporaryStaffId = "";
  if (!users.STAFF) {
    const created = await prisma.user.create({
      data: {
        email: "portal-staff-check@demo.school",
        role: "STAFF",
        status: "ACTIVE",
        firstName: "Portal",
        lastName: "Check",
        schoolId: users.SCHOOL_ADMIN?.schoolId,
        isDemo: true,
      },
      select: { id: true, role: true, schoolId: true, personKey: true },
    });
    temporaryStaffId = created.id;
    users.STAFF = created;
  }
  try {
  for (const role of roles) assert.ok(users[role], `An active ${role} account is required.`);

  const own: Record<(typeof roles)[number], string> = {
    SUPER_ADMIN: "/api/v1/dashboard/summary",
    SCHOOL_ADMIN: "/api/v1/dashboard/school",
    TEACHER: "/api/v1/teacher/me",
    PARENT: "/api/v1/parent/children",
    STUDENT: "/api/v1/student/results",
    STAFF: "/api/v1/announcements/inbox",
    ACCOUNTANT: "/api/v1/dashboard/accountant",
  };
  const foreign = ["/api/v1/students", "/api/v1/exams", "/api/v1/fees", "/api/v1/teacher/me", "/api/v1/parent/children", "/api/v1/student/results", "/api/v1/dashboard/summary"];

  for (const path of [...Object.values(own), ...foreign]) {
    const anonymous = await call(path);
    assert.equal(anonymous.status, 401, `${path} without a session`);
  }

  for (const role of roles) {
    const session = cookieFor(users[role]!);
    const allowed = await call(own[role], session);
    if ((role === "SCHOOL_ADMIN" || role === "ACCOUNTANT") && allowed.status === 403) {
      const record = await prisma.user.findUnique({ where: { id: users[role]!.id }, include: { school: true } });
      assert.equal(record?.school?.isActive, false, `${role} was refused from ${own[role]} while the school is active: ${allowed.text.slice(0, 180)}`);
    } else {
      assert.equal(allowed.status, 200, `${role} ${own[role]} returned ${allowed.status} ${allowed.text.slice(0, 180)}`);
    }
    for (const path of foreign) {
      if (path === own[role]) continue;
      if (role === "SCHOOL_ADMIN" && (path === "/api/v1/students" || path === "/api/v1/exams" || path === "/api/v1/fees")) continue;
      if (role === "ACCOUNTANT" && path === "/api/v1/fees") continue;
      const denied = await call(path, session);
      assert.equal(denied.status, 403, `${role} should not open ${path}, got ${denied.status}`);
    }
  }

  const actingSuperAdmin = users.SUPER_ADMIN!;
  if (actingSuperAdmin.schoolId) {
    const actingCookie = `emp_access=${signAccessToken({ sub: actingSuperAdmin.id, role: "SCHOOL_ADMIN", schoolId: actingSuperAdmin.schoolId })}`;
    const schoolView = await call("/api/v1/dashboard/school", actingCookie);
    assert.equal(schoolView.status, 200, "Super Admin inside a school should open the school dashboard");
    const superApi = await call("/api/v1/dashboard/summary", actingCookie);
    assert.equal(superApi.status, 403, "Super Admin inside a school should not keep the super admin API");
  }

  const student = users.STUDENT!;
  const studentBody = await call("/api/v1/student/results", cookieFor(student));
  const studentJson = JSON.parse(studentBody.text) as { student: { permanentId: string } | null };
  if (student.personKey) assert.equal(studentJson.student?.permanentId, student.personKey);

  const otherStudent = await prisma.student.findFirst({
    where: { guardians: { none: { guardian: { userId: users.PARENT!.id } } } },
    select: { id: true },
  });
  assert.ok(otherStudent, "A student outside this parent's family is required.");
  const parentDenied = await call(`/api/v1/parent/children/${otherStudent.id}`, cookieFor(users.PARENT!));
  assert.equal(parentDenied.status, 403);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: users.TEACHER!.id },
    include: { assignments: { select: { schoolId: true } } },
  });
  const assigned = new Set(teacher?.assignments.map((row) => row.schoolId) ?? []);
  const otherSchool = await prisma.school.findFirst({
    where: { id: { notIn: [...assigned] } },
    select: { id: true },
  });
  assert.ok(otherSchool, "A school outside this teacher's assignments is required.");
  const teacherDenied = await call(`/api/v1/teacher/years?schoolId=${otherSchool.id}`, cookieFor(users.TEACHER!));
  assert.equal(teacherDenied.status, 403);

  } finally {
    if (temporaryStaffId) await prisma.user.delete({ where: { id: temporaryStaffId } });
    await prisma.$disconnect();
  }
});
