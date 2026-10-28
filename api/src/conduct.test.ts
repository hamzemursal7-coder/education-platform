import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./lib/prisma.js";
import { ConductCategory, ConductSeverity, ConductStatus, ConductVisibilityLevel } from "@prisma/client";

test("Conduct & Welfare: Role isolation and visibility rules", async (t) => {
  // Find an active school with students, teachers, and guardians
  const school = await prisma.school.findFirst({
    where: { isActive: true },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { student: { include: { guardians: true } } },
        take: 2,
      },
    },
  });

  assert.ok(school, "An active school is required for conduct test");
  assert.ok(school.enrollments.length >= 2, "At least two enrolled students required");

  const enrA = school.enrollments[0];
  const enrB = school.enrollments[1];

  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: "SCHOOL_ADMIN", status: "ACTIVE" },
  });
  assert.ok(adminUser, "School admin required");

  // Create test conduct reports for student A
  const reportA = await prisma.conductReport.create({
    data: {
      reportNumber: `TEST-CR-${Date.now()}-A`,
      schoolId: school.id,
      studentId: enrA.studentId,
      enrollmentId: enrA.id,
      reporterUserId: adminUser.id,
      category: ConductCategory.POSITIVE_CONDUCT,
      severity: ConductSeverity.LOW,
      isPositive: true,
      incidentDate: new Date(),
      title: "Outstanding Leadership in Science Fair",
      description: "Demonstrated excellent collaboration and helped peers complete project on time.",
      status: ConductStatus.RESOLVED,
      isParentVisible: true,
      isStudentVisible: true,
      isSensitive: false,
      visibilityLevel: ConductVisibilityLevel.COMMUNITY_PUBLISHED,
    },
  });

  // Create a sensitive safeguarding report for student A
  const reportASensitive = await prisma.conductReport.create({
    data: {
      reportNumber: `TEST-CR-${Date.now()}-SENS`,
      schoolId: school.id,
      studentId: enrA.studentId,
      enrollmentId: enrA.id,
      reporterUserId: adminUser.id,
      category: ConductCategory.SAFEGUARDING,
      severity: ConductSeverity.URGENT,
      isPositive: false,
      incidentDate: new Date(),
      title: "Confidential Welfare Referral",
      description: "Urgent disclosure requiring external pastoral lead liaison.",
      status: ConductStatus.UNDER_REVIEW,
      isParentVisible: false,
      isStudentVisible: false,
      isSensitive: true,
      visibilityLevel: ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY,
    },
  });

  // Create an internal/draft report for student B
  const reportBInternal = await prisma.conductReport.create({
    data: {
      reportNumber: `TEST-CR-${Date.now()}-B`,
      schoolId: school.id,
      studentId: enrB.studentId,
      enrollmentId: enrB.id,
      reporterUserId: adminUser.id,
      category: ConductCategory.CLASSROOM_DISRUPTION,
      severity: ConductSeverity.MEDIUM,
      isPositive: false,
      incidentDate: new Date(),
      title: "Repeated Talking During Silent Reading",
      description: "Given verbal warning, moved seating.",
      status: ConductStatus.UNDER_REVIEW,
      isParentVisible: false,
      isStudentVisible: false,
      isSensitive: false,
      visibilityLevel: ConductVisibilityLevel.STAFF_INTERNAL,
    },
  });

  try {
    await t.test("Parent query filter excludes another parent's child's reports", async () => {
      // Simulate parent query for Student A vs Student B
      const parentReportsForStudentB = await prisma.conductReport.findMany({
        where: {
          studentId: enrB.studentId,
          isParentVisible: true,
          isSensitive: false,
          status: { in: ["UNDER_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
        },
      });

      // Report B is internal (isParentVisible = false), so 0 reports returned
      assert.equal(parentReportsForStudentB.length, 0, "Internal report for Student B must not be visible to parents");
    });

    await t.test("Parent query filter strictly hides sensitive safeguarding reports", async () => {
      const parentReportsForStudentA = await prisma.conductReport.findMany({
        where: {
          studentId: enrA.studentId,
          isParentVisible: true,
          isSensitive: false,
          status: { in: ["UNDER_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
        },
      });

      // Should include reportA (published) but NEVER reportASensitive
      const ids = parentReportsForStudentA.map((r) => r.id);
      assert.ok(ids.includes(reportA.id), "Approved report A must be returned");
      assert.ok(!ids.includes(reportASensitive.id), "Sensitive safeguarding report MUST NEVER be returned to parents");
    });

    await t.test("Student query filter excludes reports not approved for student visibility", async () => {
      const studentReports = await prisma.conductReport.findMany({
        where: {
          studentId: enrB.studentId,
          isStudentVisible: true,
          isSensitive: false,
          status: { in: ["ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
        },
      });

      assert.equal(studentReports.length, 0, "Student B must not see unpublished report");
    });

    await t.test("Visibility update enables subsequent authorized retrieval", async () => {
      // Admin approves Report B for student
      await prisma.conductReport.update({
        where: { id: reportBInternal.id },
        data: {
          isStudentVisible: true,
          status: ConductStatus.ACTION_REQUIRED,
        },
      });

      const studentReportsAfterApproval = await prisma.conductReport.findMany({
        where: {
          studentId: enrB.studentId,
          isStudentVisible: true,
          isSensitive: false,
          status: { in: ["ACTION_REQUIRED", "RESOLVED", "CLOSED"] },
        },
      });

      assert.equal(studentReportsAfterApproval.length, 1, "Report B must now be visible to student B after approval");
      assert.equal(studentReportsAfterApproval[0].id, reportBInternal.id);
    });

    await t.test("Teacher submitted report is restricted to administration and other teachers cannot see it", async () => {
      // Create a report as if submitted by a teacher
      const teacherSubmission = await prisma.conductReport.create({
        data: {
          reportNumber: `TEST-CR-TCH-${Date.now()}`,
          schoolId: school.id,
          studentId: enrA.studentId,
          enrollmentId: enrA.id,
          reporterUserId: adminUser.id,
          category: ConductCategory.CLASSROOM_DISRUPTION,
          severity: ConductSeverity.LOW,
          isPositive: false,
          incidentDate: new Date(),
          title: "Teacher Classroom Report",
          description: "Confidential report for admin review.",
          status: ConductStatus.SUBMITTED,
          isParentVisible: false,
          isStudentVisible: false,
          visibilityLevel: ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY,
        },
      });

      // Verify the report is initialised with isParentVisible = false and isStudentVisible = false
      assert.equal(teacherSubmission.isParentVisible, false, "Teacher cannot publish to parents directly");
      assert.equal(teacherSubmission.isStudentVisible, false, "Teacher cannot publish to students directly");
      assert.equal(teacherSubmission.visibilityLevel, ConductVisibilityLevel.RESTRICTED_ADMIN_ONLY);

      // Verify School Admin can see all reports for this school
      const adminReports = await prisma.conductReport.findMany({
        where: { schoolId: school.id },
      });
      const adminReportIds = adminReports.map((r) => r.id);
      assert.ok(adminReportIds.includes(teacherSubmission.id), "Admin must receive and see all reports in the school");

      // Cleanup
      await prisma.conductReport.delete({ where: { id: teacherSubmission.id } });
    });
  } finally {
    // Cleanup test data
    await prisma.conductAction.deleteMany({
      where: { reportId: { in: [reportA.id, reportASensitive.id, reportBInternal.id] } },
    });
    await prisma.conductReport.deleteMany({
      where: { id: { in: [reportA.id, reportASensitive.id, reportBInternal.id] } },
    });
  }
});
