import assert from "node:assert/strict";
import test from "node:test";
import { examinationFor, summarizeSubjects, summarizeYear, type ExamAverageInput, type EnrollmentScope } from "./lib/examAverages.js";

function subject(id: string, name: string, maxMarks: number, published: Partial<ExamAverageInput> = {}): ExamAverageInput {
  return {
    subjectId: id,
    name,
    maxMarks,
    published: false,
    absent: false,
    marks: null,
    ...published,
  };
}

test("partial results keep every assigned subject in the maximum", () => {
  const rows = [
    subject("s1", "One", 100, { published: true, marks: 100 }),
    subject("s2", "Two", 100, { published: true, marks: 100 }),
    ...Array.from({ length: 8 }, (_, index) => subject(`s${index + 3}`, `Subject ${index + 3}`, 100)),
  ];
  const term = summarizeSubjects("TERM_1", rows);
  assert.equal(term.subjectCount, 10);
  assert.equal(term.publishedCount, 2);
  assert.equal(term.pendingCount, 8);
  assert.equal(term.obtained, 200);
  assert.equal(term.possible, 1000);
  assert.equal(term.average, 20);
  assert.equal(term.status, "provisional");
  assert.equal(rows.filter((row) => !row.published).every((row) => row.marks === null), true);
});

test("complete results become a final average", () => {
  const term = summarizeSubjects("TERM_1", [
    subject("s1", "Biology", 100, { published: true, marks: 80 }),
    subject("s2", "Somali", 50, { published: true, marks: 40 }),
  ]);
  assert.equal(term.obtained, 120);
  assert.equal(term.possible, 150);
  assert.equal(term.average, 80);
  assert.equal(term.pendingCount, 0);
  assert.equal(term.status, "final");
});

test("different maximum marks stay in the denominator when unpublished", () => {
  const term = summarizeSubjects("TERM_2", [
    subject("s1", "Physics", 50, { published: true, marks: 40 }),
    subject("s2", "Chemistry", 80),
    subject("s3", "Arabic", 120),
  ]);
  assert.equal(term.obtained, 40);
  assert.equal(term.possible, 250);
  assert.equal(term.average, 16);
  assert.equal(term.status, "provisional");
});

test("overall average adds both terms instead of averaging the two percentages", () => {
  const term1 = summarizeSubjects("TERM_1", [
    subject("a", "One", 100, { published: true, marks: 100 }),
    subject("b", "Two", 100, { published: true, marks: 100 }),
    ...Array.from({ length: 8 }, (_, index) => subject(`p${index}`, `Pending ${index}`, 100)),
  ]);
  const term2 = summarizeSubjects("TERM_2", [
    subject("c", "Three", 100, { published: true, marks: 100 }),
    ...Array.from({ length: 7 }, (_, index) => subject(`q${index}`, `Later ${index}`, 100)),
  ]);
  const year = summarizeYear(term1, term2);
  assert.equal(term1.possible, 1000);
  assert.equal(term2.possible, 800);
  assert.equal(year.obtained, 300);
  assert.equal(year.possible, 1800);
  assert.equal(year.average, 16.67);
  assert.equal(year.status, "provisional");
  assert.notEqual(year.average, 16.25);
});

test("an official absence is not stored or averaged as zero", () => {
  const term = summarizeSubjects("TERM_1", [
    subject("s1", "Biology", 100, { published: true, marks: 70 }),
    subject("s2", "Somali", 100, { published: true, absent: true, marks: null }),
  ]);
  assert.equal(term.obtained, 70);
  assert.equal(term.possible, 100);
  assert.equal(term.average, 70);
  assert.equal(term.absentCount, 1);
  assert.equal(term.pendingCount, 0);
  assert.equal(term.status, "final");
});

test("duplicate subject rows are counted once", () => {
  const term = summarizeSubjects("TERM_1", [
    subject("s1", "Biology", 100, { published: true, marks: 55 }),
    subject("s1", "Biology", 100, { published: true, marks: 55 }),
    subject("s2", "Physics", 100),
  ]);
  assert.equal(term.subjectCount, 2);
  assert.equal(term.obtained, 55);
  assert.equal(term.possible, 200);
  assert.equal(term.average, 27.5);
});

test("academic years do not share subjects or marks", () => {
  const first: EnrollmentScope = {
    id: "enr-2026",
    academicYearId: "year-2026",
    classGroupId: "form-2",
    sectionId: "section-b",
    sectionSubjectIds: ["biology", "physics"],
  };
  const second: EnrollmentScope = {
    id: "enr-2027",
    academicYearId: "year-2027",
    classGroupId: "form-3",
    sectionId: "section-b",
    sectionSubjectIds: ["chemistry"],
  };
  const exams = [
    {
      academicYearId: "year-2026",
      term: "TERM_1" as const,
      sectionIds: ["section-b"],
      subjects: [
        { id: "exam-bio", subjectId: "biology", classGroupId: "form-2", maxMarks: 100 },
        { id: "exam-phy", subjectId: "physics", classGroupId: "form-2", maxMarks: 100 },
        { id: "other-class", subjectId: "history", classGroupId: "form-4", maxMarks: 100 },
      ],
    },
    {
      academicYearId: "year-2027",
      term: "TERM_1" as const,
      sectionIds: ["section-b"],
      subjects: [
        { id: "exam-chem", subjectId: "chemistry", classGroupId: "form-3", maxMarks: 80 },
      ],
    },
  ];
  const names = new Map([["biology", "Biology"], ["physics", "Physics"], ["chemistry", "Chemistry"], ["history", "History"]]);
  const published = [{ enrollmentId: "enr-2026", examSubjectId: "exam-bio", marks: 100, isAbsent: false }];
  const older = examinationFor(first, exams, names, published);
  const newer = examinationFor(second, exams, names, published);
  assert.equal(older.term1.subjectCount, 2);
  assert.equal(older.term1.obtained, 100);
  assert.equal(older.term1.possible, 200);
  assert.equal(older.term1.average, 50);
  assert.equal(older.term2.status, "unavailable");
  assert.equal(newer.term1.subjectCount, 1);
  assert.equal(newer.term1.obtained, 0);
  assert.equal(newer.term1.possible, 80);
  assert.equal(newer.term1.average, 0);
  assert.equal(newer.overall.possible, 80);
});

test("a subject assigned to the class but not the section is excluded", () => {
  const enrollment: EnrollmentScope = {
    id: "enr",
    academicYearId: "year",
    classGroupId: "form-2",
    sectionId: "section-a",
    sectionSubjectIds: ["biology"],
  };
  const result = examinationFor(enrollment, [{
    academicYearId: "year",
    term: "TERM_1",
    sectionIds: ["section-a"],
    subjects: [
      { id: "bio", subjectId: "biology", classGroupId: "form-2", maxMarks: 100 },
      { id: "phy", subjectId: "physics", classGroupId: "form-2", maxMarks: 100 },
    ],
  }], new Map([["biology", "Biology"], ["physics", "Physics"]]), []);
  assert.deepEqual(result.term1.subjects.map((row) => row.name), ["Biology"]);
  assert.equal(result.term1.possible, 100);
});
