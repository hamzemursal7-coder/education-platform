import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";
import { createApp } from "./app.js";
import type { Server } from "node:http";

test("Phase 1: External Transfer Database & Draft functionality", async () => {
  let server: Server | null = null;
  let adminA: any = null;
  let adminB: any = null;
  let schoolB: any = null;
  let createdSchoolB = false;
  let createdStudentA: any = null;
  let enrollmentA: any = null;

  try {
    // Start server on an ephemeral or designated test port
    const app = createApp();
    const port = 4199;
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

    // Find an active demo school that has enrollments (falling back to any active school with enrollments solely to read class structure)
    const schoolWithEnrollment =
      (await prisma.school.findFirst({
        where: {
          isActive: true,
          isDemo: true,
          enrollments: { some: { status: "ACTIVE" } },
        },
      })) ??
      (await prisma.school.findFirst({
        where: {
          isActive: true,
          enrollments: { some: { status: "ACTIVE" } },
        },
      }));

    assert.ok(schoolWithEnrollment, "At least one active school with active enrollments is required for testing.");
    const schoolA = schoolWithEnrollment;
    const stamp = Date.now().toString().slice(-8);

    schoolB = await prisma.school.findFirst({
      where: {
        isActive: true,
        id: { not: schoolA.id },
      },
    });

    if (!schoolB) {
      schoolB = await prisma.school.create({
        data: {
          name: `Iso Test School ${stamp}`,
          code: `ISO${stamp.slice(-3)}`,
          type: "PRIMARY_AND_SECONDARY",
          organizationId: schoolA.organizationId,
          isActive: true,
          isDemo: true,
        },
      });
      createdSchoolB = true;
    }

    // Create School Admin for School A
    adminA = await prisma.user.create({
      data: {
        email: `adminA-${stamp}@test.school`,
        role: "SCHOOL_ADMIN",
        status: "ACTIVE",
        firstName: "Admin",
        lastName: "SchoolA",
        schoolId: schoolA.id,
        isDemo: true,
      },
    });

    // Create School Admin for School B
    adminB = await prisma.user.create({
      data: {
        email: `adminB-${stamp}@test.school`,
        role: "SCHOOL_ADMIN",
        status: "ACTIVE",
        firstName: "Admin",
        lastName: "SchoolB",
        schoolId: schoolB.id,
        isDemo: true,
      },
    });

    const cookieA = `emp_access=${signAccessToken({ sub: adminA.id, role: "SCHOOL_ADMIN", schoolId: schoolA.id })}`;
    const cookieB = `emp_access=${signAccessToken({ sub: adminB.id, role: "SCHOOL_ADMIN", schoolId: schoolB.id })}`;

    // Create an isolated temporary test student & enrollment in School A so we never touch existing/production data
    const templateEnrollment = await prisma.enrollment.findFirst({
      where: { schoolId: schoolA.id },
    });
    assert.ok(templateEnrollment, "Template enrollment in School A is required to obtain class/section IDs.");

    createdStudentA = await prisma.student.create({
      data: {
        organizationId: schoolA.organizationId,
        permanentId: `STU-TEST-${stamp}-1`,
        firstName: "First",
        fatherName: "Student",
        grandfatherName: "Test",
        gender: "MALE",
        dateOfBirth: new Date("2011-05-10"),
        status: "ACTIVE",
        isDemo: true,
      },
    });

    enrollmentA = await prisma.enrollment.create({
      data: {
        studentId: createdStudentA.id,
        schoolId: schoolA.id,
        academicYearId: templateEnrollment.academicYearId,
        classGroupId: templateEnrollment.classGroupId,
        sectionId: templateEnrollment.sectionId,
        studentNumber: `SN-${stamp}-1`,
        rollNumber: 998,
        status: "ACTIVE",
      },
      include: { student: true },
    });

    assert.ok(enrollmentA, "An active enrollment in School A without conflicting transfer is required for tests.");

    try {
      // 1. Unauthorized request without authentication
      console.log("Running TC-01...");
      const res1 = await apiCall("/api/v1/external/draft", {
        method: "POST",
        body: { enrollmentId: enrollmentA.id },
      });
      assert.equal(res1.status, 401);

      // 2. Cross-school isolation: Admin B cannot draft for School A's student
      console.log("Running TC-02...");
      const res2 = await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieB,
        body: {
          enrollmentId: enrollmentA.id,
          destinationSchoolName: "Other School",
        },
      });
      assert.equal(res2.status, 404);

      // 3. Create Draft successfully by School Admin A
      console.log("Running TC-03...");
      const res3 = await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieA,
        body: {
          enrollmentId: enrollmentA.id,
          destinationSchoolName: "Al-Nour Academy",
          reason: "Family relocation",
        },
      });

      assert.equal(res3.status, 201, res3.text);
      assert.equal(res3.json.status, "PENDING");
      assert.equal(res3.json.destinationSchoolName, "Al-Nour Academy");
      assert.equal(res3.json.reason, "Family relocation");
      assert.ok(res3.json.certificateNumber, "Must have generated a certificate number");
      assert.match(res3.json.certificateNumber, /^TC-[A-Z0-9]+-\d{5}$/);

      const firstDraftCert = res3.json.certificateNumber;
      const firstDraftId = res3.json.id;

      // Verify Student and Enrollment status remain ACTIVE (Safety Requirement)
      const freshEnrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      const freshStudent = await prisma.student.findUnique({ where: { id: enrollmentA.studentId } });

      assert.equal(freshEnrollment?.status, "ACTIVE", "Enrollment status must remain ACTIVE during draft");
      assert.equal(freshStudent?.status, "ACTIVE", "Student status must remain ACTIVE during draft");

      // Verify Audit Event was created
      const audit = await prisma.auditEvent.findFirst({
        where: {
          schoolId: schoolA.id,
          action: "EXTERNAL_TRANSFER_DRAFT_CREATED",
          entityId: firstDraftId,
        },
      });
      assert.ok(audit, "Audit event for draft creation must exist");

      // 4. Idempotency: Repeated request returns existing draft & keeps same certificate number
      console.log("Running TC-04...");
      const res4 = await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieA,
        body: {
          enrollmentId: enrollmentA.id,
          destinationSchoolName: "Updated Academy Name",
          reason: "Updated relocation reason",
        },
      });

      assert.equal(res4.status, 200, res4.text);
      assert.equal(res4.json.id, firstDraftId, "Must return the same draft record");
      assert.equal(res4.json.certificateNumber, firstDraftCert, "Certificate number must NOT change or re-increment");
      assert.equal(res4.json.destinationSchoolName, "Updated Academy Name");
      assert.equal(res4.json.reason, "Updated relocation reason");
      assert.equal(res4.json.status, "PENDING");

      // Student and Enrollment still ACTIVE
      const freshEnrollment2 = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      assert.equal(freshEnrollment2?.status, "ACTIVE");

      // 5. Read Draft via GET /external/:enrollmentId
      console.log("Running TC-05...");
      const res5A = await apiCall(`/api/v1/external/${enrollmentA.id}`, {
        method: "GET",
        cookie: cookieA,
      });
      assert.equal(res5A.status, 200, res5A.text);
      assert.equal(res5A.json.id, firstDraftId);
      assert.equal(res5A.json.certificateNumber, firstDraftCert);

      // Admin B cannot read (404)
      const res5B = await apiCall(`/api/v1/external/${enrollmentA.id}`, {
        method: "GET",
        cookie: cookieB,
      });
      assert.equal(res5B.status, 404);

      // 6. Cancel Draft
      console.log("Running TC-06...");
      const res6 = await apiCall(`/api/v1/external/${enrollmentA.id}/cancel`, {
        method: "POST",
        cookie: cookieA,
        body: { reason: "Parent changed mind" },
      });

      assert.equal(res6.status, 200, res6.text);
      assert.equal(res6.json.status, "CANCELLED");
      assert.equal(res6.json.cancelReason, "Parent changed mind");
      assert.ok(res6.json.cancelledAt);

      // Verify Student and Enrollment status remain ACTIVE (Critical Safety Requirement)
      const freshEnrollment3 = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      const freshStudent3 = await prisma.student.findUnique({ where: { id: enrollmentA.studentId } });

      assert.equal(freshEnrollment3?.status, "ACTIVE", "Enrollment must remain ACTIVE after draft cancellation");
      assert.equal(freshStudent3?.status, "ACTIVE", "Student must remain ACTIVE after draft cancellation");

      // Verify Audit Event was logged
      const cancelAudit = await prisma.auditEvent.findFirst({
        where: {
          schoolId: schoolA.id,
          action: "EXTERNAL_TRANSFER_DRAFT_CANCELLED",
          entityId: firstDraftId,
        },
      });
      assert.ok(cancelAudit, "Audit event for draft cancellation must exist");

      // 7. Re-drafting after cancellation re-opens draft preserving certificate number
      console.log("Running TC-07...");
      const res7 = await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieA,
        body: {
          enrollmentId: enrollmentA.id,
          destinationSchoolName: "Second Choice School",
          reason: "Decided to transfer again",
        },
      });

      assert.equal(res7.status, 200, res7.text);
      assert.equal(res7.json.id, firstDraftId);
      assert.equal(res7.json.certificateNumber, firstDraftCert);
      assert.equal(res7.json.status, "PENDING");
      assert.equal(res7.json.cancelledAt, null);

      // --- PHASE 2 TESTS: DOCX GENERATION ---

      // 8. Download Transfer Certificate DOCX (Success)
      console.log("Running TC-08: Download TC DOCX...");
      const resTc = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/tc`, {
        headers: { cookie: cookieA },
      });
      assert.equal(resTc.status, 200);
      assert.equal(
        resTc.headers.get("content-type"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      assert.match(resTc.headers.get("content-disposition") || "", /attachment; filename="TC_/);
      const tcBuffer = Buffer.from(await resTc.arrayBuffer());
      assert.ok(tcBuffer.length > 500, "DOCX buffer must be non-empty");
      // Standard zip header magic bytes for docx (PK\x03\x04)
      assert.equal(tcBuffer[0], 0x50);
      assert.equal(tcBuffer[1], 0x4b);

      // Verify draft tcDownloaded flag is now true, but student and enrollment remain ACTIVE
      const freshTransfer = await prisma.externalTransfer.findUnique({ where: { id: firstDraftId } });
      assert.equal(freshTransfer?.tcDownloaded, true);
      const checkEnr = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      const checkStu = await prisma.student.findUnique({ where: { id: enrollmentA.studentId } });
      assert.equal(checkEnr?.status, "ACTIVE", "Enrollment must remain ACTIVE after TC download");
      assert.equal(checkStu?.status, "ACTIVE", "Student must remain ACTIVE after TC download");

      // Verify Audit Event for TC download
      const tcAudit = await prisma.auditEvent.findFirst({
        where: {
          schoolId: schoolA.id,
          action: "TRANSFER_CERTIFICATE_DOCX_DOWNLOADED",
          entityId: firstDraftId,
        },
      });
      assert.ok(tcAudit, "Audit event for TC download must exist");

      // 9. Download Student Academic Transcript DOCX (Success)
      console.log("Running TC-09: Download Transcript DOCX...");
      const resTr = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/transcript`, {
        headers: { cookie: cookieA },
      });
      assert.equal(resTr.status, 200);
      assert.equal(
        resTr.headers.get("content-type"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      assert.match(resTr.headers.get("content-disposition") || "", /attachment; filename="Transcript_/);
      const trBuffer = Buffer.from(await resTr.arrayBuffer());
      assert.ok(trBuffer.length > 500, "Transcript DOCX buffer must be non-empty");
      assert.equal(trBuffer[0], 0x50);
      assert.equal(trBuffer[1], 0x4b);

      // Verify draft transcriptDownloaded flag is now true, student/enrollment remain ACTIVE
      const freshTransferTr = await prisma.externalTransfer.findUnique({ where: { id: firstDraftId } });
      assert.equal(freshTransferTr?.transcriptDownloaded, true);
      const checkEnr2 = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      assert.equal(checkEnr2?.status, "ACTIVE", "Enrollment must remain ACTIVE after Transcript download");

      // Verify Audit Event for Transcript download
      const trAudit = await prisma.auditEvent.findFirst({
        where: {
          schoolId: schoolA.id,
          action: "STUDENT_TRANSCRIPT_DOCX_DOWNLOADED",
          entityId: firstDraftId,
        },
      });
      assert.ok(trAudit, "Audit event for Transcript download must exist");

      // 10. Unauthorized requests (No auth cookie)
      console.log("Running TC-10: Unauthorized DOCX requests...");
      const resUnauthTc = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/tc`);
      assert.equal(resUnauthTc.status, 401);
      const resUnauthTr = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/transcript`);
      assert.equal(resUnauthTr.status, 401);

      // 11. Cross-school isolation (Admin B requesting Admin A's student documents)
      console.log("Running TC-11: Cross-school isolation on DOCX requests...");
      const resIsoTc = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/tc`, {
        headers: { cookie: cookieB },
      });
      assert.equal(resIsoTc.status, 404);
      const resIsoTr = await fetch(`${base}/api/v1/external/${enrollmentA.id}/documents/transcript`, {
        headers: { cookie: cookieB },
      });
      assert.equal(resIsoTr.status, 404);

      // 12. Non-existent enrollment ID (404)
      console.log("Running TC-12: Non-existent enrollment ID...");
      const resNotFoundTc = await fetch(`${base}/api/v1/external/fake-enr-id-999/documents/tc`, {
        headers: { cookie: cookieA },
      });
      assert.equal(resNotFoundTc.status, 404);

      // --- PHASE 3 TESTS: FINAL CONFIRMATION ---

      // 13. Rejects confirmation without explicit document review acknowledgement
      console.log("Running TC-13: Reject confirm without explicit review ack...");
      const resConfNoAck = await apiCall(`/api/v1/external/${enrollmentA.id}/confirm`, {
        method: "POST",
        cookie: cookieA,
        body: {},
      });
      assert.equal(resConfNoAck.status, 400);

      const resConfFalseAck = await apiCall(`/api/v1/external/${enrollmentA.id}/confirm`, {
        method: "POST",
        cookie: cookieA,
        body: { documentsReviewed: false },
      });
      assert.equal(resConfFalseAck.status, 400);

      // 14. Rejects confirmation if documents were not downloaded (tested on a fresh draft)
      console.log("Running TC-14: Reject confirm if documents not downloaded...");
      // Create a temporary second enrollment in School A
      const secondStudent = await prisma.student.create({
        data: {
          organizationId: schoolA.organizationId,
          permanentId: `STU-TEST-${stamp}-2`,
          firstName: "Second",
          fatherName: "Student",
          grandfatherName: "Test",
          gender: "MALE",
          dateOfBirth: new Date("2010-01-01"),
          status: "ACTIVE",
          isDemo: true,
        },
      });
      const secondEnrollment = await prisma.enrollment.create({
        data: {
          studentId: secondStudent.id,
          schoolId: schoolA.id,
          academicYearId: enrollmentA.academicYearId,
          classGroupId: enrollmentA.classGroupId,
          sectionId: enrollmentA.sectionId,
          studentNumber: `SN-${stamp}-2`,
          rollNumber: 999,
          status: "ACTIVE",
        },
      });
      // Create draft for second enrollment without downloading documents
      await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieA,
        body: { enrollmentId: secondEnrollment.id },
      });
      const resNoDownload = await apiCall(`/api/v1/external/${secondEnrollment.id}/confirm`, {
        method: "POST",
        cookie: cookieA,
        body: { documentsReviewed: true },
      });
      assert.equal(resNoDownload.status, 400, "Must block confirmation if documents were not generated/downloaded");

      // Cleanup second student/enrollment
      await prisma.externalTransfer.deleteMany({ where: { enrollmentId: secondEnrollment.id } });
      await prisma.enrollment.delete({ where: { id: secondEnrollment.id } });
      await prisma.student.delete({ where: { id: secondStudent.id } });

      // 15. Cross-school isolation on confirmation
      console.log("Running TC-15: Cross-school rejection on confirmation...");
      const resIsoConf = await apiCall(`/api/v1/external/${enrollmentA.id}/confirm`, {
        method: "POST",
        cookie: cookieB,
        body: { documentsReviewed: true },
      });
      assert.equal(resIsoConf.status, 404);

      // 16. Successful final confirmation
      console.log("Running TC-16: Successful final confirmation...");
      const resSuccessConf = await apiCall(`/api/v1/external/${enrollmentA.id}/confirm`, {
        method: "POST",
        cookie: cookieA,
        body: { documentsReviewed: true },
      });

      assert.equal(resSuccessConf.status, 200, resSuccessConf.text);
      assert.equal(resSuccessConf.json.transfer.status, "CONFIRMED");
      assert.equal(resSuccessConf.json.transfer.confirmedByUserId, adminA.id);
      assert.ok(resSuccessConf.json.transfer.confirmedAt);

      // Verify Enrollment is TRANSFERRED and Student is WITHDRAWN
      const confirmedEnr = await prisma.enrollment.findUnique({ where: { id: enrollmentA.id } });
      const confirmedStu = await prisma.student.findUnique({ where: { id: enrollmentA.studentId } });
      assert.equal(confirmedEnr?.status, "TRANSFERRED", "Enrollment status must transition to TRANSFERRED");
      assert.equal(confirmedStu?.status, "WITHDRAWN", "Student status must transition to WITHDRAWN");

      // Verify Audit Log was recorded
      const confirmAudit = await prisma.auditEvent.findFirst({
        where: {
          schoolId: schoolA.id,
          action: "EXTERNAL_TRANSFER_CONFIRMED",
          entityId: firstDraftId,
        },
      });
      assert.ok(confirmAudit, "Audit event for confirmation must be logged");

      // 17. Idempotency: Repeated confirmation returns current state without re-mutating
      console.log("Running TC-17: Repeated confirmation is idempotent...");
      const resRepeatConf = await apiCall(`/api/v1/external/${enrollmentA.id}/confirm`, {
        method: "POST",
        cookie: cookieA,
        body: { documentsReviewed: true },
      });
      assert.equal(resRepeatConf.status, 200);
      assert.equal(resRepeatConf.json.alreadyConfirmed, true);
      assert.equal(resRepeatConf.json.transfer.status, "CONFIRMED");

      // 18. Cannot draft or cancel an already confirmed transfer
      console.log("Running TC-18: Reject draft/cancel on confirmed transfer...");
      const resDraftOnConfirmed = await apiCall("/api/v1/external/draft", {
        method: "POST",
        cookie: cookieA,
        body: { enrollmentId: enrollmentA.id },
      });
      assert.equal(resDraftOnConfirmed.status, 404, "Active enrollment no longer exists (now TRANSFERRED)");

      const resCancelOnConfirmed = await apiCall(`/api/v1/external/${enrollmentA.id}/cancel`, {
        method: "POST",
        cookie: cookieA,
        body: { reason: "Attempt cancel after confirm" },
      });
      assert.equal(resCancelOnConfirmed.status, 400);

      // 19. List external transfers (support for Transferred Students Directory)
      console.log("Running TC-19: List external transfers...");
      const resList = await apiCall("/api/v1/external?status=CONFIRMED", {
        method: "GET",
        cookie: cookieA,
      });
      assert.equal(resList.status, 200);
      assert.ok(Array.isArray(resList.json.items));
      assert.ok(resList.json.items.length >= 1);
      const foundInList = resList.json.items.find((item: any) => item.id === firstDraftId);
      assert.ok(foundInList);
      assert.equal(foundInList.status, "CONFIRMED");
      assert.equal(foundInList.student.status, "WITHDRAWN");
      assert.equal(foundInList.enrollment.status, "TRANSFERRED");

      console.log("All Phase 1, Phase 2, and Phase 3 External Transfer test cases PASSED!");
    } finally {
      if (enrollmentA) {
        await prisma.externalTransfer.deleteMany({ where: { enrollmentId: enrollmentA.id } }).catch(() => {});
        await prisma.enrollment.delete({ where: { id: enrollmentA.id } }).catch(() => {});
      }
      if (createdStudentA) {
        await prisma.student.delete({ where: { id: createdStudentA.id } }).catch(() => {});
      }
      if (adminA || adminB) {
        await prisma.user.deleteMany({ where: { id: { in: [adminA?.id, adminB?.id].filter(Boolean) } } }).catch(() => {});
      }
      if (createdSchoolB && schoolB) {
        await prisma.school.delete({ where: { id: schoolB.id } }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("FATAL ERROR IN TEST:", err);
    throw err;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => (server as Server).close(() => resolve())).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
  }
});
