import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";

const base = process.env.PORTAL_TEST_API ?? "http://localhost:4000";

async function call(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { cookie, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  return { status: response.status, text, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

test("section promotion writes only the selected section and keeps history", async () => {
  const school = await prisma.school.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } });
  assert.ok(school, "An active school is required.");
  const stamp = Date.now().toString().slice(-8);
  const admin = await prisma.user.create({
    data: { email: `promo-${stamp}@demo.school`, role: "SCHOOL_ADMIN", status: "ACTIVE", firstName: "Promo", lastName: "Check", schoolId: school.id, isDemo: true },
  });
  const cookie = `emp_access=${signAccessToken({ sub: admin.id, role: "SCHOOL_ADMIN", schoolId: school.id })}`;
  const createdStudents: string[] = [];
  const createdYears: string[] = [];
  try {
    const fromYear = await prisma.academicYear.create({ data: { schoolId: school.id, name: `Promo From ${stamp}`, startDate: new Date("2034-08-01"), endDate: new Date("2035-06-01"), isCurrent: false, isDemo: true } });
    const toYear = await prisma.academicYear.create({ data: { schoolId: school.id, name: `Promo To ${stamp}`, startDate: new Date("2035-08-01"), endDate: new Date("2036-06-01"), isCurrent: false, isDemo: true } });
    createdYears.push(fromYear.id, toYear.id);
    const firstLevel = school.type === "SECONDARY_ONLY" ? "FORM_1" : "CLASS_1";
    const secondLevel = school.type === "SECONDARY_ONLY" ? "FORM_2" : "CLASS_2";
    const finalLevel = school.type === "SECONDARY_ONLY" ? "FORM_4" : "CLASS_8";
    async function makeClass(yearId: string, level: "CLASS_1" | "CLASS_2" | "CLASS_8" | "FORM_1" | "FORM_2" | "FORM_4", sections: string[]) {
      const group = await prisma.classGroup.create({ data: { schoolId: school!.id, academicYearId: yearId, level } });
      const made = [];
      for (const name of sections) made.push(await prisma.section.create({ data: { classGroupId: group.id, name } }));
      return { group, sections: made };
    }
    const fromClass1 = await makeClass(fromYear.id, firstLevel, ["A", "B"]);
    const fromClass8 = await makeClass(fromYear.id, finalLevel, ["A"]);
    const toClass1 = await makeClass(toYear.id, firstLevel, ["A"]);
    const toClass2 = await makeClass(toYear.id, secondLevel, ["A"]);
    await makeClass(toYear.id, finalLevel, ["A"]);
    const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Promo Check", code: `PR${stamp}`, isDemo: true } });
    const exam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        academicYearId: fromYear.id,
        term: "TERM_2",
        generalMax: 100,
        classes: { create: [{ classGroupId: fromClass1.group.id }, { classGroupId: fromClass8.group.id }] },
        sections: { create: [{ sectionId: fromClass1.sections[0].id }, { sectionId: fromClass1.sections[1].id }, { sectionId: fromClass8.sections[0].id }] },
        subjects: {
          create: [
            { classGroupId: fromClass1.group.id, subjectId: subject.id, maxMarks: 100, minMarks: 50 },
            { classGroupId: fromClass8.group.id, subjectId: subject.id, maxMarks: 100, minMarks: 50 },
          ],
        },
      },
      include: { subjects: true },
    });
    const class1Subject = exam.subjects.find((item) => item.classGroupId === fromClass1.group.id)!;
    const class8Subject = exam.subjects.find((item) => item.classGroupId === fromClass8.group.id)!;
    async function enroll(levelSectionId: string, classGroupId: string, first: string, marks: number | null, examSubjectId: string) {
      const student = await prisma.student.create({
        data: {
          organizationId: school!.organizationId,
          permanentId: `STU-PROMO-${stamp}-${first}`,
          firstName: first,
          fatherName: "Test",
          grandfatherName: "Student",
          gender: "FEMALE",
          dateOfBirth: new Date("2014-01-01"),
          isDemo: true,
        },
      });
      createdStudents.push(student.id);
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school!.id,
          academicYearId: fromYear.id,
          classGroupId,
          sectionId: levelSectionId,
          studentNumber: `P${stamp}${first}`,
          rollNumber: createdStudents.length,
          status: "ACTIVE",
        },
      });
      if (marks !== null) {
        await prisma.subjectResult.create({
          data: { enrollmentId: enrollment.id, examSubjectId, marks, state: "PUBLISHED", publishedAt: new Date() },
        });
      }
      return { student, enrollment };
    }
    const pass = await enroll(fromClass1.sections[0].id, fromClass1.group.id, "Pass", 80, class1Subject.id);
    const fail = await enroll(fromClass1.sections[0].id, fromClass1.group.id, "Fail", 30, class1Subject.id);
    const other = await enroll(fromClass1.sections[1].id, fromClass1.group.id, "Other", 90, class1Subject.id);
    const graduate = await enroll(fromClass8.sections[0].id, fromClass8.group.id, "Grad", 90, class8Subject.id);
    const missingYear = await call(`/api/v1/promotion/section?fromYearId=${fromYear.id}&toYearId=missing-year&sectionId=${fromClass1.sections[0].id}`, cookie);
    assert.equal(missingYear.status, 404);
    const reversed = await call(`/api/v1/promotion/section?fromYearId=${toYear.id}&toYearId=${fromYear.id}&sectionId=${fromClass1.sections[0].id}`, cookie);
    assert.equal(reversed.status, 400);
    const sectionA = await call(`/api/v1/promotion/section?fromYearId=${fromYear.id}&toYearId=${toYear.id}&sectionId=${fromClass1.sections[0].id}`, cookie);
    assert.equal(sectionA.status, 200, sectionA.text);
    const loaded = sectionA.json.rows as Array<{ permanentId: string }>;
    assert.deepEqual(loaded.map((row) => row.permanentId).sort(), [pass.student.permanentId, fail.student.permanentId].sort());
    assert.equal(loaded.some((row) => row.permanentId === other.student.permanentId), false);
    const unpublished = await enroll(fromClass1.sections[0].id, fromClass1.group.id, "Wait", null, class1Subject.id);
    const blocked = await call("/api/v1/promotions", cookie, {
      method: "POST",
      body: JSON.stringify({ fromYearId: fromYear.id, toYearId: toYear.id, sectionId: fromClass1.sections[0].id, decisions: [{ enrollmentId: unpublished.enrollment.id, action: "PROMOTE", targetSectionId: toClass2.sections[0].id }] }),
    });
    assert.equal(blocked.status, 400);
    const promoted = await call("/api/v1/promotions", cookie, {
      method: "POST",
      body: JSON.stringify({
        fromYearId: fromYear.id,
        toYearId: toYear.id,
        sectionId: fromClass1.sections[0].id,
        decisions: [
          { enrollmentId: pass.enrollment.id, action: "PROMOTE", targetSectionId: toClass2.sections[0].id },
          { enrollmentId: fail.enrollment.id, action: "RETAIN", targetSectionId: toClass1.sections[0].id },
        ],
      }),
    });
    assert.equal(promoted.status, 200, promoted.text);
    const passNext = await prisma.enrollment.findFirst({ where: { studentId: pass.student.id, academicYearId: toYear.id }, include: { classGroup: true } });
    const failNext = await prisma.enrollment.findFirst({ where: { studentId: fail.student.id, academicYearId: toYear.id }, include: { classGroup: true } });
    const otherNext = await prisma.enrollment.findFirst({ where: { studentId: other.student.id, academicYearId: toYear.id } });
    const otherStill = await prisma.enrollment.findUnique({ where: { id: other.enrollment.id } });
    assert.equal(passNext?.classGroup.level, secondLevel);
    assert.equal(failNext?.classGroup.level, firstLevel);
    assert.equal(otherNext, null);
    assert.equal(otherStill?.status, "ACTIVE");
    const duplicate = await call("/api/v1/promotions", cookie, {
      method: "POST",
      body: JSON.stringify({ fromYearId: fromYear.id, toYearId: toYear.id, sectionId: fromClass1.sections[0].id, decisions: [{ enrollmentId: pass.enrollment.id, action: "PROMOTE", targetSectionId: toClass2.sections[0].id }] }),
    });
    assert.equal(duplicate.status, 409);
    const graduated = await call("/api/v1/promotions", cookie, {
      method: "POST",
      body: JSON.stringify({ fromYearId: fromYear.id, toYearId: toYear.id, sectionId: fromClass8.sections[0].id, decisions: [{ enrollmentId: graduate.enrollment.id, action: "ALUMNI" }] }),
    });
    assert.equal(graduated.status, 200, graduated.text);
    const form1 = await prisma.enrollment.findFirst({ where: { studentId: graduate.student.id, classGroup: { level: "FORM_1" } } });
    assert.equal(form1, null);
    const alumni = await prisma.alumniRecord.findFirst({ where: { studentId: graduate.student.id } });
    assert.ok(alumni);
    const history = await call(`/api/v1/promotions/history?q=${pass.student.permanentId}`, cookie);
    assert.equal(history.status, 200);
    assert.equal((history.json as unknown as Array<{ outcome: string }>).some((row) => row.outcome === "Promoted"), true);
    const foreign = await call("/api/v1/promotions", cookie, {
      method: "POST",
      body: JSON.stringify({ fromYearId: fromYear.id, toYearId: toYear.id, sectionId: fromClass1.sections[1].id, decisions: [{ enrollmentId: pass.enrollment.id, action: "RETAIN", targetSectionId: toClass1.sections[0].id }] }),
    });
    assert.equal(foreign.status, 404);
    const otherSchoolYear = await prisma.academicYear.findFirst({ where: { schoolId: { not: school.id } }, select: { id: true } });
    if (otherSchoolYear) {
      const cross = await call("/api/v1/promotions", cookie, {
        method: "POST",
        body: JSON.stringify({ fromYearId: otherSchoolYear.id, toYearId: toYear.id, sectionId: fromClass1.sections[1].id, decisions: [{ enrollmentId: other.enrollment.id, action: "RETAIN", targetSectionId: toClass1.sections[0].id }] }),
      });
      assert.equal(cross.status, 404);
    }
    const teacher = await prisma.user.findFirst({ where: { role: "TEACHER", status: "ACTIVE", schoolId: school.id }, select: { id: true, schoolId: true } });
    if (teacher) {
      const denied = await call("/api/v1/promotion/options", `emp_access=${signAccessToken({ sub: teacher.id, role: "TEACHER", schoolId: teacher.schoolId })}`);
      assert.equal(denied.status, 403);
    }
  } finally {
    const enrollments = await prisma.enrollment.findMany({ where: { studentId: { in: createdStudents } }, select: { id: true } });
    const enrollmentIds = enrollments.map((row) => row.id);
    await prisma.promotionDecision.deleteMany({ where: { studentId: { in: createdStudents } } });
    await prisma.promotionBatch.deleteMany({ where: { fromYearId: { in: createdYears } } });
    await prisma.subjectResult.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
    await prisma.alumniRecord.deleteMany({ where: { studentId: { in: createdStudents } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: createdStudents } } });
    await prisma.student.deleteMany({ where: { id: { in: createdStudents } } });
    await prisma.examSubject.deleteMany({ where: { exam: { academicYearId: { in: createdYears } } } });
    await prisma.examSection.deleteMany({ where: { exam: { academicYearId: { in: createdYears } } } });
    await prisma.examClass.deleteMany({ where: { exam: { academicYearId: { in: createdYears } } } });
    await prisma.exam.deleteMany({ where: { academicYearId: { in: createdYears } } });
    await prisma.section.deleteMany({ where: { classGroup: { academicYearId: { in: createdYears } } } });
    await prisma.classGroup.deleteMany({ where: { academicYearId: { in: createdYears } } });
    await prisma.subject.deleteMany({ where: { code: { startsWith: "PR" }, schoolId: school.id, name: "Promo Check" } });
    await prisma.academicYear.deleteMany({ where: { id: { in: createdYears } } });
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
