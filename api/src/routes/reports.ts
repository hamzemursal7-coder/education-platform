import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { levelLabel, terminalLevelsForSchool } from "../lib/levels.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

async function schoolOfUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

export const reportsRouter = Router();

reportsRouter.get("/dashboard/school", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const [
      students,
      activeEnrollments,
      teachers,
      staff,
      unpaidFees,
      partialFees,
      paidFees,
      feeOutstanding,
      feeCollected,
      pendingTransfers,
      alumni,
      parents,
      publishedAnnouncements,
      upcomingExams,
      attendancePresent,
      attendanceTotal,
    ] = await Promise.all([
      prisma.student.count({ where: { enrollments: { some: { schoolId: school.id } } } }),
      prisma.enrollment.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
      prisma.teacher.count({
        where: {
          organizationId: school.organizationId,
          OR: [{ user: { schoolId: school.id } }, { assignments: { some: { schoolId: school.id } } }],
        },
      }),
      prisma.staffMember.count({ where: { schoolId: school.id, isActive: true } }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "UNPAID" } }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "PARTIALLY_PAID" } }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "PAID" } }),
      prisma.studentFee.aggregate({
        where: { schoolId: school.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.payment.aggregate({
        where: { voidedAt: null, studentFee: { schoolId: school.id } },
        _sum: { amount: true },
      }),
      prisma.transferRequest.count({ where: { OR: [{ fromSchoolId: school.id }, { toSchoolId: school.id }], status: "PENDING" } }),
      prisma.alumniRecord.findMany({ where: { schoolId: school.id }, select: { studentId: true }, distinct: ["studentId"] }),
      prisma.guardian.count({ where: { students: { some: { student: { enrollments: { some: { schoolId: school.id } } } } } } }),
      prisma.announcement.count({ where: { schoolId: school.id, status: "PUBLISHED" } }),
      prisma.exam.count({ where: { schoolId: school.id } }),
      prisma.attendanceRecord.count({ where: { enrollment: { schoolId: school.id }, status: "PRESENT" } }),
      prisma.attendanceRecord.count({ where: { enrollment: { schoolId: school.id } } }),
    ]);
    const outstandingAmount = Math.max((feeOutstanding._sum.amount ?? 0) - (feeOutstanding._sum.paidAmount ?? 0), 0);
    res.json({
      school: { id: school.id, name: school.name, code: school.code, type: school.type },
      students,
      activeEnrollments,
      teachers,
      parents,
      graduates: alumni.length,
      staff,
      fees: {
        unpaid: unpaidFees,
        partial: partialFees,
        paid: paidFees,
        collected: feeCollected._sum.amount ?? 0,
        outstanding: outstandingAmount,
      },
      pendingTransfers,
      publishedAnnouncements,
      exams: upcomingExams,
      attendanceRate: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/dashboard/teacher", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.authUser!.id, isActive: true },
    });
    if (!teacher) throw new HttpError(403, "You are not allowed to access this record.");
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: teacher.id },
    });
    const sectionIds = [...new Set(assignments.map((item) => item.sectionId))];
    const subjectIds = [...new Set(assignments.map((item) => item.subjectId))];
    const schoolIds = [...new Set(assignments.map((item) => item.schoolId))];
    const [sections, subjects, pendingMarks, announcements] = await Promise.all([
      prisma.section.findMany({
        where: { id: { in: sectionIds } },
        include: { classGroup: { include: { academicYear: true } } },
      }),
      prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
      prisma.subjectResult.count({
        where: {
          state: { in: ["DRAFT", "REJECTED"] },
          examSubject: { subjectId: { in: subjectIds } },
          enrollment: { sectionId: { in: sectionIds } },
        },
      }),
      prisma.announcement.count({
        where: {
          schoolId: { in: schoolIds.length ? schoolIds : ["__none__"] },
          status: "PUBLISHED",
          audience: { in: ["ALL", "TEACHERS"] },
        },
      }),
    ]);
    res.json({
      assignmentCount: assignments.length,
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        level: levelLabel(section.classGroup.level),
        year: section.classGroup.academicYear.name,
      })),
      subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
      pendingMarks,
      announcements,
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/dashboard/accountant", requireAuth, requireRole("ACCOUNTANT", "SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const [collected, outstandingAgg, payments, waived, unpaid, partial] = await Promise.all([
      prisma.payment.aggregate({
        where: { voidedAt: null, studentFee: { schoolId: school.id } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.studentFee.aggregate({
        where: { schoolId: school.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.payment.findMany({
        where: { voidedAt: null, studentFee: { schoolId: school.id } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          studentFee: {
            include: { enrollment: { include: { student: true } } },
          },
        },
      }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "WAIVED" } }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "UNPAID" } }),
      prisma.studentFee.count({ where: { schoolId: school.id, status: "PARTIALLY_PAID" } }),
    ]);
    res.json({
      collected: collected._sum.amount ?? 0,
      paymentCount: collected._count,
      outstanding: Math.max((outstandingAgg._sum.amount ?? 0) - (outstandingAgg._sum.paidAmount ?? 0), 0),
      waived,
      unpaid,
      partial,
      recentPayments: payments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        student: `${payment.studentFee.enrollment.student.firstName} ${payment.studentFee.enrollment.student.fatherName}`,
        createdAt: payment.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/dashboard/parent", requireAuth, requireRole("PARENT"), async (req, res, next) => {
  try {
    const guardian = await prisma.guardian.findFirst({
      where: { userId: req.authUser!.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  orderBy: { createdAt: "desc" },
                  include: { school: true },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian) throw new HttpError(403, "You are not allowed to access this record.");
    const studentIds = guardian.students.map((link) => link.student.id);
    const schoolIds = [...new Set(guardian.students.flatMap((link) => link.student.enrollments.map((item) => item.schoolId)))];
    const [feeOutstanding, announcements, attendanceAbsent] = await Promise.all([
      prisma.studentFee.aggregate({
        where: {
          enrollment: { studentId: { in: studentIds } },
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.announcement.count({
        where: {
          schoolId: { in: schoolIds },
          status: "PUBLISHED",
          audience: { in: ["ALL", "PARENTS"] },
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          enrollment: { studentId: { in: studentIds } },
          status: "ABSENT",
        },
      }),
    ]);
    res.json({
      children: guardian.students.map((link) => {
        const current = link.student.enrollments.find((item) => item.status === "ACTIVE") ?? link.student.enrollments[0];
        return {
          id: link.student.id,
          name: `${link.student.firstName} ${link.student.fatherName}`,
          permanentId: link.student.permanentId,
          school: current?.school.name ?? "",
        };
      }),
      outstandingFees: Math.max((feeOutstanding._sum.amount ?? 0) - (feeOutstanding._sum.paidAmount ?? 0), 0),
      announcements,
      absentSessions: attendanceAbsent,
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/reports/fee-defaulters", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const fees = await prisma.studentFee.findMany({
      where: { schoolId: school.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      include: {
        enrollment: { include: { student: true, academicYear: true, classGroup: true, section: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(fees.map((fee) => ({
      student: `${fee.enrollment.student.firstName} ${fee.enrollment.student.fatherName}`,
      permanentId: fee.enrollment.student.permanentId,
      year: fee.enrollment.academicYear.name,
      level: levelLabel(fee.enrollment.classGroup.level),
      section: fee.enrollment.section.name,
      title: fee.title,
      type: fee.type,
      amount: fee.amount,
      paidAmount: fee.paidAmount,
      balance: Math.max(fee.amount - fee.paidAmount, 0),
      status: fee.status,
    })));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/reports/attendance-summary", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const sections = await prisma.section.findMany({
      where: { classGroup: { schoolId: school.id } },
      include: {
        classGroup: { include: { academicYear: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          include: { attendance: true },
        },
      },
    });
    res.json(sections.map((section) => {
      const records = section.enrollments.flatMap((enrollment) => enrollment.attendance);
      const present = records.filter((item) => item.status === "PRESENT").length;
      const absent = records.filter((item) => item.status === "ABSENT").length;
      const late = records.filter((item) => item.status === "LATE").length;
      const total = records.length;
      return {
        year: section.classGroup.academicYear.name,
        level: levelLabel(section.classGroup.level),
        section: section.name,
        students: section.enrollments.length,
        present,
        absent,
        late,
        total,
        rate: total ? Math.round((present / total) * 100) : null,
      };
    }));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/reports/alumni", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const rows = await prisma.alumniRecord.findMany({
      where: { schoolId: school.id, fromLevel: { in: terminalLevelsForSchool(school.type) } },
      include: { student: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map((row) => ({
      permanentId: row.student.permanentId,
      name: `${row.student.firstName} ${row.student.fatherName} ${row.student.grandfatherName}`,
      fromLevel: levelLabel(row.fromLevel),
      reason: row.reason,
      createdAt: row.createdAt,
    })));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/reports/fee-defaulters.csv", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolOfUser(req.authUser!.id);
    const fees = await prisma.studentFee.findMany({
      where: { schoolId: school.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      include: { enrollment: { include: { student: true, academicYear: true, section: true, classGroup: true } } },
      orderBy: { createdAt: "desc" },
    });
    const lines = [
      "permanentId,student,year,level,section,title,amount,paid,balance,status",
      ...fees.map((fee) => {
        const balance = Math.max(fee.amount - fee.paidAmount, 0);
        const name = `${fee.enrollment.student.firstName} ${fee.enrollment.student.fatherName}`.replaceAll(",", " ");
        return [
          fee.enrollment.student.permanentId,
          name,
          fee.enrollment.academicYear.name,
          levelLabel(fee.enrollment.classGroup.level),
          fee.enrollment.section.name,
          fee.title.replaceAll(",", " "),
          fee.amount,
          fee.paidAmount,
          balance,
          fee.status,
        ].join(",");
      }),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fee-defaulters-${school.code}.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});
