import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";
import { createApp } from "./app.js";

test("Student Re-enrollment, Organization-Wide Transfer, Historical Preservation & Erroneous Transfer Reversal", async () => {
  const app = createApp();
  let server!: Server;
  const port = 4291;
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });

  const base = `http://localhost:${port}`;

  async function apiCall(path: string, options: { method?: string; body?: unknown; cookie?: string }) {
    const res = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await res.text();
    let json: Record<string, any> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // ignore non-json
    }
    return { status: res.status, text, json };
  }

  const stamp = Date.now().toString().slice(-8);

  // Create isolated test organizations
  const orgMain = await prisma.organization.create({
    data: { name: `Org Reenroll Main ${stamp}`, isDemo: true },
  });
  const orgForeign = await prisma.organization.create({
    data: { name: `Org Reenroll Foreign ${stamp}`, isDemo: true },
  });

  // Create School A and School B in orgMain, and Foreign School in orgForeign
  const schoolA = await prisma.school.create({
    data: {
      name: `School A ${stamp}`,
      code: `SCA${stamp.slice(-3)}`,
      type: "PRIMARY_AND_SECONDARY",
      organizationId: orgMain.id,
      isActive: true,
      isDemo: true,
    },
  });

  const schoolB = await prisma.school.create({
    data: {
      name: `School B ${stamp}`,
      code: `SCB${stamp.slice(-3)}`,
      type: "PRIMARY_AND_SECONDARY",
      organizationId: orgMain.id,
      isActive: true,
      isDemo: true,
    },
  });

  const schoolForeign = await prisma.school.create({
    data: {
      name: `Foreign School ${stamp}`,
      code: `SCF${stamp.slice(-3)}`,
      type: "PRIMARY_AND_SECONDARY",
      organizationId: orgForeign.id,
      isActive: true,
      isDemo: true,
    },
  });

  // Create Users (School A Admin, School B Admin, Foreign Admin, Teacher)
  const adminA = await prisma.user.create({
    data: {
      email: `admin-a-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "SchoolA",
      schoolId: schoolA.id,
      isDemo: true,
    },
  });

  const adminB = await prisma.user.create({
    data: {
      email: `admin-b-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "SchoolB",
      schoolId: schoolB.id,
      isDemo: true,
    },
  });

  const adminForeign = await prisma.user.create({
    data: {
      email: `admin-f-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "Foreign",
      schoolId: schoolForeign.id,
      isDemo: true,
    },
  });

  const teacherA = await prisma.user.create({
    data: {
      email: `teacher-a-${stamp}@demo.test`,
      role: "TEACHER",
      status: "ACTIVE",
      firstName: "Teacher",
      lastName: "SchoolA",
      schoolId: schoolA.id,
      isDemo: true,
    },
  });

  const cookieAdminA = `emp_access=${signAccessToken({ sub: adminA.id, role: "SCHOOL_ADMIN", schoolId: schoolA.id })}`;
  const cookieAdminB = `emp_access=${signAccessToken({ sub: adminB.id, role: "SCHOOL_ADMIN", schoolId: schoolB.id })}`;
  const cookieForeign = `emp_access=${signAccessToken({ sub: adminForeign.id, role: "SCHOOL_ADMIN", schoolId: schoolForeign.id })}`;
  const cookieTeacher = `emp_access=${signAccessToken({ sub: teacherA.id, role: "TEACHER", schoolId: schoolA.id })}`;

  // Academic years, classes, sections, subjects, and published marks
  const yearA = await prisma.academicYear.create({
    data: {
      schoolId: schoolA.id,
      name: `2026-2027`,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
      isDemo: true,
    },
  });

  const classA5 = await prisma.classGroup.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      level: "CLASS_5",
    },
  });

  const sectionA5A = await prisma.section.create({
    data: {
      classGroupId: classA5.id,
      name: "A",
    },
  });

  const sectionA5B = await prisma.section.create({
    data: {
      classGroupId: classA5.id,
      name: "B",
    },
  });

  const subjectMath = await prisma.subject.create({
    data: {
      schoolId: schoolA.id,
      name: "Mathematics",
      code: `MTH-${stamp.slice(-4)}`,
      isDemo: true,
    },
  });

  await prisma.classSubject.create({
    data: {
      classGroupId: classA5.id,
      subjectId: subjectMath.id,
    },
  });

  const examA = await prisma.exam.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      term: "TERM_1",
      generalMax: 100,
    },
  });

  const examSubjMath = await prisma.examSubject.create({
    data: {
      examId: examA.id,
      classGroupId: classA5.id,
      subjectId: subjectMath.id,
      minMarks: 50,
      maxMarks: 100,
    },
  });

  await prisma.examSection.create({
    data: {
      examId: examA.id,
      sectionId: sectionA5A.id,
    },
  });

  // School B academic structure
  const yearB = await prisma.academicYear.create({
    data: {
      schoolId: schoolB.id,
      name: `2026-2027`,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
      isDemo: true,
    },
  });

  const classB5 = await prisma.classGroup.create({
    data: {
      schoolId: schoolB.id,
      academicYearId: yearB.id,
      level: "CLASS_5",
    },
  });

  const sectionB5A = await prisma.section.create({
    data: {
      classGroupId: classB5.id,
      name: "A",
    },
  });

  // Foreign school academic structure
  const yearF = await prisma.academicYear.create({
    data: {
      schoolId: schoolForeign.id,
      name: `2026-2027`,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
      isDemo: true,
    },
  });

  const classF5 = await prisma.classGroup.create({
    data: {
      schoolId: schoolForeign.id,
      academicYearId: yearF.id,
      level: "CLASS_5",
    },
  });

  const sectionF5A = await prisma.section.create({
    data: {
      classGroupId: classF5.id,
      name: "A",
    },
  });

  // Create Student 1 (for Same-School Return & Cross-School Return)
  const student1 = await prisma.student.create({
    data: {
      organizationId: orgMain.id,
      permanentId: `STU-RET-1-${stamp}`,
      firstName: "Amina",
      fatherName: "Hassan",
      grandfatherName: "Ali",
      gender: "FEMALE",
      dateOfBirth: new Date("2014-04-10"),
      status: "ACTIVE",
      isDemo: true,
    },
  });

  const student1PortalUser = await prisma.user.create({
    data: {
      email: `student1-${stamp}@demo.test`,
      role: "STUDENT",
      status: "ACTIVE",
      firstName: student1.firstName,
      lastName: student1.fatherName,
      schoolId: schoolA.id,
      personKey: student1.permanentId,
      passwordHash: "hashed-pw",
      isDemo: true,
    },
  });
  const cookieStudent1 = `emp_access=${signAccessToken({ sub: student1PortalUser.id, role: "STUDENT", schoolId: schoolA.id })}`;

  const enrollment1 = await prisma.enrollment.create({
    data: {
      studentId: student1.id,
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      classGroupId: classA5.id,
      sectionId: sectionA5A.id,
      studentNumber: `00001`,
      rollNumber: 1,
      status: "ACTIVE",
    },
  });

  // Historical grade & attendance on enrollment1
  await prisma.subjectResult.create({
    data: {
      enrollmentId: enrollment1.id,
      examSubjectId: examSubjMath.id,
      marks: 92,
      state: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await prisma.attendanceRecord.create({
    data: {
      enrollmentId: enrollment1.id,
      date: new Date("2026-09-15"),
      session: "MORNING",
      status: "PRESENT",
      markedByUserId: adminA.id,
    },
  });

  // Create Student 2 (for Erroneous Transfer Reversal test)
  const student2 = await prisma.student.create({
    data: {
      organizationId: orgMain.id,
      permanentId: `STU-RET-2-${stamp}`,
      firstName: "Bilal",
      fatherName: "Omar",
      grandfatherName: "Farah",
      gender: "MALE",
      dateOfBirth: new Date("2014-08-22"),
      status: "ACTIVE",
      isDemo: true,
    },
  });

  const enrollment2 = await prisma.enrollment.create({
    data: {
      studentId: student2.id,
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      classGroupId: classA5.id,
      sectionId: sectionA5A.id,
      studentNumber: `00002`,
      rollNumber: 2,
      status: "ACTIVE",
    },
  });

  const createdSchools = [schoolA.id, schoolB.id, schoolForeign.id];
  const createdOrgs = [orgMain.id, orgForeign.id];

  try {
    // =========================================================================
    // 1. Prevent Duplicate Student Master Records & Enforce Organization Lookup
    // =========================================================================
    console.log("RT-01: Prevent duplicate student master records in same organization...");
    const dupStudentRes = await apiCall("/api/v1/students", {
      method: "POST",
      cookie: cookieAdminB,
      body: {
        firstName: "Amina",
        fatherName: "Hassan",
        grandfatherName: "Ali",
        gender: "FEMALE",
        dateOfBirth: "2014-04-10",
        academicYearId: yearB.id,
        sectionId: sectionB5A.id,
      },
    });
    assert.equal(dupStudentRes.status, 409, `Expected 409 on duplicate master identity, got ${dupStudentRes.status}`);

    console.log("RT-02: Organization-wide lookup finds students in same org and isolates foreign org...");
    const lookupMain = await apiCall(`/api/v1/transfers/lookup-students?q=${student1.permanentId}`, {
      cookie: cookieAdminB,
    });
    assert.equal(lookupMain.status, 200);
    assert.equal(lookupMain.json.items.length, 1);
    assert.equal(lookupMain.json.items[0].permanentId, student1.permanentId);

    const lookupForeign = await apiCall(`/api/v1/transfers/lookup-students?q=${student1.permanentId}`, {
      cookie: cookieForeign,
    });
    assert.equal(lookupForeign.status, 200);
    assert.equal(lookupForeign.json.items.length, 0, "Foreign org admin must not see students from orgMain");

    // =========================================================================
    // 2. Prevent Duplicate Active Enrollments
    // =========================================================================
    console.log("RT-03: Prevent re-enrolling a student who already has an ACTIVE enrollment...");
    const dupActiveRes = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: student1.id,
        academicYearId: yearA.id,
        sectionId: sectionA5B.id,
        reason: "Attempt re-enroll while active",
      },
    });
    assert.equal(dupActiveRes.status, 409);

    // =========================================================================
    // 3. External Transfer Out -> Verify Student Portal Transferred Status
    // =========================================================================
    console.log("RT-04: Transfer Student 1 out externally and verify Student Portal transfer notice...");
    const draft1 = await apiCall("/api/v1/transfers/external/draft", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        enrollmentId: enrollment1.id,
        destinationSchoolName: "External Academy",
        reason: "Family moved",
      },
    });
    assert.equal(draft1.status, 201);

    await prisma.externalTransfer.update({
      where: { enrollmentId: enrollment1.id },
      data: { tcDownloaded: true, transcriptDownloaded: true },
    });

    const confirm1 = await apiCall(`/api/v1/transfers/external/${enrollment1.id}/confirm`, {
      method: "POST",
      cookie: cookieAdminA,
      body: { documentsReviewed: true },
    });
    assert.equal(confirm1.status, 200);

    const portalTransferred = await apiCall("/api/v1/student/results", {
      cookie: cookieStudent1,
    });
    assert.equal(portalTransferred.status, 200);
    assert.equal(portalTransferred.json.student.isTransferred, true);
    assert.equal(portalTransferred.json.student.isReenrolled, false);
    assert.equal(portalTransferred.json.student.status, "TRANSFERRED");

    // =========================================================================
    // 4. Reject Unauthorized Role & Cross-Organization Return Attempts
    // =========================================================================
    console.log("RT-05: Enforce role permissions and reject cross-organization return attempts...");
    const teacherReenroll = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieTeacher,
      body: {
        studentId: student1.id,
        academicYearId: yearA.id,
        sectionId: sectionA5B.id,
        reason: "Teacher attempt",
      },
    });
    assert.equal(teacherReenroll.status, 403);

    const crossOrgReenroll1 = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieForeign,
      body: {
        studentId: student1.id,
        academicYearId: yearF.id,
        sectionId: sectionF5A.id,
        reason: "Foreign admin attempting to pull student from another org",
      },
    });
    assert.equal(crossOrgReenroll1.status, 403);

    const crossOrgReenroll2 = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: student1.id,
        destinationSchoolId: schoolForeign.id,
        academicYearId: yearF.id,
        sectionId: sectionF5A.id,
        reason: "Admin A attempting to send student to foreign org school",
      },
    });
    assert.equal(crossOrgReenroll2.status, 403);

    // =========================================================================
    // 5. Return to the Same School (Same Academic Year!)
    //    - Creates NEW enrollment rather than overwriting historical enrollment
    //    - Preserves confirmed ExternalTransfer and historical grades/attendance
    //    - Updates Student Portal to show approved re-enrollment message
    // =========================================================================
    console.log("RT-06: Return Student 1 to the SAME school (School A) creating a new enrollment...");
    const sameSchoolReturn = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: student1.id,
        destinationSchoolId: schoolA.id,
        academicYearId: yearA.id,
        classGroupId: classA5.id,
        sectionId: sectionA5B.id,
        reason: "Family returned to district and re-admitted to School A",
      },
    });
    assert.equal(sameSchoolReturn.status, 201, `Expected 201, got ${sameSchoolReturn.status}: ${sameSchoolReturn.text}`);
    assert.equal(sameSchoolReturn.json.status, "COMPLETED");
    assert.equal(sameSchoolReturn.json.studentStatus, "ACTIVE");
    const newEnrollmentAId = sameSchoolReturn.json.enrollment.id;
    assert.ok(newEnrollmentAId);
    assert.notEqual(newEnrollmentAId, enrollment1.id, "Must create a NEW enrollment record, not overwrite the old one");

    // Verify historical enrollment1 is still TRANSFERRED and its confirmed ExternalTransfer is untouched
    const oldEnrollCheck = await prisma.enrollment.findUnique({
      where: { id: enrollment1.id },
      include: { externalTransfer: true, results: true, attendance: true },
    });
    assert.equal(oldEnrollCheck?.status, "TRANSFERRED");
    assert.equal(oldEnrollCheck?.externalTransfer?.status, "CONFIRMED");
    assert.equal(oldEnrollCheck?.results.length, 1);
    assert.equal(oldEnrollCheck?.results[0].marks, 92);
    assert.equal(oldEnrollCheck?.attendance.length, 1);

    // Verify Student Portal now shows approved re-enrollment message and NOT transferred-out notice
    console.log("RT-07: Verify Student Portal shows approved re-enrollment message and preserves historical access...");
    const portalReenrolled = await apiCall("/api/v1/student/results", {
      cookie: cookieStudent1,
    });
    assert.equal(portalReenrolled.status, 200);
    assert.equal(portalReenrolled.json.student.isTransferred, false, "Re-enrolled student must not see transferred-out flag");
    assert.equal(portalReenrolled.json.student.isReenrolled, true, "Re-enrolled student must see isReenrolled=true");
    assert.equal(
      portalReenrolled.json.student.reenrollmentMessage,
      "Your re-enrollment has been approved. You can now access your current academic information and previous academic records.",
    );
    assert.equal(portalReenrolled.json.student.status, "ACTIVE");
    assert.equal(portalReenrolled.json.years.length, 2, "Both current and historical enrollments must be accessible");

    // Verify historical marks on enrollment1 are still accessible via enrollmentId / year switcher
    const portalHistoryView = await apiCall(`/api/v1/student/results?enrollmentId=${enrollment1.id}`, {
      cookie: cookieStudent1,
    });
    assert.equal(portalHistoryView.status, 200);
    assert.equal(portalHistoryView.json.yearAverage, 92);

    // Verify cannot reverse an external transfer after the student has already re-enrolled in a subsequent enrollment
    const illegalReverseAfterReturn = await apiCall(`/api/v1/transfers/external/${enrollment1.id}/reverse`, {
      method: "POST",
      cookie: cookieAdminA,
      body: { reason: "Trying to reverse after genuine return" },
    });
    assert.equal(illegalReverseAfterReturn.status, 409);

    // =========================================================================
    // 6. Return / Transfer to a Different School in the Same Organization
    //    (Testing Two-Step Initiate -> Approve so Student.status becomes ACTIVE only after approval)
    // =========================================================================
    console.log("RT-08: Withdraw Student 1 again and test Returning to School B in the same organization...");
    // Confirm external transfer on newEnrollmentAId so Student 1 is WITHDRAWN again
    await apiCall("/api/v1/transfers/external/draft", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        enrollmentId: newEnrollmentAId,
        destinationSchoolName: "Outside School",
        reason: "Left after term",
      },
    });
    await prisma.externalTransfer.update({
      where: { enrollmentId: newEnrollmentAId },
      data: { tcDownloaded: true, transcriptDownloaded: true },
    });
    const confirmSecond = await apiCall(`/api/v1/transfers/external/${newEnrollmentAId}/confirm`, {
      method: "POST",
      cookie: cookieAdminA,
      body: { documentsReviewed: true },
    });
    assert.equal(confirmSecond.status, 200);

    // Step 1: Admin A initiates Student 1's return to School B (in same organization)
    const initiateToSchoolB = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: student1.id,
        destinationSchoolId: schoolB.id,
        academicYearId: yearB.id,
        classGroupId: classB5.id,
        sectionId: sectionB5A.id,
        reason: "Returning to organization at partner School B",
      },
    });
    assert.equal(initiateToSchoolB.status, 201);
    assert.equal(initiateToSchoolB.json.status, "PENDING");

    // Verify Student master status is STILL WITHDRAWN before approval!
    const studentBeforeApproval = await prisma.student.findUnique({ where: { id: student1.id } });
    assert.equal(studentBeforeApproval?.status, "WITHDRAWN", "Student status must NOT become ACTIVE before approval");

    // Step 2: Admin B approves the return request into School B
    const returnReqId = initiateToSchoolB.json.request.id;
    const approveAtSchoolB = await apiCall(`/api/v1/transfer-requests/${returnReqId}/approve`, {
      method: "POST",
      cookie: cookieAdminB,
      body: {
        toAcademicYearId: yearB.id,
        toSectionId: sectionB5A.id,
      },
    });
    assert.equal(approveAtSchoolB.status, 200);

    // Verify Student master status is now ACTIVE, with same permanentId, and new enrollment at School B
    const studentAfterBApproval = await prisma.student.findUnique({ where: { id: student1.id } });
    assert.equal(studentAfterBApproval?.status, "ACTIVE");
    assert.equal(studentAfterBApproval?.permanentId, student1.permanentId);

    // Verify Student Profile at School B separates currentEnrollment (School B) from previousEnrollments (School A)
    const profileAtSchoolB = await apiCall(`/api/v1/students/${student1.id}`, {
      cookie: cookieAdminB,
    });
    assert.equal(profileAtSchoolB.status, 200);
    assert.equal(profileAtSchoolB.json.currentEnrollment.schoolId, schoolB.id);
    assert.equal(profileAtSchoolB.json.currentEnrollment.status, "ACTIVE");
    assert.equal(profileAtSchoolB.json.previousEnrollments.length, 2, "Both previous School A enrollments preserved");
    assert.ok(profileAtSchoolB.json.previousEnrollments.every((e: any) => e.schoolId === schoolA.id && e.status === "TRANSFERRED"));

    // =========================================================================
    // 7. Separate Erroneous Transfer Reversal Workflow (Student 2)
    // =========================================================================
    console.log("RT-09: Test separate Erroneous Transfer Reversal workflow on Student 2...");
    await apiCall("/api/v1/transfers/external/draft", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        enrollmentId: enrollment2.id,
        destinationSchoolName: "Mistaken School",
        reason: "Selected wrong student by mistake",
      },
    });
    await prisma.externalTransfer.update({
      where: { enrollmentId: enrollment2.id },
      data: { tcDownloaded: true, transcriptDownloaded: true },
    });
    await apiCall(`/api/v1/transfers/external/${enrollment2.id}/confirm`, {
      method: "POST",
      cookie: cookieAdminA,
      body: { documentsReviewed: true },
    });

    // Reverse the erroneous transfer
    const reverseRes = await apiCall(`/api/v1/transfers/external/${enrollment2.id}/reverse`, {
      method: "POST",
      cookie: cookieAdminA,
      body: { reason: "Transfer was confirmed in error for the wrong student" },
    });
    assert.equal(reverseRes.status, 200);
    assert.equal(reverseRes.json.transfer.status, "REVERSED");
    assert.equal(reverseRes.json.transfer.reversedByUserId, adminA.id);

    // Verify original enrollment2 is restored to ACTIVE (no new enrollment created) and student2 is ACTIVE
    const student2AfterReverse = await prisma.student.findUnique({
      where: { id: student2.id },
      include: { enrollments: true },
    });
    assert.equal(student2AfterReverse?.status, "ACTIVE");
    assert.equal(student2AfterReverse?.enrollments.length, 1);
    assert.equal(student2AfterReverse?.enrollments[0].id, enrollment2.id);
    assert.equal(student2AfterReverse?.enrollments[0].status, "ACTIVE");

    // Verify audit events were recorded
    const reenrollAudit = await prisma.auditEvent.findFirst({
      where: { schoolId: { in: [schoolA.id, schoolB.id] }, action: "STUDENT_REENROLLED" },
    });
    assert.ok(reenrollAudit, "STUDENT_REENROLLED audit event must be recorded");

    const reverseAudit = await prisma.auditEvent.findFirst({
      where: { schoolId: schoolA.id, action: "EXTERNAL_TRANSFER_REVERSED" },
    });
    assert.ok(reverseAudit, "EXTERNAL_TRANSFER_REVERSED audit event must be recorded");

    // =========================================================================
    // 8. Alumni Rules, Form 1 Secondary Progression, External Exam Marks & Multi-field Search
    // =========================================================================
    console.log("RT-10: Test Multi-field Search and Alumni exclusion in lookup-students...");
    // Create a Class 8 Graduate (Alumni) in School A
    const class8Group = await prisma.classGroup.create({
      data: {
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        level: "CLASS_8",
      },
    });
    const section8A = await prisma.section.create({
      data: {
        classGroupId: class8Group.id,
        name: "C8-A",
      },
    });

    const alumniStudent = await prisma.student.create({
      data: {
        organizationId: orgMain.id,
        permanentId: `STU-${stamp.slice(-2)}-P-000888`,
        firstName: "AlumniGrad",
        fatherName: "Mohamed",
        grandfatherName: "Ali",
        gender: "MALE",
        dateOfBirth: new Date("2011-04-10"),
        phone: "+252619998888",
        nationalId: `NIRA-ALUMNI-${stamp}`,
        status: "ALUMNI",
        isDemo: true,
      },
    });
    const class8Enrollment = await prisma.enrollment.create({
      data: {
        studentId: alumniStudent.id,
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        classGroupId: class8Group.id,
        sectionId: section8A.id,
        studentNumber: "00888",
        rollNumber: 1,
        status: "ALUMNI",
      },
    });
    await prisma.alumniRecord.create({
      data: {
        studentId: alumniStudent.id,
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        fromLevel: "CLASS_8",
        reason: "Graduated Class 8 Primary",
      },
    });

    // Test lookup with ELIGIBLE_FOR_RETURN filter: Alumni MUST NOT appear
    const lookupEligible = await apiCall(`/api/v1/transfers/lookup-students?status=ELIGIBLE_FOR_RETURN`, {
      cookie: cookieAdminA,
    });
    assert.equal(lookupEligible.status, 200);
    const alumniInEligible = lookupEligible.json.items.some((s: any) => s.id === alumniStudent.id);
    assert.equal(alumniInEligible, false, "Class 8 Alumni must not appear in eligible for return lookup");

    // Test searching by student name, ID, phone
    const searchByName = await apiCall(`/api/v1/transfers/lookup-students?q=AlumniGrad`, {
      cookie: cookieAdminA,
    });
    assert.equal(searchByName.status, 200);
    const foundAlumni = searchByName.json.items.find((s: any) => s.id === alumniStudent.id);
    assert.ok(foundAlumni, "Must find student by name");
    assert.equal(foundAlumni.isPrimaryAlumni, true, "isPrimaryAlumni flag must be true");
    assert.equal(foundAlumni.eligibleForReturn, false, "eligibleForReturn must be false for alumni");

    // RT-11: Attempting to return Class 8 Alumni via ordinary return workflow MUST fail with 400
    console.log("RT-11: Verify ordinary Return workflow rejects Class 8 Alumni with 400...");
    const reenrollAlumniFail = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: alumniStudent.id,
        academicYearId: yearA.id,
        sectionId: sectionA5A.id,
        reason: "Attempting to return alumni as primary",
      },
    });
    assert.equal(reenrollAlumniFail.status, 400, "Must reject Class 8 Alumni return with 400");
    assert.match(reenrollAlumniFail.json.message, /Alumni cannot be reactivated through the ordinary return workflow/);

    // RT-12: Ordinary internal transfer workflow MUST reject Alumni
    console.log("RT-12: Verify ordinary transfer-requests rejects Alumni...");
    const transferAlumniFail = await apiCall("/api/v1/transfer-requests", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        enrollmentIds: [class8Enrollment.id],
        toSchoolId: schoolB.id,
        note: "Transfer alumni to school B",
      },
    });
    assert.ok([400, 404].includes(transferAlumniFail.status), "Must reject Alumni transfer with 400 or 404");

    // RT-13: Secondary Admission for Class 8 Graduate into Form 1 at same school
    console.log("RT-13: Test Class 8 Graduate admission into Form 1 at same school...");
    // Create Form 1 in next academic year at School A
    const nextYearA = await prisma.academicYear.create({
      data: {
        schoolId: schoolA.id,
        name: `2027-2028`,
        startDate: new Date("2027-09-01"),
        endDate: new Date("2028-06-30"),
        isCurrent: false,
        isDemo: true,
      },
    });
    const form1Group = await prisma.classGroup.create({
      data: {
        schoolId: schoolA.id,
        academicYearId: nextYearA.id,
        level: "FORM_1",
      },
    });
    const form1Section = await prisma.section.create({
      data: {
        classGroupId: form1Group.id,
        name: "F1-A",
      },
    });

    const form1EnrollRes = await apiCall(`/api/v1/alumni/${alumniStudent.id}/enroll-form-1`, {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        toSchoolId: schoolA.id,
        academicYearId: nextYearA.id,
        sectionId: form1Section.id,
      },
    });
    assert.equal(form1EnrollRes.status, 201);
    assert.equal(form1EnrollRes.json.status, "COMPLETED");
    assert.ok(form1EnrollRes.json.secondaryPermanentId, "Must assign secondary permanent ID");
    assert.match(form1EnrollRes.json.secondaryPermanentId, /^STU-\d{2}-S-\d{6}$/);

    // Verify Master identity preserved, old Class 8 enrollment remains ALUMNI, new Form 1 enrollment is ACTIVE
    const alumniStudentAfterForm1 = await prisma.student.findUnique({
      where: { id: alumniStudent.id },
      include: { enrollments: { include: { classGroup: true } } },
    });
    assert.equal(alumniStudentAfterForm1?.status, "ACTIVE");
    assert.equal(alumniStudentAfterForm1?.permanentId, alumniStudent.permanentId);
    assert.equal(alumniStudentAfterForm1?.secondaryPermanentId, form1EnrollRes.json.secondaryPermanentId);
    assert.equal(alumniStudentAfterForm1?.enrollments.length, 2);
    const oldC8 = alumniStudentAfterForm1?.enrollments.find((e) => e.classGroup.level === "CLASS_8");
    const newF1 = alumniStudentAfterForm1?.enrollments.find((e) => e.classGroup.level === "FORM_1");
    assert.equal(oldC8?.status, "ALUMNI", "Old Class 8 enrollment must remain ALUMNI");
    assert.equal(newF1?.status, "ACTIVE", "New Form 1 enrollment must be ACTIVE");

    // RT-14: Return Student with External Examination Marks
    console.log("RT-14: Test returning student with optional verified External Examination Marks...");
    const studentReturningWithMarks = await prisma.student.create({
      data: {
        organizationId: orgMain.id,
        permanentId: `STU-${stamp.slice(-2)}-P-000777`,
        firstName: "ReturningWithMarks",
        fatherName: "Hassan",
        grandfatherName: "Farah",
        gender: "FEMALE",
        dateOfBirth: new Date("2013-05-15"),
        status: "WITHDRAWN",
        isDemo: true,
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentReturningWithMarks.id,
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        classGroupId: classA5.id,
        sectionId: sectionA5A.id,
        studentNumber: "00777",
        rollNumber: 99,
        status: "TRANSFERRED",
      },
    });

    const reenrollWithMarksRes = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminA,
      body: {
        studentId: studentReturningWithMarks.id,
        academicYearId: yearA.id,
        sectionId: sectionA5B.id,
        reason: "Returned from another city after 1 term",
        externalExamMarks: [
          {
            originSchool: "Puntland Academy",
            subject: "English",
            marksObtained: 88,
            maxMarks: 100,
            gradeOrClass: "Class 5",
            examYear: "2026/2027",
            isVerified: true,
            notes: "Verified with official stamp and transcript",
          },
          {
            originSchool: "Puntland Academy",
            subject: "Mathematics",
            marksObtained: 92,
            maxMarks: 100,
            gradeOrClass: "Class 5",
            examYear: "2026/2027",
            isVerified: false,
            notes: "Pending documentary verification",
          },
        ],
      },
    });
    assert.equal(reenrollWithMarksRes.status, 201);
    assert.equal(reenrollWithMarksRes.json.status, "COMPLETED");

    // Verify external exam records created and distinct from official exam results
    const externalRecords = await prisma.externalExamRecord.findMany({
      where: { studentId: studentReturningWithMarks.id },
      orderBy: { subject: "asc" },
    });
    assert.equal(externalRecords.length, 2);
    assert.equal(externalRecords[0].subject, "English");
    assert.equal(externalRecords[0].marksObtained, 88);
    assert.equal(externalRecords[0].isVerified, true);
    assert.equal(externalRecords[0].verifiedByUserId, adminA.id);

    assert.equal(externalRecords[1].subject, "Mathematics");
    assert.equal(externalRecords[1].marksObtained, 92);
    assert.equal(externalRecords[1].isVerified, false);

    // Verify student profile API returns externalExamRecords
    const profileWithMarks = await apiCall(`/api/v1/students/${studentReturningWithMarks.id}`, {
      cookie: cookieAdminA,
    });
    assert.equal(profileWithMarks.status, 200);
    assert.equal(profileWithMarks.json.externalExamRecords.length, 2);

    // Test verifying an unverified external mark via PATCH API
    const unverifiedRecord = externalRecords.find((r) => !r.isVerified)!;
    const verifyMarkRes = await apiCall(
      `/api/v1/students/${studentReturningWithMarks.id}/external-marks/${unverifiedRecord.id}/verify`,
      {
        method: "PATCH",
        cookie: cookieAdminA,
        body: { isVerified: true },
      },
    );
    assert.equal(verifyMarkRes.status, 200);
    assert.equal(verifyMarkRes.json.isVerified, true);
    assert.equal(verifyMarkRes.json.verifiedByUserId, adminA.id);

    console.log("ALL STUDENT RE-ENROLLMENT & ORGANIZATION-WIDE TRANSFER TESTS PASSED!");
  } finally {
    await prisma.externalExamRecord.deleteMany({ where: { student: { organizationId: { in: createdOrgs } } } });
    await prisma.alumniRecord.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.auditEvent.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.transferRequest.deleteMany({ where: { fromSchoolId: { in: createdSchools } } });
    await prisma.externalTransfer.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.attendanceRecord.deleteMany({
      where: { enrollment: { schoolId: { in: createdSchools } } },
    });
    await prisma.subjectResult.deleteMany({
      where: { enrollment: { schoolId: { in: createdSchools } } },
    });
    await prisma.examSubject.deleteMany({
      where: { exam: { schoolId: { in: createdSchools } } },
    });
    await prisma.examSection.deleteMany({
      where: { exam: { schoolId: { in: createdSchools } } },
    });
    await prisma.exam.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.classSubject.deleteMany({
      where: { classGroup: { schoolId: { in: createdSchools } } },
    });
    await prisma.subject.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.enrollment.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.section.deleteMany({ where: { classGroup: { schoolId: { in: createdSchools } } } });
    await prisma.classGroup.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.academicYear.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.user.deleteMany({ where: { schoolId: { in: createdSchools } } });
    await prisma.student.deleteMany({ where: { organizationId: { in: createdOrgs } } });
    await prisma.school.deleteMany({ where: { id: { in: createdSchools } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgs } } });

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
