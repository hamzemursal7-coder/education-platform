import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const [organizations, schools, users, students, maleStudents, femaleStudents, teachers, staff, activeEnrollments, parents, graduateRows, payments, feeTotals, pendingTransfers] = await Promise.all([
    prisma.organization.count(),
    prisma.school.count(),
    prisma.user.count(),
    prisma.student.count(),
    prisma.student.count({ where: { gender: "MALE" } }),
    prisma.student.count({ where: { gender: "FEMALE" } }),
    prisma.teacher.count(),
    prisma.staffMember.count({ where: { isActive: true } }),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.guardian.count(),
    prisma.alumniRecord.findMany({ select: { schoolId: true, studentId: true }, distinct: ["schoolId", "studentId"] }),
    prisma.payment.aggregate({ where: { voidedAt: null }, _sum: { amount: true } }),
    prisma.studentFee.groupBy({ by: ["schoolId"], _sum: { amount: true, paidAmount: true } }),
    prisma.transferRequest.count({ where: { status: { in: ["PENDING", "WAITING_FOR_SECTION"] } } }),
  ]);
  const [schoolList, schoolRoles, schoolAdmins] = await Promise.all([prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      address: true,
      primaryColor: true,
      accentColor: true,
      iconKey: true,
      isActive: true,
      isDemo: true,
      organization: { select: { name: true } },
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
          users: true,
        },
      },
    },
  }), prisma.user.groupBy({
    by: ["schoolId", "role"],
    where: { schoolId: { not: null } },
    _count: { _all: true },
  }), prisma.user.findMany({
    where: { role: "SCHOOL_ADMIN", schoolId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, schoolId: true, firstName: true, lastName: true, email: true, phone: true },
  })]);
  const adminBySchool = new Map<string, (typeof schoolAdmins)[number]>();
  for (const admin of schoolAdmins) {
    if (admin.schoolId && !adminBySchool.has(admin.schoolId)) adminBySchool.set(admin.schoolId, admin);
  }
  const roleCount = (schoolId: string, roles: string[]) =>
    schoolRoles
      .filter((row) => row.schoolId === schoolId && roles.includes(row.role))
      .reduce((total, row) => total + row._count._all, 0);
  const graduatesBySchool = new Map<string, number>();
  for (const row of graduateRows) {
    graduatesBySchool.set(row.schoolId, (graduatesBySchool.get(row.schoolId) ?? 0) + 1);
  }
  const feesBySchool = new Map(feeTotals.map((row) => [row.schoolId, { collected: row._sum.paidAmount ?? 0, outstanding: Math.max((row._sum.amount ?? 0) - (row._sum.paidAmount ?? 0), 0) }]));
  const feesOutstanding = [...feesBySchool.values()].reduce((total, row) => total + row.outstanding, 0);
  res.json({
    organizations,
    schools,
    users,
    students,
    maleStudents,
    femaleStudents,
    teachers,
    staff,
    parents,
    graduates: new Set(graduateRows.map((row) => row.studentId)).size,
    activeEnrollments,
    pendingTransfers,
    feesCollected: payments._sum.amount ?? 0,
    feesOutstanding,
    schoolList: schoolList.map((school) => ({
      id: school.id,
      name: school.name,
      code: school.code,
      type: school.type,
      address: school.address,
      primaryColor: school.primaryColor,
      accentColor: school.accentColor,
      iconKey: school.iconKey,
      isActive: school.isActive,
      isDemo: school.isDemo,
      organization: school.organization.name,
      activeEnrollments: school._count.enrollments,
      users: school._count.users,
      teachers: roleCount(school.id, ["TEACHER"]),
      staff: roleCount(school.id, ["SCHOOL_ADMIN", "ACCOUNTANT", "STAFF"]),
      alumni: graduatesBySchool.get(school.id) ?? 0,
      feesCollected: feesBySchool.get(school.id)?.collected ?? 0,
      feesOutstanding: feesBySchool.get(school.id)?.outstanding ?? 0,
      admin: (() => {
        const admin = adminBySchool.get(school.id);
        return admin ? { id: admin.id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, phone: admin.phone ?? "" } : null;
      })(),
    })),
  });
});
