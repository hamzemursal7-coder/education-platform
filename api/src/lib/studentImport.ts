import { Prisma, type LevelCode, type SchoolType } from "@prisma/client";
import { HttpError } from "../middleware/error.js";
import { levelsForSchool } from "./levels.js";
import { prisma } from "./prisma.js";
import { parseGender, parseLevel, parseSheetDate, phoneKey, splitParentName, studentIdentityKey, type StudentSheetRow } from "./studentSheet.js";

type SchoolRef = { id: string; organizationId: string; type: SchoolType };

export type ImportSkip = { row: number; name: string; reason: string };

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

export async function importStudentRows(school: SchoolRef, rows: StudentSheetRow[], defaultYearId = "") {
  const years = await prisma.academicYear.findMany({
    where: { schoolId: school.id },
    include: { classes: { include: { sections: true } } },
  });
  const otherSchools = await prisma.school.findMany({
    where: { organizationId: school.organizationId, NOT: { id: school.id } },
    select: { id: true, name: true },
  });
  const guardians = await prisma.guardian.findMany({
    where: { organizationId: school.organizationId },
    select: { id: true, phone: true, email: true },
  });
  const existingStudents = await prisma.student.findMany({
    where: { organizationId: school.organizationId, enrollments: { some: { schoolId: school.id } } },
    select: { firstName: true, fatherName: true, grandfatherName: true, dateOfBirth: true },
  });
  const existingPeople = new Set(existingStudents.map((student) => studentIdentityKey(student.firstName, student.fatherName, student.grandfatherName, student.dateOfBirth.toISOString().slice(0, 10))));
  const seenPeople = new Set<string>();
  const allowed = new Set(levelsForSchool(school.type));
  const seenNira = new Set<string>();
  const skipped: ImportSkip[] = [];
  const students: Array<{ row: number; name: string; studentId: string; rollNumber: number; academicYearId: string }> = [];

  for (const row of rows) {
    const name = [row.firstName, row.fatherName, row.grandfatherName].filter(Boolean).join(" ") || `Row ${row.rowNumber}`;
    const outcome = await importOne(school, row, { years, otherSchools, guardians, allowed, seenNira, existingPeople, seenPeople, defaultYearId });
    if (typeof outcome === "string") skipped.push({ row: row.rowNumber, name, reason: outcome });
    else students.push({ row: row.rowNumber, name, ...outcome });
  }
  return { accepted: students.length, rejected: skipped.length, created: students.length, skipped, students };
}

async function importOne(
  school: SchoolRef,
  row: StudentSheetRow,
  context: {
    years: Array<{ id: string; name: string; isCurrent: boolean; classes: Array<{ id: string; level: LevelCode; sections: Array<{ id: string; name: string }> }> }>;
    otherSchools: Array<{ id: string; name: string }>;
    guardians: Array<{ id: string; phone: string; email: string | null }>;
    allowed: Set<LevelCode>;
    seenNira: Set<string>;
    existingPeople: Set<string>;
    seenPeople: Set<string>;
    defaultYearId: string;
  },
) {
  if (row.firstName.trim().length < 2 || row.fatherName.trim().length < 2 || row.grandfatherName.trim().length < 2) {
    return "Enter the student's first name, father name, and grandfather name.";
  }
  const gender = parseGender(row.gender);
  if (!gender) return "Gender must be MALE or FEMALE.";
  const dateOfBirth = parseSheetDate(row.dateOfBirth);
  if (!dateOfBirth) return "Date of birth must be a real past date, written as YYYY-MM-DD.";
  const level = parseLevel(row.className);
  if (!level || !context.allowed.has(level)) return "Class must be Class 1–8 or Form 1–4, and it must belong to this school.";
  const year = row.academicYear.trim()
    ? context.years.find((item) => item.name.trim().toLowerCase() === row.academicYear.trim().toLowerCase())
    : context.years.find((item) => item.id === context.defaultYearId) ?? context.years.find((item) => item.isCurrent) ?? context.years[0];
  if (!year) return `Academic year "${row.academicYear || "blank"}" was not found at this school.`;
  const classGroup = year.classes.find((item) => item.level === level);
  if (!classGroup) return `${row.className} is not open in ${year.name}.`;
  const sectionName = row.section.trim().toLowerCase().replace(/^section\s+/, "");
  const section = classGroup.sections.find((item) => item.name.trim().toLowerCase() === sectionName);
  if (!section) return `Section "${row.section || "blank"}" was not found in ${row.className}.`;

  const studentId = row.studentId.trim();
  if (!isBlankStudentId(studentId)) {
    const existing = await prisma.student.findFirst({
      where: { OR: [{ permanentId: studentId }, { secondaryPermanentId: studentId }] },
      select: { enrollments: { where: { schoolId: school.id }, select: { id: true }, take: 1 } },
    });
    if (!existing) return "Student ID was not found. Leave Student ID empty to add a new student.";
    if (existing.enrollments.length) return "Duplicate. This student is already in this school.";
    return "Duplicate. This Student ID belongs to another school.";
  }

  const nira = row.nationalId.trim();
  if (nira) {
    const key = nira.toLowerCase();
    if (context.seenNira.has(key)) return "Duplicate. This NIRA is repeated in the file.";
    const taken = await prisma.student.findUnique({ where: { nationalId: nira }, select: { id: true } });
    if (taken) return "Duplicate. This NIRA is already registered.";
    context.seenNira.add(key);
  }

  const identity = studentIdentityKey(row.firstName, row.fatherName, row.grandfatherName, dateOfBirth);
  if (context.seenPeople.has(identity)) return "Duplicate. This student is repeated in the file.";
  if (context.existingPeople.has(identity)) return "Duplicate. This student is already in this school.";

  let previousSchoolId: string | null = null;
  if (row.previousSchool.trim()) {
    const matches = context.otherSchools.filter((item) => item.name.trim().toLowerCase() === row.previousSchool.trim().toLowerCase());
    if (matches.length !== 1) return `Previous school "${row.previousSchool}" was not found.`;
    previousSchoolId = matches[0].id;
  } else if (row.previousClass.trim() || row.leavingYear.trim() || row.transferCertificate.trim()) {
    return "Enter the previous school name, or leave the transfer columns empty.";
  }

  const parentBits = [row.parentName, row.parentPhone, row.parentEmail].some((value) => value.trim());
  let parent: { id: string } | null = null;
  if (parentBits) {
    const split = splitParentName(row.parentName);
    if (!split) return "Parent name needs a first and last name, or leave the parent columns empty.";
    const email = row.parentEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Parent email is not valid.";
    const matched = matchGuardian(context.guardians, row.parentPhone, email);
    if (matched.error) return matched.error;
    parent = matched.guardian;
    if (!parent) {
      parent = await prisma.$transaction(async (tx) => {
        const sequence = await nextValue(tx, `guardian:${school.organizationId}`);
        return tx.guardian.create({
          data: {
            organizationId: school.organizationId,
            registeredSchoolId: school.id,
            publicId: `PAR-${String(sequence).padStart(5, "0")}`,
            firstName: split.firstName,
            lastName: split.lastName,
            phone: row.parentPhone.trim(),
            email: email || null,
          },
          select: { id: true },
        });
      });
      context.guardians.push({ id: parent.id, phone: row.parentPhone.trim(), email: email || null });
    }
  }

  const band = level.startsWith("CLASS_") ? "P" : "S";
  const yearMark = String(new Date().getFullYear()).slice(2);
  let saved: { studentId: string; rollNumber: number; academicYearId: string };
  try {
    saved = await prisma.$transaction(async (tx) => {
      const sequence = await nextValue(tx, `student:${school.organizationId}:${yearMark}:${band}`);
      const permanentId = `STU-${yearMark}-${band}-${String(sequence).padStart(6, "0")}`;
      const studentNumber = await nextStudentNumber(tx, school.id);
      const rollNumber = await nextRollNumber(tx, section.id);
      const student = await tx.student.create({
        data: {
          organizationId: school.organizationId,
          permanentId,
          firstName: row.firstName.trim(),
          fatherName: row.fatherName.trim(),
          grandfatherName: row.grandfatherName.trim(),
          gender,
          dateOfBirth: new Date(dateOfBirth),
          phone: row.phone.trim() || null,
          nationalId: nira || null,
          previousSchoolId,
          previousClass: previousSchoolId ? row.previousClass.trim() || null : null,
          leavingYear: previousSchoolId ? row.leavingYear.trim() || null : null,
          transferCertificateNo: previousSchoolId ? row.transferCertificate.trim() || null : null,
        },
      });
      await tx.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          academicYearId: year.id,
          classGroupId: classGroup.id,
          sectionId: section.id,
          studentNumber,
          rollNumber,
        },
      });
      if (parent) {
        await tx.studentGuardian.create({
          data: { studentId: student.id, guardianId: parent.id, relationship: "GUARDIAN" },
        });
      }
      return { studentId: permanentId, rollNumber, academicYearId: year.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "Duplicate. This student could not be saved because a NIRA or number is already used.";
    }
    if (error instanceof HttpError) return error.message;
    return "This row could not be saved.";
  }
  context.seenPeople.add(identity);
  context.existingPeople.add(identity);
  return saved;
}

function isBlankStudentId(value: string) {
  const text = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return !text || text === "na" || text === "none" || text === "new";
}

function matchGuardian(guardians: Array<{ id: string; phone: string; email: string | null }>, phone: string, email: string) {
  const key = phoneKey(phone);
  const byPhone = key ? guardians.find((guardian) => phoneKey(guardian.phone) === key) : undefined;
  const byEmail = email ? guardians.find((guardian) => (guardian.email ?? "").toLowerCase() === email) : undefined;
  if (byPhone && byEmail && byPhone.id !== byEmail.id) return { error: "Parent phone and email belong to different parents.", guardian: null };
  return { error: "", guardian: byPhone ?? byEmail ?? null };
}

async function nextStudentNumber(tx: Prisma.TransactionClient, schoolId: string) {
  const rows = await tx.enrollment.findMany({ where: { schoolId }, select: { studentNumber: true } });
  const highest = rows.reduce((max, row) => (/^\d+$/.test(row.studentNumber) ? Math.max(max, Number(row.studentNumber)) : max), 0);
  return String(highest + 1).padStart(5, "0");
}

async function nextRollNumber(tx: Prisma.TransactionClient, sectionId: string) {
  const highest = await tx.enrollment.aggregate({ where: { sectionId }, _max: { rollNumber: true } });
  return (highest._max.rollNumber ?? 0) + 1;
}
