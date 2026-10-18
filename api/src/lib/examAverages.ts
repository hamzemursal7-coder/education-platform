export type TermCode = "TERM_1" | "TERM_2";
export type AverageStatus = "final" | "provisional" | "unavailable";

export type ExamAverageInput = {
  subjectId: string;
  name: string;
  maxMarks: number;
  published: boolean;
  absent: boolean;
  marks: number | null;
  examDate?: string | null;
};

export type SubjectLine = {
  subjectId: string;
  name: string;
  maxMarks: number;
  marks: number | null;
  percentage: number | null;
  published: boolean;
  absent: boolean;
  pending: boolean;
};

export type TermAverage = {
  term: TermCode;
  label: string;
  examDate: string | null;
  subjectCount: number;
  publishedCount: number;
  pendingCount: number;
  absentCount: number;
  obtained: number;
  possible: number;
  average: number | null;
  status: AverageStatus;
  subjects: SubjectLine[];
};

export type YearAverage = {
  obtained: number;
  possible: number;
  average: number | null;
  status: AverageStatus;
  subjectCount: number;
  publishedCount: number;
  pendingCount: number;
};

export type EnrollmentScope = {
  id: string;
  academicYearId: string;
  classGroupId: string;
  sectionId: string;
  sectionSubjectIds: string[];
};

export type AssignedExamSubject = {
  id: string;
  subjectId: string;
  classGroupId: string;
  maxMarks: number;
  examDay?: Date | string | null;
};

export type AssignedExam = {
  academicYearId: string;
  term: TermCode;
  sectionIds: string[];
  subjects: AssignedExamSubject[];
};

export type PublishedMark = {
  enrollmentId: string;
  examSubjectId: string;
  marks: number | null;
  isAbsent: boolean;
};

/** Two decimal places, so 300 / 1800 is 16.67 rather than a rounded tenth. */
export function roundPercent(obtained: number, possible: number) {
  if (possible <= 0) return null;
  return Math.round((obtained / possible) * 10000) / 100;
}

function subjectPercentage(marks: number | null, maxMarks: number) {
  if (marks == null || maxMarks <= 0) return null;
  return roundPercent(marks, maxMarks);
}

/**
 * Average = published marks obtained / maximum marks of every applicable subject.
 * Unpublished subjects stay in the denominator and are never stored as zero.
 * An officially recorded absence is left out of both sides, matching the existing grading policy.
 * Duplicate subject ids are counted once.
 */
export function summarizeSubjects(term: TermCode, rows: ExamAverageInput[]): TermAverage {
  const unique = new Map<string, ExamAverageInput>();
  for (const row of rows) {
    if (row.maxMarks <= 0) continue;
    const current = unique.get(row.subjectId);
    if (!current || (!current.published && row.published)) unique.set(row.subjectId, row);
  }
  const subjects = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  const pending = subjects.filter((row) => !row.published);
  const published = subjects.filter((row) => row.published);
  const absent = published.filter((row) => row.absent);
  const counted = subjects.filter((row) => !(row.published && row.absent));
  const obtained = counted.reduce((sum, row) => sum + (row.published && row.marks != null ? row.marks : 0), 0);
  const possible = counted.reduce((sum, row) => sum + row.maxMarks, 0);
  const examDate = subjects.map((row) => row.examDate).find((value) => value) ?? null;
  return {
    term,
    label: term === "TERM_1" ? "Term 1" : "Term 2",
    examDate,
    subjectCount: subjects.length,
    publishedCount: published.length,
    pendingCount: pending.length,
    absentCount: absent.length,
    obtained,
    possible,
    average: roundPercent(obtained, possible),
    status: subjects.length === 0 ? "unavailable" : pending.length === 0 ? "final" : "provisional",
    subjects: subjects.map((row) => ({
      subjectId: row.subjectId,
      name: row.name,
      maxMarks: row.maxMarks,
      marks: row.published && !row.absent ? row.marks : null,
      percentage: row.published && !row.absent ? subjectPercentage(row.marks, row.maxMarks) : null,
      published: row.published,
      absent: row.published && row.absent,
      pending: !row.published,
    })),
  };
}

export function summarizeYear(term1: TermAverage, term2: TermAverage): YearAverage {
  const obtained = term1.obtained + term2.obtained;
  const possible = term1.possible + term2.possible;
  const subjectCount = term1.subjectCount + term2.subjectCount;
  const pendingCount = term1.pendingCount + term2.pendingCount;
  return {
    obtained,
    possible,
    average: roundPercent(obtained, possible),
    status: subjectCount === 0 ? "unavailable" : pendingCount === 0 ? "final" : "provisional",
    subjectCount,
    publishedCount: term1.publishedCount + term2.publishedCount,
    pendingCount,
  };
}

export function subjectsForTerm(
  enrollment: EnrollmentScope,
  term: TermCode,
  exams: AssignedExam[],
  names: Map<string, string>,
  published: PublishedMark[],
): ExamAverageInput[] {
  const exam = exams.find((item) =>
    item.academicYearId === enrollment.academicYearId
    && item.term === term
    && item.sectionIds.includes(enrollment.sectionId),
  );
  if (!exam) return [];
  const allowed = new Set(enrollment.sectionSubjectIds);
  const chosen = exam.subjects.filter((subject) =>
    subject.classGroupId === enrollment.classGroupId
    && subject.maxMarks > 0
    && (allowed.size === 0 || allowed.has(subject.subjectId)),
  );
  const unique = new Map<string, AssignedExamSubject>();
  for (const subject of chosen) {
    if (!unique.has(subject.subjectId)) unique.set(subject.subjectId, subject);
  }
  return [...unique.values()].map((subject) => {
    const mark = published.find((row) => row.enrollmentId === enrollment.id && row.examSubjectId === subject.id);
    const examDate = subject.examDay ? new Date(subject.examDay).toISOString() : null;
    return {
      subjectId: subject.subjectId,
      name: names.get(subject.subjectId) ?? "Subject",
      maxMarks: subject.maxMarks,
      published: Boolean(mark),
      absent: Boolean(mark?.isAbsent),
      marks: mark && !mark.isAbsent ? mark.marks : null,
      examDate,
    };
  });
}

export function examinationFor(
  enrollment: EnrollmentScope,
  exams: AssignedExam[],
  names: Map<string, string>,
  published: PublishedMark[],
) {
  const term1 = summarizeSubjects("TERM_1", subjectsForTerm(enrollment, "TERM_1", exams, names, published));
  const term2 = summarizeSubjects("TERM_2", subjectsForTerm(enrollment, "TERM_2", exams, names, published));
  return { term1, term2, overall: summarizeYear(term1, term2) };
}

type ExamReader = {
  exam: {
    findMany: (args: {
      where: {
        academicYearId: { in: string[] };
        sections: { some: { sectionId: { in: string[] } } };
      };
      include: {
        sections: { select: { sectionId: true } };
        subjects: true;
      };
    }) => Promise<Array<{
      academicYearId: string;
      term: TermCode;
      sections: Array<{ sectionId: string }>;
      subjects: Array<{ id: string; subjectId: string; classGroupId: string; maxMarks: number; examDay: Date | null }>;
    }>>;
  };
  subject: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }) => Promise<Array<{ id: string; name: string }>>;
  };
};

export async function loadExaminations(
  db: ExamReader,
  enrollments: EnrollmentScope[],
  published: PublishedMark[],
  knownNames: Map<string, string>,
) {
  const yearIds = [...new Set(enrollments.map((row) => row.academicYearId))];
  const sectionIds = [...new Set(enrollments.map((row) => row.sectionId))];
  const exams = yearIds.length && sectionIds.length
    ? await db.exam.findMany({
      where: {
        academicYearId: { in: yearIds },
        sections: { some: { sectionId: { in: sectionIds } } },
      },
      include: {
        sections: { select: { sectionId: true } },
        subjects: true,
      },
    })
    : [];
  const names = new Map(knownNames);
  const missing = [...new Set(exams.flatMap((exam) => exam.subjects.map((subject) => subject.subjectId)))].filter((id) => !names.has(id));
  if (missing.length) {
    const rows = await db.subject.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } });
    rows.forEach((row) => names.set(row.id, row.name));
  }
  const assigned: AssignedExam[] = exams.map((exam) => ({
    academicYearId: exam.academicYearId,
    term: exam.term,
    sectionIds: exam.sections.map((section) => section.sectionId),
    subjects: exam.subjects.map((subject) => ({
      id: subject.id,
      subjectId: subject.subjectId,
      classGroupId: subject.classGroupId,
      maxMarks: subject.maxMarks,
      examDay: subject.examDay,
    })),
  }));
  return new Map(enrollments.map((enrollment) => [enrollment.id, examinationFor(enrollment, assigned, names, published)]));
}
