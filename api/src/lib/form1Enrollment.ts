import { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/error.js";

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

async function nextStudentNumber(tx: Prisma.TransactionClient, schoolId: string) {
  const key = `student-number:${schoolId}`;
  const floorRows = await tx.$queryRaw<Array<{ max: number }>>`
    SELECT COALESCE(MAX("studentNumber"::int), 0) AS max
    FROM "Enrollment"
    WHERE "schoolId" = ${schoolId} AND "studentNumber" ~ '^[0-9]+$'
  `;
  const floor = Number(floorRows[0]?.max ?? 0);
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, ${floor + 1})
    ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("IdSequence"."value", ${floor}) + 1
    RETURNING "value"
  `;
  return String(rows[0].value).padStart(5, "0");
}

export async function enrollClass8InForm1(
  tx: Prisma.TransactionClient,
  input: {
    student: { id: string; permanentId: string; secondaryPermanentId: string | null };
    organizationId: string;
    destinationSchoolId: string;
    academicYearId: string;
    section: { id: string; classGroupId: string };
  },
) {
  const active = await tx.enrollment.findFirst({ where: { studentId: input.student.id, status: "ACTIVE" } });
  if (active) throw new HttpError(409, "This student already has an active enrollment.");
  const existing = await tx.enrollment.findUnique({
    where: { studentId_academicYearId: { studentId: input.student.id, academicYearId: input.academicYearId } },
  });
  if (existing) throw new HttpError(409, "This student already has an enrollment in that year.");
  const studentNumber = await nextStudentNumber(tx, input.destinationSchoolId);
  const rollNumber = await nextValue(tx, `roll:${input.section.id}`);
  let secondaryPermanentId = input.student.secondaryPermanentId;
  if (!secondaryPermanentId) {
    const yearMark = String(new Date().getFullYear()).slice(2);
    const sequence = await nextValue(tx, `student:${input.organizationId}:${yearMark}:S`);
    secondaryPermanentId = `STU-${yearMark}-S-${String(sequence).padStart(6, "0")}`;
    await tx.student.update({ where: { id: input.student.id }, data: { status: "ACTIVE", secondaryPermanentId } });
    await tx.user.updateMany({
      where: { personKey: input.student.permanentId, role: "STUDENT" },
      data: { personKey: secondaryPermanentId, schoolId: input.destinationSchoolId },
    });
  } else {
    await tx.student.update({ where: { id: input.student.id }, data: { status: "ACTIVE" } });
  }
  const enrollment = await tx.enrollment.create({
    data: {
      studentId: input.student.id,
      schoolId: input.destinationSchoolId,
      academicYearId: input.academicYearId,
      classGroupId: input.section.classGroupId,
      sectionId: input.section.id,
      studentNumber,
      rollNumber,
      status: "ACTIVE",
    },
  });
  return { enrollment, secondaryPermanentId, rollNumber, studentNumber };
}
