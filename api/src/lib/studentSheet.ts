import { Readable } from "node:stream";
import type { LevelCode } from "@prisma/client";
import ExcelJS from "exceljs";
import { levelLabel } from "./levels.js";

export const studentSheetColumns = [
  { key: "studentId", header: "Student ID" },
  { key: "rollNumber", header: "Roll no." },
  { key: "firstName", header: "First name" },
  { key: "fatherName", header: "Father name" },
  { key: "grandfatherName", header: "Grandfather name" },
  { key: "gender", header: "Gender" },
  { key: "dateOfBirth", header: "Date of birth" },
  { key: "phone", header: "Phone" },
  { key: "nationalId", header: "NIRA" },
  { key: "academicYear", header: "Academic year" },
  { key: "className", header: "Class" },
  { key: "section", header: "Section" },
  { key: "status", header: "Status" },
  { key: "parentName", header: "Parent name" },
  { key: "parentPhone", header: "Parent phone" },
  { key: "parentEmail", header: "Parent email" },
  { key: "previousSchool", header: "Previous school" },
  { key: "previousClass", header: "Previous class" },
  { key: "leavingYear", header: "Leaving year" },
  { key: "transferCertificate", header: "Transfer certificate" },
] as const;

export type StudentSheetKey = (typeof studentSheetColumns)[number]["key"];

export type StudentSheetRow = Record<StudentSheetKey, string> & { rowNumber: number };

const headerAliases: Record<string, StudentSheetKey> = {
  "student id": "studentId",
  "studentid": "studentId",
  "roll no": "rollNumber",
  "roll no.": "rollNumber",
  "roll number": "rollNumber",
  "first name": "firstName",
  "father name": "fatherName",
  "grandfather name": "grandfatherName",
  gender: "gender",
  "date of birth": "dateOfBirth",
  dob: "dateOfBirth",
  phone: "phone",
  nira: "nationalId",
  "national id": "nationalId",
  "academic year": "academicYear",
  year: "academicYear",
  class: "className",
  "class / form": "className",
  "class/form": "className",
  form: "className",
  section: "section",
  status: "status",
  "enrollment status": "status",
  "parent name": "parentName",
  parent: "parentName",
  "parent phone": "parentPhone",
  "parent email": "parentEmail",
  "previous school": "previousSchool",
  "previous class": "previousClass",
  "leaving year": "leavingYear",
  "transfer certificate": "transferCertificate",
};

const requiredHeaders: StudentSheetKey[] = [
  "firstName",
  "fatherName",
  "grandfatherName",
  "gender",
  "dateOfBirth",
  "academicYear",
  "className",
  "section",
];

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.*]/g, "");
}

export function parseGender(value: string) {
  const text = value.trim().toLowerCase();
  if (["male", "m", "lab", "boy"].includes(text)) return "MALE" as const;
  if (["female", "f", "dheddig", "dhedig", "girl"].includes(text)) return "FEMALE" as const;
  return null;
}

export function parseLevel(value: string): LevelCode | null {
  const text = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const match = text.match(/^(?:class|fasal|cutub|form|foom)?\s*([1-8])$/);
  if (!match) return null;
  const number = match[1];
  if (text.startsWith("form") || text.startsWith("foom")) {
    return number >= "1" && number <= "4" ? (`FORM_${number}` as LevelCode) : null;
  }
  if (text.startsWith("class") || text.startsWith("fasal") || text.startsWith("cutub")) {
    return `CLASS_${number}` as LevelCode;
  }
  if (number >= "1" && number <= "4" && text === number) return null;
  return number <= "8" ? (`CLASS_${number}` as LevelCode) : null;
}

export function parseSheetDate(value: string) {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const year = iso ? Number(iso[1]) : dmy ? Number(dmy[3]) : 0;
  const month = iso ? Number(iso[2]) : dmy ? Number(dmy[2]) : 0;
  const day = iso ? Number(iso[3]) : dmy ? Number(dmy[1]) : 0;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

export function splitParentName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts[0].length < 2 || parts.slice(1).join(" ").length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function studentIdentityKey(firstName: string, fatherName: string, grandfatherName: string, dateOfBirth: string) {
  const name = [firstName, fatherName, grandfatherName].map((part) => part.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
  return `${name}|${dateOfBirth}`;
}

export function phoneKey(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return digits.slice(-9);
}

function cellText(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  return String(value).trim();
}

export async function readStudentSheet(buffer: Buffer, filename: string) {
  const workbook = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The file has no sheet.");
  let headerRowNumber = 0;
  const columns = new Map<number, StudentSheetKey>();
  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber || rowNumber > 5) return;
    const found = new Map<number, StudentSheetKey>();
    row.eachCell((cell, column) => {
      const key = headerAliases[normalizeHeader(cellText(cell.value))];
      if (key) found.set(column, key);
    });
    if (requiredHeaders.every((key) => [...found.values()].includes(key))) {
      headerRowNumber = rowNumber;
      found.forEach((key, column) => columns.set(column, key));
    }
  });
  if (!headerRowNumber) {
    throw new Error("The first row must include First name, Father name, Grandfather name, Gender, Date of birth, Academic year, Class, and Section.");
  }
  const rows: StudentSheetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const record = Object.fromEntries(studentSheetColumns.map((column) => [column.key, ""])) as Record<StudentSheetKey, string>;
    columns.forEach((key, column) => {
      record[key] = cellText(row.getCell(column).value);
    });
    if (Object.values(record).every((value) => !value)) return;
    rows.push({ ...record, rowNumber });
  });
  if (rows.length > 400) throw new Error("Import up to 400 students at a time.");
  return rows;
}

export async function writeStudentWorkbook(rows: Array<Partial<Record<StudentSheetKey, string | number | null>>>, placement: Array<{ year: string; className: string; section: string }>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");
  sheet.columns = studentSheetColumns.map((column) => ({ header: column.header, key: column.key, width: Math.max(16, column.header.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  const guide = workbook.addWorksheet("Classes");
  guide.columns = [
    { header: "Academic year", key: "year", width: 22 },
    { header: "Class", key: "className", width: 16 },
    { header: "Section", key: "section", width: 16 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const item of placement) guide.addRow(item);
  guide.addRow([]);
  guide.addRow(["Leave Student ID and Roll no. empty for a new student. The system assigns both. Class must be written as Class 1 or Form 1. Gender is MALE or FEMALE. Date of birth is YYYY-MM-DD."]);
  guide.addRow(["Parent name, phone, and email are optional. The same parent phone links siblings to one parent. A portal login is not created by this file."]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function levelText(level: LevelCode) {
  return levelLabel(level);
}
