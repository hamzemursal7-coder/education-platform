import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type Tx = Prisma.TransactionClient;

function ids(rows: Array<{ id: string }>) {
  return rows.map((row) => row.id);
}

export async function deleteSchoolAndRecords(schoolId: string) {
  await prisma.$transaction(async (tx) => {
    const enrollments = await tx.enrollment.findMany({ where: { schoolId }, select: { id: true, studentId: true } });
    const enrollmentIds = ids(enrollments);
    const studentIds = [...new Set(enrollments.map((row) => row.studentId))];
    const exams = await tx.exam.findMany({ where: { schoolId }, select: { id: true } });
    const examIds = ids(exams);
    const examSubjects = examIds.length
      ? await tx.examSubject.findMany({ where: { examId: { in: examIds } }, select: { id: true } })
      : [];
    const examSubjectIds = ids(examSubjects);
    const classes = await tx.classGroup.findMany({ where: { schoolId }, select: { id: true } });
    const classIds = ids(classes);
    const sections = classIds.length
      ? await tx.section.findMany({ where: { classGroupId: { in: classIds } }, select: { id: true } })
      : [];
    const sectionIds = ids(sections);
    const fees = await tx.studentFee.findMany({ where: { schoolId }, select: { id: true } });
    const feeIds = ids(fees);
    const batches = await tx.promotionBatch.findMany({ where: { schoolId }, select: { id: true } });
    const batchIds = ids(batches);

    if (feeIds.length) await tx.payment.deleteMany({ where: { studentFeeId: { in: feeIds } } });
    if (enrollmentIds.length || examSubjectIds.length) {
      await tx.subjectResult.deleteMany({
        where: {
          OR: [
            ...(enrollmentIds.length ? [{ enrollmentId: { in: enrollmentIds } }] : []),
            ...(examSubjectIds.length ? [{ examSubjectId: { in: examSubjectIds } }] : []),
          ],
        },
      });
    }
    if (enrollmentIds.length) await tx.attendanceRecord.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
    if (enrollmentIds.length || sectionIds.length) {
      await tx.sectionMove.deleteMany({
        where: {
          OR: [
            ...(enrollmentIds.length ? [{ enrollmentId: { in: enrollmentIds } }] : []),
            ...(sectionIds.length ? [{ fromSectionId: { in: sectionIds } }, { toSectionId: { in: sectionIds } }] : []),
          ],
        },
      });
    }
    if (enrollmentIds.length || batchIds.length) {
      await tx.promotionDecision.deleteMany({
        where: {
          OR: [
            ...(enrollmentIds.length ? [{ enrollmentId: { in: enrollmentIds } }] : []),
            ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
          ],
        },
      });
    }

    await tx.promotionBatch.deleteMany({ where: { schoolId } });
    await tx.resultPublication.deleteMany({ where: { schoolId } });
    if (examSubjectIds.length) await tx.examSubject.deleteMany({ where: { id: { in: examSubjectIds } } });
    if (examIds.length) await tx.exam.deleteMany({ where: { id: { in: examIds } } });
    await tx.transferRequest.deleteMany({ where: { OR: [{ fromSchoolId: schoolId }, { toSchoolId: schoolId }] } });
    await tx.alumniRecord.deleteMany({ where: { schoolId } });
    await tx.studentDocument.deleteMany({ where: { schoolId } });
    await tx.announcement.deleteMany({ where: { schoolId } });
    await tx.studentFee.deleteMany({ where: { schoolId } });
    await tx.enrollment.deleteMany({ where: { schoolId } });

    if (sectionIds.length) await tx.section.deleteMany({ where: { id: { in: sectionIds } } });
    if (classIds.length) {
      await tx.classSubject.deleteMany({ where: { classGroupId: { in: classIds } } });
      await tx.classGroup.deleteMany({ where: { id: { in: classIds } } });
    }
    await tx.subject.deleteMany({ where: { schoolId } });
    await tx.academicYear.deleteMany({ where: { schoolId } });

    await removeStudentsOnlyAtThisSchool(tx, studentIds, schoolId);
    await tx.student.updateMany({ where: { previousSchoolId: schoolId }, data: { previousSchoolId: null } });
    await tx.guardian.updateMany({ where: { registeredSchoolId: schoolId }, data: { registeredSchoolId: null } });
    await removeSchoolAccounts(tx, schoolId);
    await tx.auditEvent.deleteMany({ where: { schoolId } });
    await tx.school.delete({ where: { id: schoolId } });
  }, { timeout: 30000 });
}

async function removeStudentsOnlyAtThisSchool(tx: Tx, studentIds: string[], schoolId: string) {
  if (!studentIds.length) return;
  const stillEnrolled = await tx.enrollment.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const keep = new Set(stillEnrolled.map((row) => row.studentId));
  const removeIds = studentIds.filter((id) => !keep.has(id));
  if (!removeIds.length) return;
  await tx.studentGuardian.deleteMany({ where: { studentId: { in: removeIds } } });
  await tx.studentDocument.deleteMany({ where: { studentId: { in: removeIds } } });
  await tx.alumniRecord.deleteMany({ where: { studentId: { in: removeIds } } });
  await tx.transferRequest.deleteMany({ where: { studentId: { in: removeIds } } });
  await tx.student.updateMany({ where: { id: { in: removeIds }, previousSchoolId: schoolId }, data: { previousSchoolId: null } });
  await tx.student.deleteMany({ where: { id: { in: removeIds } } });
}

async function removeSchoolAccounts(tx: Tx, schoolId: string) {
  const schoolUsers = await tx.user.findMany({
    where: { schoolId, role: { not: "SUPER_ADMIN" } },
    select: { id: true },
  });
  const linkedTeachers = await tx.teacher.findMany({
    where: { OR: [{ schools: { some: { schoolId } } }, { assignments: { some: { schoolId } } }] },
    select: { id: true, userId: true },
  });
  await tx.teacherSchool.deleteMany({ where: { schoolId } });
  await tx.teacherAssignment.deleteMany({ where: { schoolId } });
  const stillLinked = linkedTeachers.length
    ? await tx.teacher.findMany({
      where: {
        id: { in: ids(linkedTeachers) },
        OR: [{ schools: { some: {} } }, { assignments: { some: {} } }],
      },
      select: { id: true },
    })
    : [];
  const stillLinkedIds = new Set(ids(stillLinked));
  const orphanTeachers = linkedTeachers.filter((teacher) => !stillLinkedIds.has(teacher.id));
  if (orphanTeachers.length) await tx.teacher.deleteMany({ where: { id: { in: ids(orphanTeachers) } } });
  const staff = await tx.staffMember.findMany({ where: { schoolId }, select: { userId: true } });
  await tx.staffMember.deleteMany({ where: { schoolId } });

  const candidates = [...new Set([
    ...schoolUsers.map((user) => user.id),
    ...orphanTeachers.map((teacher) => teacher.userId),
    ...staff.map((member) => member.userId),
  ])];
  if (!candidates.length) {
    await tx.user.updateMany({ where: { schoolId }, data: { schoolId: null } });
    return;
  }
  const [teachers, staffLeft, guardians] = await Promise.all([
    tx.teacher.findMany({ where: { userId: { in: candidates } }, select: { userId: true } }),
    tx.staffMember.findMany({ where: { userId: { in: candidates } }, select: { userId: true } }),
    tx.guardian.findMany({ where: { userId: { in: candidates } }, select: { userId: true } }),
  ]);
  const keep = new Set<string>([
    ...teachers.map((row) => row.userId),
    ...staffLeft.map((row) => row.userId),
    ...guardians.flatMap((row) => (row.userId ? [row.userId] : [])),
  ]);
  const deletable = candidates.filter((id) => !keep.has(id));
  if (deletable.length) {
    await tx.refreshToken.deleteMany({ where: { userId: { in: deletable } } });
    await tx.inviteToken.deleteMany({ where: { userId: { in: deletable } } });
    await tx.user.deleteMany({ where: { id: { in: deletable }, role: { not: "SUPER_ADMIN" } } });
  }
  await tx.user.updateMany({ where: { schoolId }, data: { schoolId: null } });
}
