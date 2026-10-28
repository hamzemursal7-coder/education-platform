import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";
import { createApp } from "./app.js";

test("Parent Portal Student Status: Re-enrollment, Genuinely Transferred, Multiple Children, and Historical Preservation", async () => {
  const app = createApp();
  let server!: Server;
  const port = 4293;
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
      // ignore
    }
    return { status: res.status, text, json };
  }

  const stamp = Date.now().toString().slice(-8);

  try {
    // 1. Organization & Schools Setup
    const org = await prisma.organization.create({
      data: { name: `Parent Test Org ${stamp}`, isDemo: true },
    });

    const schoolA = await prisma.school.create({
      data: {
        name: `School Alpha ${stamp}`,
        code: `SA${stamp.slice(-4)}`,
        type: "PRIMARY_AND_SECONDARY",
        organizationId: org.id,
        isActive: true,
        isDemo: true,
      },
    });

    const schoolB = await prisma.school.create({
      data: {
        name: `School Beta ${stamp}`,
        code: `SB${stamp.slice(-4)}`,
        type: "PRIMARY_AND_SECONDARY",
        organizationId: org.id,
        isActive: true,
        isDemo: true,
      },
    });

    // Academic Structure for School A
    const yearA = await prisma.academicYear.create({
      data: {
        schoolId: schoolA.id,
        name: "2026-2027",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-06-30"),
        isCurrent: true,
        isDemo: true,
      },
    });

    const classA6 = await prisma.classGroup.create({
      data: {
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        level: "CLASS_6",
      },
    });

    const sectionA6 = await prisma.section.create({
      data: {
        classGroupId: classA6.id,
        name: "A",
      },
    });

    // Academic Structure for School B
    const yearB = await prisma.academicYear.create({
      data: {
        schoolId: schoolB.id,
        name: "2026-2027",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-06-30"),
        isCurrent: true,
        isDemo: true,
      },
    });

    const classB7 = await prisma.classGroup.create({
      data: {
        schoolId: schoolB.id,
        academicYearId: yearB.id,
        level: "CLASS_7",
      },
    });

    const sectionB7 = await prisma.section.create({
      data: {
        classGroupId: classB7.id,
        name: "B",
      },
    });

    // Users: School Admin A, School Admin B and Parent
    const adminA = await prisma.user.create({
      data: {
        email: `admin-a-${stamp}@demo.test`,
        role: "SCHOOL_ADMIN",
        status: "ACTIVE",
        firstName: "Admin",
        lastName: "Alpha",
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
        lastName: "Beta",
        schoolId: schoolB.id,
        isDemo: true,
      },
    });
    const cookieAdminB = `emp_access=${signAccessToken({ sub: adminB.id, role: "SCHOOL_ADMIN", schoolId: schoolB.id })}`;

    const parentUser = await prisma.user.create({
      data: {
        email: `parent-${stamp}@demo.test`,
        role: "PARENT",
        status: "ACTIVE",
        firstName: "Mohamed",
        lastName: "Farah",
        isDemo: true,
      },
    });
    const cookieParent = `emp_access=${signAccessToken({ sub: parentUser.id, role: "PARENT", schoolId: null })}`;

    // Guardian record
    const guardian = await prisma.guardian.create({
      data: {
        organizationId: org.id,
        userId: parentUser.id,
        publicId: `GRD-${stamp}`,
        firstName: "Mohamed",
        lastName: "Farah",
        phone: "+252615000000",
        registeredSchoolId: schoolA.id,
      },
    });

    // Create Child 1 (will be transferred out and then re-enrolled)
    const child1 = await prisma.student.create({
      data: {
        organizationId: org.id,
        permanentId: `STU-PAR-1-${stamp}`,
        firstName: "Saakir",
        fatherName: "Mohamed",
        grandfatherName: "Farah",
        gender: "MALE",
        dateOfBirth: new Date("2014-05-15"),
        status: "ACTIVE",
        isDemo: true,
      },
    });

    const enrollment1 = await prisma.enrollment.create({
      data: {
        studentId: child1.id,
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        classGroupId: classA6.id,
        sectionId: sectionA6.id,
        studentNumber: `00001`,
        rollNumber: 1,
        status: "ACTIVE",
      },
    });

    // Create Child 2 (will remain genuinely transferred out)
    const child2 = await prisma.student.create({
      data: {
        organizationId: org.id,
        permanentId: `STU-PAR-2-${stamp}`,
        firstName: "Hodan",
        fatherName: "Mohamed",
        grandfatherName: "Farah",
        gender: "FEMALE",
        dateOfBirth: new Date("2016-08-20"),
        status: "ACTIVE",
        isDemo: true,
      },
    });

    const enrollment2 = await prisma.enrollment.create({
      data: {
        studentId: child2.id,
        schoolId: schoolA.id,
        academicYearId: yearA.id,
        classGroupId: classA6.id,
        sectionId: sectionA6.id,
        studentNumber: `00002`,
        rollNumber: 2,
        status: "ACTIVE",
      },
    });

    // Link both children to the parent
    await prisma.studentGuardian.createMany({
      data: [
        { studentId: child1.id, guardianId: guardian.id, relationship: "FATHER" },
        { studentId: child2.id, guardianId: guardian.id, relationship: "FATHER" },
      ],
    });

    // -------------------------------------------------------------------------
    // Scenario A: Initially both children are ACTIVE
    // -------------------------------------------------------------------------
    const initialChildren = await apiCall("/api/v1/parent/children", { cookie: cookieParent });
    assert.equal(initialChildren.status, 200);
    assert.equal(initialChildren.json.length, 2);
    const initC1 = initialChildren.json.find((c: any) => c.id === child1.id);
    const initC2 = initialChildren.json.find((c: any) => c.id === child2.id);
    assert.equal(initC1.status, "ACTIVE");
    assert.equal(initC1.isTransferred, false);
    assert.equal(initC2.status, "ACTIVE");
    assert.equal(initC2.isTransferred, false);

    // -------------------------------------------------------------------------
    // Scenario B: Transfer Out both children
    // -------------------------------------------------------------------------
    // Child 1 external transfer
    const tc1 = `TC-EXT-1-${stamp}`;
    await prisma.externalTransfer.create({
      data: {
        schoolId: schoolA.id,
        studentId: child1.id,
        enrollmentId: enrollment1.id,
        initiatedByUserId: adminA.id,
        certificateNumber: tc1,
        destinationSchoolName: "International Global School",
        reason: "Family relocation",
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    await prisma.enrollment.update({
      where: { id: enrollment1.id },
      data: { status: "TRANSFERRED" },
    });
    await prisma.student.update({
      where: { id: child1.id },
      data: { status: "WITHDRAWN" },
    });

    // Child 2 external transfer
    const tc2 = `TC-EXT-2-${stamp}`;
    await prisma.externalTransfer.create({
      data: {
        schoolId: schoolA.id,
        studentId: child2.id,
        enrollmentId: enrollment2.id,
        initiatedByUserId: adminA.id,
        certificateNumber: tc2,
        destinationSchoolName: "City Academy",
        reason: "Moving abroad",
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    await prisma.enrollment.update({
      where: { id: enrollment2.id },
      data: { status: "TRANSFERRED" },
    });
    await prisma.student.update({
      where: { id: child2.id },
      data: { status: "WITHDRAWN" },
    });

    // Test Requirement 2: Parent viewing students who are genuinely transferred out
    const transferredChildren = await apiCall("/api/v1/parent/children", { cookie: cookieParent });
    assert.equal(transferredChildren.status, 200);
    const transC1 = transferredChildren.json.find((c: any) => c.id === child1.id);
    const transC2 = transferredChildren.json.find((c: any) => c.id === child2.id);
    assert.equal(transC1.status, "TRANSFERRED");
    assert.equal(transC1.isTransferred, true);
    assert.equal(transC1.isReenrolled, false);
    assert.equal(transC1.certificateNumber, tc1);
    assert.equal(transC1.destinationSchool, "International Global School");

    assert.equal(transC2.status, "TRANSFERRED");
    assert.equal(transC2.isTransferred, true);
    assert.equal(transC2.isReenrolled, false);
    assert.equal(transC2.certificateNumber, tc2);
    assert.equal(transC2.destinationSchool, "City Academy");

    // Check Child Detail Endpoint while transferred
    const detailC1Trans = await apiCall(`/api/v1/parent/children/${child1.id}`, { cookie: cookieParent });
    assert.equal(detailC1Trans.status, 200);
    assert.equal(detailC1Trans.json.status, "TRANSFERRED");
    assert.equal(detailC1Trans.json.isTransferred, true);
    assert.equal(detailC1Trans.json.transferDetails.certificateNumber, tc1);

    // -------------------------------------------------------------------------
    // Scenario C: Re-enroll Child 1 into School B (or School A)
    // -------------------------------------------------------------------------
    // Destination School Admin (School B) executes return/re-enrollment via API
    const reenrollRes = await apiCall("/api/v1/transfers/reenroll", {
      method: "POST",
      cookie: cookieAdminB,
      body: {
        studentId: child1.id,
        destinationSchoolId: schoolB.id,
        academicYearId: yearB.id,
        classGroupId: classB7.id,
        sectionId: sectionB7.id,
        reason: "Family returned to town, resuming studies",
      },
    });
    assert.equal(reenrollRes.status, 201);
    assert.equal(reenrollRes.json.status, "COMPLETED");
    assert.equal(reenrollRes.json.studentStatus, "ACTIVE");

    // Test Requirement 4: Refreshing Parent Portal immediately reflects re-enrollment
    // Test Requirement 1: Parent viewing student transferred out and then re-enrolled
    // Test Requirement 3: Parent with multiple children in DIFFERENT enrollment states
    const refreshedChildren = await apiCall("/api/v1/parent/children", { cookie: cookieParent });
    assert.equal(refreshedChildren.status, 200);
    assert.equal(refreshedChildren.json.length, 2);

    const reC1 = refreshedChildren.json.find((c: any) => c.id === child1.id);
    const reC2 = refreshedChildren.json.find((c: any) => c.id === child2.id);

    // Child 1 is re-enrolled: status MUST be ACTIVE, isTransferred MUST be false, isReenrolled MUST be true
    assert.equal(reC1.status, "ACTIVE", "Re-enrolled student must have status ACTIVE in Parent Portal");
    assert.equal(reC1.isTransferred, false, "Re-enrolled student must NOT have isTransferred: true");
    assert.equal(reC1.isReenrolled, true, "Re-enrolled student must have isReenrolled: true");
    assert.equal(reC1.school, `School Beta ${stamp}`, "Re-enrolled student current school must be destination school");
    assert.equal(reC1.level, "Class 7", "Re-enrolled student level must be destination class");
    assert.equal(reC1.section, "B", "Re-enrolled student section must be destination section");

    // Child 2 remains genuinely transferred out: status MUST be TRANSFERRED, isTransferred MUST be true
    assert.equal(reC2.status, "TRANSFERRED", "Genuinely transferred child must retain TRANSFERRED status");
    assert.equal(reC2.isTransferred, true, "Genuinely transferred child must retain isTransferred: true");
    assert.equal(reC2.isReenrolled, false, "Genuinely transferred child must have isReenrolled: false");

    // Test Requirement 5: Preserving historical transfer information while showing correct current status
    const detailC1Reenrolled = await apiCall(`/api/v1/parent/children/${child1.id}`, { cookie: cookieParent });
    assert.equal(detailC1Reenrolled.status, 200);
    assert.equal(detailC1Reenrolled.json.status, "ACTIVE", "Child detail status must be ACTIVE");
    assert.equal(detailC1Reenrolled.json.isTransferred, false, "Child detail isTransferred must be false");
    assert.equal(detailC1Reenrolled.json.isReenrolled, true, "Child detail isReenrolled must be true");
    assert.match(
      detailC1Reenrolled.json.reenrollmentMessage,
      /re-enrollment has been approved/i,
      "Re-enrollment notification message must be provided in child details",
    );

    // Historical transfer details MUST be preserved and accessible
    assert.ok(detailC1Reenrolled.json.transferDetails, "Historical transferDetails must be preserved");
    assert.equal(detailC1Reenrolled.json.transferDetails.certificateNumber, tc1);
    assert.equal(detailC1Reenrolled.json.transferDetails.destinationSchool, "International Global School");

    // Historical enrollments MUST have both current ACTIVE enrollment and historical TRANSFERRED enrollment
    assert.equal(detailC1Reenrolled.json.enrollments.length, 2, "Both enrollments must be preserved");
    const activeEnrollment = detailC1Reenrolled.json.enrollments.find((e: any) => e.status === "ACTIVE");
    const transferredEnrollment = detailC1Reenrolled.json.enrollments.find((e: any) => e.status === "TRANSFERRED");
    assert.ok(activeEnrollment, "ACTIVE enrollment must exist in history");
    assert.equal(activeEnrollment.school, `School Beta ${stamp}`);
    assert.ok(transferredEnrollment, "Historical TRANSFERRED enrollment must be preserved in history");
    assert.equal(transferredEnrollment.school, `School Alpha ${stamp}`);

    // Child 2 detail view remains TRANSFERRED
    const detailC2Trans = await apiCall(`/api/v1/parent/children/${child2.id}`, { cookie: cookieParent });
    assert.equal(detailC2Trans.status, 200);
    assert.equal(detailC2Trans.json.status, "TRANSFERRED");
    assert.equal(detailC2Trans.json.isTransferred, true);
    assert.equal(detailC2Trans.json.isReenrolled, false);
    assert.equal(detailC2Trans.json.transferDetails.certificateNumber, tc2);

    // Verify parent attendance endpoint also reflects active enrollment
    const attendanceRes = await apiCall(`/api/v1/parent/attendance?child=${child1.id}`, { cookie: cookieParent });
    assert.equal(attendanceRes.status, 200);
    const childInAttendance = attendanceRes.json.children.find((c: any) => c.id === child1.id);
    assert.equal(childInAttendance.school, `School Beta ${stamp}`);
  } finally {
    server?.close();
  }
});
