import assert from "node:assert/strict";
import test from "node:test";
import { parseGender, parseLevel, parseSheetDate, readStudentSheet, splitParentName, writeStudentWorkbook } from "./lib/studentSheet.js";

test("student sheet understands class, form, gender, and dates", () => {
  assert.equal(parseLevel("Form 1"), "FORM_1");
  assert.equal(parseLevel("Class 8"), "CLASS_8");
  assert.equal(parseLevel("form 5"), null);
  assert.equal(parseLevel("1"), null);
  assert.equal(parseGender("Female"), "FEMALE");
  assert.equal(parseGender("lab"), "MALE");
  assert.equal(parseSheetDate("2014-05-12"), "2014-05-12");
  assert.equal(parseSheetDate("12/05/2014"), "2014-05-12");
  assert.equal(parseSheetDate("2014-02-31"), null);
  assert.deepEqual(splitParentName("Farah Aadan"), { firstName: "Farah", lastName: "Aadan" });
  assert.equal(splitParentName("Farah"), null);
});

test("student sheet keeps a new row and its parent together", async () => {
  const buffer = await writeStudentWorkbook([
    {
      firstName: "Xasan",
      fatherName: "Ali",
      grandfatherName: "Aadan",
      gender: "MALE",
      dateOfBirth: "2014-05-12",
      academicYear: "2026",
      className: "Form 1",
      section: "A",
      parentName: "Farah Aadan",
      parentPhone: "08093689678",
    },
  ], [{ year: "2026", className: "Form 1", section: "A" }]);
  const rows = await readStudentSheet(buffer, "students.xlsx");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].firstName, "Xasan");
  assert.equal(rows[0].className, "Form 1");
  assert.equal(rows[0].parentName, "Farah Aadan");
  assert.equal(rows[0].parentPhone, "08093689678");
  assert.equal(rows[0].dateOfBirth, "2014-05-12");
});
