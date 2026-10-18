import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./lib/prisma.js";
import { signAccessToken } from "./lib/tokens.js";

const base = process.env.PORTAL_TEST_API ?? "http://localhost:4000";

async function call(path: string, cookie: string) {
  const response = await fetch(`${base}${path}`, { headers: { cookie } });
  const text = await response.text();
  return { status: response.status, text, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

type HistoryRow = { id: string; yearName: string; schoolName: string; stage: string; level: string; status: string };
type Profile = {
  currentStatus: string;
  current: { level: string; schoolName: string } | null;
  records: Array<{ fromLevel: string; stage: string; graduated: boolean }>;
  history: HistoryRow[];
  results: Array<{ subject: string; marks: number | null }>;
};

test("alumni academic history keeps every recorded enrollment", async () => {
  const owned = await prisma.alumniRecord.findFirst({
    where: { student: { permanentId: "STU-PATH-0003" } },
    select: { schoolId: true },
  });
  const school = owned ? await prisma.school.findFirst({ where: { id: owned.schoolId, isActive: true } }) : null;
  assert.ok(school, "An active school that owns Class 8 alumni is required.");
  const stamp = Date.now().toString().slice(-8);
  const admin = await prisma.user.create({
    data: { email: `alumni-${stamp}@demo.school`, role: "SCHOOL_ADMIN", status: "ACTIVE", firstName: "Alumni", lastName: "Check", schoolId: school.id, isDemo: true },
  });
  const teacher = await prisma.user.create({
    data: { email: `alumni-teacher-${stamp}@demo.school`, role: "TEACHER", status: "ACTIVE", firstName: "Alumni", lastName: "Teacher", schoolId: school.id, isDemo: true },
  });
  const inactiveSchool = await prisma.school.findFirst({ where: { isActive: false, type: "PRIMARY_ONLY" } });
  const inactiveAdmin = inactiveSchool
    ? await prisma.user.create({
      data: { email: `alumni-inactive-${stamp}@demo.school`, role: "SCHOOL_ADMIN", status: "ACTIVE", firstName: "Inactive", lastName: "Admin", schoolId: inactiveSchool.id, isDemo: true },
    })
    : null;
  const cookie = `emp_access=${signAccessToken({ sub: admin.id, role: "SCHOOL_ADMIN", schoolId: school.id })}`;
  const created: { studentId?: string; yearId?: string; classId?: string; sectionId?: string; fromYearId?: string; fromClassId?: string; fromSectionId?: string; examId?: string; subjectId?: string; hiddenSubjectId?: string; secondaryAdminId?: string } = {};
  try {
    const denied = await call("/api/v1/alumni", `emp_access=${signAccessToken({ sub: teacher.id, role: "TEACHER", schoolId: school.id })}`);
    assert.equal(denied.status, 403);
    if (inactiveAdmin && inactiveSchool) {
      const inactive = await call("/api/v1/alumni", `emp_access=${signAccessToken({ sub: inactiveAdmin.id, role: "SCHOOL_ADMIN", schoolId: inactiveSchool.id })}`);
      assert.equal(inactive.status, 403);
    }

    async function profileOf(permanentId: string) {
      const student = await prisma.student.findFirst({ where: { permanentId, organizationId: school!.organizationId } });
      assert.ok(student, `${permanentId} is missing.`);
      const response = await call(`/api/v1/alumni/${student.id}`, cookie);
      assert.equal(response.status, 200, response.text);
      return response.json as unknown as Profile;
    }

    const primaryOnly = await profileOf("STU-PATH-0003");
    assert.equal(primaryOnly.currentStatus, "Primary Graduate");
    assert.equal(primaryOnly.current, null);
    assert.equal(primaryOnly.history.length, 8);
    assert.deepEqual(primaryOnly.history.map((row) => row.level), ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8"]);
    assert.equal(primaryOnly.history.every((row) => row.status === "Completed" && row.stage === "Primary"), true);
    assert.equal(new Set(primaryOnly.history.map((row) => row.id)).size, primaryOnly.history.length);

    const continued = await profileOf("STU-PATH-0001");
    assert.equal(continued.currentStatus, "Active Student — Secondary Form 1");
    assert.equal(continued.current?.level, "Form 1");
    assert.equal(continued.history.at(-1)?.status, "Enrolled");
    assert.equal(continued.history.at(-1)?.stage, "Secondary");
    assert.equal(continued.history.filter((row) => row.level === "Class 8")[0]?.status, "Completed");
    assert.equal(continued.history.some((row) => row.schoolName !== continued.history[0]?.schoolName), true);
    assert.equal(continued.records.some((record) => record.fromLevel === "Form 4"), false);

    const activeLater = await profileOf("STU-PATH-0002");
    assert.equal(activeLater.currentStatus, "Primary Graduate");
    assert.equal(activeLater.records[0]?.fromLevel, "Class 8");
    assert.equal(activeLater.current, null);
    assert.equal(activeLater.history.some((row) => row.level === "Form 2" && row.status === "Completed"), true);
    assert.equal(activeLater.history.some((row) => row.level === "Form 3" && row.status === "Completed"), true);
    assert.equal(activeLater.history.at(-1)?.level, "Form 4");
    assert.equal(activeLater.history.at(-1)?.status, "Completed");
    assert.equal(activeLater.records.some((record) => record.fromLevel === "Form 4" && record.graduated), true);
    const form4Record = await prisma.alumniRecord.findFirst({
      where: { student: { permanentId: "STU-PATH-0002" }, fromLevel: "FORM_4" },
      select: { schoolId: true },
    });
    assert.ok(form4Record);
    const secondaryAdmin = await prisma.user.create({
      data: { email: `alumni-secondary-${stamp}@demo.school`, role: "SCHOOL_ADMIN", status: "ACTIVE", firstName: "Secondary", lastName: "Alumni", schoolId: form4Record.schoolId, isDemo: true },
    });
    created.secondaryAdminId = secondaryAdmin.id;
    const secondaryCookie = `emp_access=${signAccessToken({ sub: secondaryAdmin.id, role: "SCHOOL_ADMIN", schoolId: form4Record.schoolId })}`;
    const secondaryStudent = await prisma.student.findFirst({ where: { permanentId: "STU-PATH-0002" } });
    assert.ok(secondaryStudent);
    const secondaryView = await call(`/api/v1/alumni/${secondaryStudent.id}`, secondaryCookie);
    assert.equal(secondaryView.status, 200, secondaryView.text);
    const secondaryProfile = secondaryView.json as unknown as Profile;
    assert.equal(secondaryProfile.currentStatus, "Secondary Graduate");
    assert.equal(secondaryProfile.records[0]?.fromLevel, "Form 4");
    const secondaryList = await call("/api/v1/alumni", secondaryCookie);
    const secondaryRows = secondaryList.json as unknown as Array<{ permanentId: string; fromLevel: string }>;
    assert.equal(secondaryRows.every((row) => row.fromLevel === "Form 4"), true);
    assert.equal(secondaryRows.some((row) => row.permanentId === "STU-PATH-0003"), false);
    assert.equal(new Set(activeLater.history.map((row) => row.id)).size, activeLater.history.length);
    const order = activeLater.history.map((row) => row.yearName);
    assert.deepEqual(order, [...order].sort((a, b) => a.localeCompare(b)));

    const foreign = await prisma.student.findFirst({ where: { permanentId: "STU-26-P-000099" } });
    assert.ok(foreign);
    const foreignView = await call(`/api/v1/alumni/${foreign.id}`, cookie);
    assert.equal(foreignView.status, 404);

    const year = await prisma.academicYear.create({
      data: { schoolId: school.id, name: `Alumni Gap ${stamp}`, startDate: new Date("2031-08-01"), endDate: new Date("2032-06-01"), isCurrent: false, isDemo: true },
    });
    created.yearId = year.id;
    const fromYear = await prisma.academicYear.create({
      data: { schoolId: school.id, name: `Alumni From ${stamp}`, startDate: new Date("2030-08-01"), endDate: new Date("2031-06-01"), isCurrent: false, isDemo: true },
    });
    created.fromYearId = fromYear.id;
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, academicYearId: year.id, level: "CLASS_8" } });
    created.classId = classGroup.id;
    const fromClass = await prisma.classGroup.create({ data: { schoolId: school.id, academicYearId: fromYear.id, level: "CLASS_7" } });
    created.fromClassId = fromClass.id;
    const section = await prisma.section.create({ data: { classGroupId: classGroup.id, name: "A" } });
    created.sectionId = section.id;
    const fromSection = await prisma.section.create({ data: { classGroupId: fromClass.id, name: "A" } });
    created.fromSectionId = fromSection.id;
    const subject = await prisma.subject.create({ data: { schoolId: school.id, name: `Visible ${stamp}`, code: `V${stamp}`, isDemo: true } });
    const hidden = await prisma.subject.create({ data: { schoolId: school.id, name: `Hidden ${stamp}`, code: `H${stamp}`, isDemo: true } });
    created.subjectId = subject.id;
    created.hiddenSubjectId = hidden.id;
    const student = await prisma.student.create({
      data: {
        organizationId: school.organizationId,
        permanentId: `STU-ALUMNI-${stamp}`,
        firstName: "Gap",
        fatherName: "History",
        grandfatherName: "Check",
        gender: "FEMALE",
        dateOfBirth: new Date("2012-01-01"),
        status: "ALUMNI",
        isDemo: true,
      },
    });
    created.studentId = student.id;
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: year.id,
        classGroupId: classGroup.id,
        sectionId: section.id,
        studentNumber: `A${stamp}`,
        rollNumber: 1,
        status: "ALUMNI",
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        academicYearId: fromYear.id,
        classGroupId: fromClass.id,
        sectionId: fromSection.id,
        studentNumber: `T${stamp}`,
        rollNumber: 1,
        status: "TRANSFERRED",
      },
    });
    await prisma.alumniRecord.create({
      data: { studentId: student.id, schoolId: school.id, academicYearId: year.id, fromLevel: "CLASS_8", reason: "Class 8 completion" },
    });
    const exam = await prisma.exam.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        term: "TERM_2",
        generalMax: 100,
        subjects: {
          create: [
            { classGroupId: classGroup.id, subjectId: subject.id, maxMarks: 100, minMarks: 50 },
            { classGroupId: classGroup.id, subjectId: hidden.id, maxMarks: 100, minMarks: 50 },
          ],
        },
      },
      include: { subjects: true },
    });
    created.examId = exam.id;
    const visibleSubject = exam.subjects.find((item) => item.subjectId === subject.id);
    const hiddenSubject = exam.subjects.find((item) => item.subjectId === hidden.id);
    assert.ok(visibleSubject && hiddenSubject);
    await prisma.subjectResult.create({ data: { enrollmentId: enrollment.id, examSubjectId: visibleSubject.id, marks: 90, state: "PUBLISHED", publishedAt: new Date() } });
    await prisma.subjectResult.create({ data: { enrollmentId: enrollment.id, examSubjectId: hiddenSubject.id, marks: 10, state: "DRAFT" } });
    const gap = await call(`/api/v1/alumni/${student.id}`, cookie);
    assert.equal(gap.status, 200, gap.text);
    const gapProfile = gap.json as unknown as Profile;
    assert.equal(gapProfile.history.length, 2);
    assert.equal(gapProfile.history[0]?.status, "Transferred");
    assert.equal(gapProfile.history[0]?.level, "Class 7");
    assert.equal(gapProfile.history[1]?.status, "Completed");
    assert.equal(gapProfile.results.length, 1);
    assert.equal(gapProfile.results[0]?.marks, 90);
    assert.equal(gapProfile.results.some((row) => row.marks === 10), false);
    const list = await call("/api/v1/alumni", cookie);
    assert.equal(list.status, 200, list.text);
    const listed = list.json as unknown as Array<{ permanentId: string }>;
    assert.equal(listed.some((row) => row.permanentId === "STU-26-S-000007"), false);
    const transfer = await prisma.enrollment.findFirst({
      where: { status: "TRANSFERRED", studentId: { not: student.id }, student: { organizationId: school.organizationId } },
      include: { student: { select: { permanentId: true, alumniRecords: { select: { id: true } } } } },
    });
    assert.ok(transfer, "A transferred enrollment exists in this organization.");
    assert.equal(transfer.student.alumniRecords.length, 0);
    assert.equal(listed.some((row) => row.permanentId === transfer.student.permanentId), false);
  } finally {
    if (created.examId) {
      await prisma.subjectResult.deleteMany({ where: { examSubject: { examId: created.examId } } });
      await prisma.examSubject.deleteMany({ where: { examId: created.examId } });
      await prisma.exam.delete({ where: { id: created.examId } }).catch(() => undefined);
    }
    if (created.studentId) {
      await prisma.alumniRecord.deleteMany({ where: { studentId: created.studentId } });
      await prisma.enrollment.deleteMany({ where: { studentId: created.studentId } });
      await prisma.student.delete({ where: { id: created.studentId } }).catch(() => undefined);
    }
    if (created.sectionId) await prisma.section.delete({ where: { id: created.sectionId } }).catch(() => undefined);
    if (created.fromSectionId) await prisma.section.delete({ where: { id: created.fromSectionId } }).catch(() => undefined);
    if (created.classId) await prisma.classGroup.delete({ where: { id: created.classId } }).catch(() => undefined);
    if (created.fromClassId) await prisma.classGroup.delete({ where: { id: created.fromClassId } }).catch(() => undefined);
    if (created.subjectId) await prisma.subject.delete({ where: { id: created.subjectId } }).catch(() => undefined);
    if (created.hiddenSubjectId) await prisma.subject.delete({ where: { id: created.hiddenSubjectId } }).catch(() => undefined);
    if (created.yearId) await prisma.academicYear.delete({ where: { id: created.yearId } }).catch(() => undefined);
    if (created.fromYearId) await prisma.academicYear.delete({ where: { id: created.fromYearId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, teacher.id, inactiveAdmin?.id, created.secondaryAdminId].filter((id): id is string => Boolean(id)) } } });
  }
});
