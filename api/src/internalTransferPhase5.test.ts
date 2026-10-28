import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";
import { createApp } from "./app.js";
import type { Server } from "node:http";

test("Phase 5: Internal Transfer & Form 1 Progression test suite", async () => {
  try {
    const app = createApp();
    let server!: Server;
    const port = 4288;
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

  // 1. Create a primary test organization and a foreign test organization
  const primaryOrg = await prisma.organization.create({
    data: {
      name: `Org Main ${stamp}`,
    },
  });

  const foreignOrg = await prisma.organization.create({
    data: {
      name: `Org Foreign ${stamp}`,
    },
  });

  // 2. Setup schools within the primary organization
  const primarySchool = await prisma.school.create({
    data: {
      name: `Primary P5 ${stamp}`,
      code: `P5P${stamp.slice(-3)}`,
      type: "PRIMARY_ONLY",
      organizationId: primaryOrg.id,
      isActive: true,
      isDemo: true,
    },
  });

  const secondarySchool = await prisma.school.create({
    data: {
      name: `Secondary P5 ${stamp}`,
      code: `P5S${stamp.slice(-3)}`,
      type: "SECONDARY_ONLY",
      organizationId: primaryOrg.id,
      isActive: true,
      isDemo: true,
    },
  });

  const primarySchoolB = await prisma.school.create({
    data: {
      name: `Primary B P5 ${stamp}`,
      code: `P5B${stamp.slice(-3)}`,
      type: "PRIMARY_ONLY",
      organizationId: primaryOrg.id,
      isActive: true,
      isDemo: true,
    },
  });

  // A third school in the foreign organization
  const foreignSchool = await prisma.school.create({
    data: {
      name: `Foreign P5 ${stamp}`,
      code: `P5F${stamp.slice(-3)}`,
      type: "PRIMARY_ONLY",
      organizationId: foreignOrg.id,
      isActive: true,
      isDemo: true,
    },
  });

  const primaryAdmin = await prisma.user.create({
    data: {
      email: `admin-pri-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "Primary",
      schoolId: primarySchool.id,
      isDemo: true,
    },
  });

  const secondaryAdmin = await prisma.user.create({
    data: {
      email: `admin-sec-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "Secondary",
      schoolId: secondarySchool.id,
      isDemo: true,
    },
  });

  const priBAdmin = await prisma.user.create({
    data: {
      email: `admin-prib-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "PrimaryB",
      schoolId: primarySchoolB.id,
      isDemo: true,
    },
  });

  const foreignAdmin = await prisma.user.create({
    data: {
      email: `admin-for-${stamp}@demo.test`,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "Foreign",
      schoolId: foreignSchool.id,
      isDemo: true,
    },
  });

  const cookiePri = `emp_access=${signAccessToken({ sub: primaryAdmin.id, role: "SCHOOL_ADMIN", schoolId: primarySchool.id })}`;
  const cookieSec = `emp_access=${signAccessToken({ sub: secondaryAdmin.id, role: "SCHOOL_ADMIN", schoolId: secondarySchool.id })}`;
  const cookiePriB = `emp_access=${signAccessToken({ sub: priBAdmin.id, role: "SCHOOL_ADMIN", schoolId: primarySchoolB.id })}`;
  const cookieFor = `emp_access=${signAccessToken({ sub: foreignAdmin.id, role: "SCHOOL_ADMIN", schoolId: foreignSchool.id })}`;

  // Academic Years & Classes for primarySchool
  const priYear = await prisma.academicYear.create({
    data: {
      schoolId: primarySchool.id,
      name: `2026 Pri ${stamp}`,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      isCurrent: true,
    },
  });

  const priClass4Group = await prisma.classGroup.create({
    data: {
      schoolId: primarySchool.id,
      academicYearId: priYear.id,
      level: "CLASS_4",
    },
  });

  const priClass4SecA = await prisma.section.create({
    data: {
      classGroupId: priClass4Group.id,
      name: "A",
    },
  });

  // Academic Years & Classes for primarySchoolB
  const priBYear = await prisma.academicYear.create({
    data: {
      schoolId: primarySchoolB.id,
      name: `2026 Pri ${stamp}`, // same academic year name
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      isCurrent: true,
    },
  });

  const priBClass4Group = await prisma.classGroup.create({
    data: {
      schoolId: primarySchoolB.id,
      academicYearId: priBYear.id,
      level: "CLASS_4",
    },
  });

  const priBClass4SecA = await prisma.section.create({
    data: {
      classGroupId: priBClass4Group.id,
      name: "A",
    },
  });

  // Academic Years & Classes for secondarySchool
  const secYear = await prisma.academicYear.create({
    data: {
      schoolId: secondarySchool.id,
      name: `2027 Sec ${stamp}`,
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-12-31"),
      isCurrent: true,
    },
  });

  const secForm1Group = await prisma.classGroup.create({
    data: {
      schoolId: secondarySchool.id,
      academicYearId: secYear.id,
      level: "FORM_1",
    },
  });

  const secForm1SecA = await prisma.section.create({
    data: {
      classGroupId: secForm1Group.id,
      name: "A",
    },
  });

  // Create Student 1 for Internal Transfer (Class 4)
  const student1 = await prisma.student.create({
    data: {
      organizationId: primaryOrg.id,
      permanentId: `STU-P5-001-${stamp}`,
      firstName: "Internal",
      fatherName: "Transfer",
      grandfatherName: "Student",
      gender: "MALE",
      dateOfBirth: new Date("2014-05-15"),
      status: "ACTIVE",
    },
  });

  const enrollment1 = await prisma.enrollment.create({
    data: {
      studentId: student1.id,
      schoolId: primarySchool.id,
      academicYearId: priYear.id,
      classGroupId: priClass4Group.id,
      sectionId: priClass4SecA.id,
      studentNumber: `SN-${stamp}-1`,
      rollNumber: 1,
      status: "ACTIVE",
    },
  });

  try {
    console.log("TC-P5-01: Reject internal transfer between different organizations...");
    const diffOrgRes = await apiCall("/api/v1/transfer-requests", {
      method: "POST",
      cookie: cookiePri,
      body: {
        enrollmentIds: [enrollment1.id],
        toSchoolId: foreignSchool.id,
        note: "Cross org attempt",
      },
    });
    assert.equal(diffOrgRes.status, 400);

    console.log("TC-P5-02: Create valid internal transfer request within same organization...");
    const createReqRes = await apiCall("/api/v1/transfer-requests", {
      method: "POST",
      cookie: cookiePri,
      body: {
        enrollmentIds: [enrollment1.id],
        toSchoolId: primarySchoolB.id,
        note: "Relocation to branch B",
      },
    });
    assert.equal(createReqRes.status, 201);
    assert.equal(createReqRes.json.count, 1);

    // Verify audit log for creation
    const auditCreate = await prisma.auditEvent.findFirst({
      where: { schoolId: primarySchool.id, action: "TRANSFER_REQUEST_CREATED" },
    });
    assert.ok(auditCreate);

    console.log("TC-P5-03: Prevent duplicate active transfer requests for the same student...");
    const dupReqRes = await apiCall("/api/v1/transfer-requests", {
      method: "POST",
      cookie: cookiePri,
      body: {
        enrollmentIds: [enrollment1.id],
        toSchoolId: primarySchoolB.id,
        note: "Duplicate attempt",
      },
    });
    assert.equal(dupReqRes.status, 409);

    console.log("TC-P5-04: Reject internal transfer request by destination admin...");
    const listRes = await apiCall("/api/v1/transfer-requests", { cookie: cookiePriB });
    assert.equal(listRes.status, 200);
    const reqItem = listRes.json.find((r: any) => r.studentId === student1.id);
    assert.ok(reqItem);
    assert.equal(reqItem.status, "PENDING");

    const rejectRes = await apiCall(`/api/v1/transfer-requests/${reqItem.id}/reject`, {
      method: "POST",
      cookie: cookiePriB,
      body: { reason: "Section full" },
    });
    assert.equal(rejectRes.status, 200);

    const rejectedReq = await prisma.transferRequest.findUnique({ where: { id: reqItem.id } });
    assert.equal(rejectedReq?.status, "REJECTED");
    assert.equal(rejectedReq?.rejectReason, "Section full");

    console.log("TC-P5-05: Source enrollment history and student master status intact after rejection...");
    const enrollAfterReject = await prisma.enrollment.findUnique({ where: { id: enrollment1.id } });
    const studentAfterReject = await prisma.student.findUnique({ where: { id: student1.id } });
    assert.equal(enrollAfterReject?.status, "ACTIVE");
    assert.equal(studentAfterReject?.status, "ACTIVE");

    console.log("TC-P5-06: Approve internal transfer into destination section...");
    // Re-create request for student1
    const createReq2 = await apiCall("/api/v1/transfer-requests", {
      method: "POST",
      cookie: cookiePri,
      body: {
        enrollmentIds: [enrollment1.id],
        toSchoolId: primarySchoolB.id,
        note: "Approved retry",
      },
    });
    assert.equal(createReq2.status, 201);

    const list2 = await apiCall("/api/v1/transfer-requests", { cookie: cookiePriB });
    const req2 = list2.json.find((r: any) => r.studentId === student1.id && r.status === "PENDING");
    assert.ok(req2);

    // Reject if unauthorized foreign admin attempts to approve
    const unauthApprove = await apiCall(`/api/v1/transfer-requests/${req2.id}/approve`, {
      method: "POST",
      cookie: cookieFor,
      body: {
        toAcademicYearId: priBYear.id,
        toSectionId: priBClass4SecA.id,
      },
    });
    assert.equal(unauthApprove.status, 404); // Destination school scope check

    // Legitimate approve by destination admin
    const approveRes = await apiCall(`/api/v1/transfer-requests/${req2.id}/approve`, {
      method: "POST",
      cookie: cookiePriB,
      body: {
        toAcademicYearId: priBYear.id,
        toSectionId: priBClass4SecA.id,
      },
    });
    assert.equal(approveRes.status, 200);

    console.log("TC-P5-07: Verify internal transfer database state changes...");
    // 1. Source enrollment marked TRANSFERRED
    const sourceEnrollAfter = await prisma.enrollment.findUnique({ where: { id: enrollment1.id } });
    assert.equal(sourceEnrollAfter?.status, "TRANSFERRED");

    // 2. Destination enrollment created as ACTIVE
    const destEnroll = await prisma.enrollment.findFirst({
      where: {
        studentId: student1.id,
        schoolId: primarySchoolB.id,
        academicYearId: priBYear.id,
        sectionId: priBClass4SecA.id,
      },
    });
    assert.ok(destEnroll);
    assert.equal(destEnroll.status, "ACTIVE");
    assert.notEqual(destEnroll.id, enrollment1.id); // distinct enrollment ID

    // 3. Student master record stays ACTIVE with same permanentId
    const studentAfterApprove = await prisma.student.findUnique({ where: { id: student1.id } });
    assert.equal(studentAfterApprove?.status, "ACTIVE");
    assert.equal(studentAfterApprove?.permanentId, student1.permanentId);

    // 4. Request marked COMPLETED
    const completedReq = await prisma.transferRequest.findUnique({ where: { id: req2.id } });
    assert.equal(completedReq?.status, "COMPLETED");

    // 5. Prevent duplicate approval
    const dupApprove = await apiCall(`/api/v1/transfer-requests/${req2.id}/approve`, {
      method: "POST",
      cookie: cookiePriB,
      body: {
        toAcademicYearId: priBYear.id,
        toSectionId: priBClass4SecA.id,
      },
    });
    assert.equal(dupApprove.status, 404); // Request is no longer PENDING or WAITING_FOR_SECTION

    console.log("TC-P5-08: Class 8 to Form 1 Progression...");
    // Setup Class 8 graduate
    const priClass8Group = await prisma.classGroup.create({
      data: {
        schoolId: primarySchool.id,
        academicYearId: priYear.id,
        level: "CLASS_8",
      },
    });

    const priClass8SecA = await prisma.section.create({
      data: {
        classGroupId: priClass8Group.id,
        name: "A",
      },
    });

    const studentGrad = await prisma.student.create({
      data: {
        organizationId: primaryOrg.id,
        permanentId: `STU-P5-GRAD-${stamp}`,
        firstName: "ClassEight",
        fatherName: "Graduate",
        grandfatherName: "Student",
        gender: "FEMALE",
        dateOfBirth: new Date("2010-03-20"),
        status: "ALUMNI",
      },
    });

    const enrollGrad = await prisma.enrollment.create({
      data: {
        studentId: studentGrad.id,
        schoolId: primarySchool.id,
        academicYearId: priYear.id,
        classGroupId: priClass8Group.id,
        sectionId: priClass8SecA.id,
        studentNumber: `SN-${stamp}-8`,
        rollNumber: 8,
        status: "ALUMNI",
      },
    });

    const alumniRecord = await prisma.alumniRecord.create({
      data: {
        studentId: studentGrad.id,
        schoolId: primarySchool.id,
        academicYearId: priYear.id,
        fromLevel: "CLASS_8",
        reason: "Class 8 completion",
      },
    });

    // 1. Ineligible student rejection test (non-alumni or non-Class-8 cannot do Form 1 progression)
    const ineligRes = await apiCall(`/api/v1/alumni/${student1.id}/enroll-form-1`, {
      method: "POST",
      cookie: cookiePri,
      body: { toSchoolId: secondarySchool.id },
    });
    assert.equal(ineligRes.status, 400);

    // 2. Reject progression to school in a different organization
    const diffOrgForm1 = await apiCall(`/api/v1/alumni/${studentGrad.id}/enroll-form-1`, {
      method: "POST",
      cookie: cookiePri,
      body: { toSchoolId: foreignSchool.id },
    });
    assert.equal(diffOrgForm1.status, 400);

    // 3. Initiate Form 1 continuation request from primary to secondary school
    const form1ReqRes = await apiCall(`/api/v1/alumni/${studentGrad.id}/enroll-form-1`, {
      method: "POST",
      cookie: cookiePri,
      body: {
        toSchoolId: secondarySchool.id,
      },
    });
    assert.equal(form1ReqRes.status, 201);
    assert.equal(form1ReqRes.json.status, "PENDING");

    // 4. Destination secondary admin accepts Form 1 continuation and places student into Form 1 section
    const secList = await apiCall("/api/v1/transfer-requests", { cookie: cookieSec });
    assert.equal(secList.status, 200);
    const form1Req = secList.json.find((r: any) => r.studentId === studentGrad.id);
    assert.ok(form1Req);
    assert.equal(form1Req.kind, "FORM_1");

    const acceptForm1Res = await apiCall(`/api/v1/transfer-requests/${form1Req.id}/approve`, {
      method: "POST",
      cookie: cookieSec,
      body: {
        toAcademicYearId: secYear.id,
        toSectionId: secForm1SecA.id,
      },
    });
    assert.equal(acceptForm1Res.status, 200);
    assert.ok(acceptForm1Res.json.secondaryPermanentId);

    console.log("TC-P5-09: Verify Form 1 progression preserved primary history and recorded secondary enrollment...");
    // 1. Primary enrollment remains intact as ALUMNI
    const primaryEnrollAfter = await prisma.enrollment.findUnique({ where: { id: enrollGrad.id } });
    assert.equal(primaryEnrollAfter?.status, "ALUMNI");

    // 2. Alumni record remains intact
    const alumniAfter = await prisma.alumniRecord.findUnique({ where: { id: alumniRecord.id } });
    assert.ok(alumniAfter);

    // 3. Form 1 enrollment created as ACTIVE
    const form1Enroll = await prisma.enrollment.findFirst({
      where: {
        studentId: studentGrad.id,
        schoolId: secondarySchool.id,
        academicYearId: secYear.id,
        sectionId: secForm1SecA.id,
      },
    });
    assert.ok(form1Enroll);
    assert.equal(form1Enroll.status, "ACTIVE");

    // 4. Student master status is ACTIVE, keeps permanentId, and has stage-specific secondaryPermanentId
    const gradStudentAfter = await prisma.student.findUnique({ where: { id: studentGrad.id } });
    assert.equal(gradStudentAfter?.status, "ACTIVE");
    assert.equal(gradStudentAfter?.permanentId, `STU-P5-GRAD-${stamp}`);
    assert.ok(gradStudentAfter?.secondaryPermanentId?.startsWith("STU-"));

    // 5. Audit logs recorded
    const auditForm1 = await prisma.auditEvent.findFirst({
      where: { schoolId: secondarySchool.id, action: "TRANSFER_REQUEST_COMPLETED" },
    });
    assert.ok(auditForm1);

    console.log("All Phase 5 Internal Transfer and Form 1 Progression tests PASSED!");
  } finally {
    // Teardown test data
    await prisma.auditEvent.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.transferRequest.deleteMany({
      where: { fromSchoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.alumniRecord.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.enrollment.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.section.deleteMany({
      where: { classGroup: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } } },
    });
    await prisma.classGroup.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.academicYear.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.student.deleteMany({
      where: { organizationId: { in: [primaryOrg.id, foreignOrg.id] } },
    });
    await prisma.user.deleteMany({
      where: { schoolId: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.school.deleteMany({
      where: { id: { in: [primarySchool.id, secondarySchool.id, foreignSchool.id, primarySchoolB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [primaryOrg.id, foreignOrg.id] } },
    });

    server?.close();
  }
  } catch (err) {
    console.error("TEST FAILED WITH ERROR:", err);
    throw err;
  }
});
