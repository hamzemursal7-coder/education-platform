export type PromotionStatus = "PASS" | "FAIL" | "REVIEW" | "GRADUATION" | "PENDING";

export type Term2Subject = {
  marks: number | null;
  isAbsent: boolean;
  maxMarks: number;
  minMarks: number;
};

export function judgeTerm2(input: {
  examSubjectCount: number;
  results: Term2Subject[];
  terminal: boolean;
}) {
  const scored = input.results.filter((row) => !row.isAbsent && row.marks !== null && row.maxMarks > 0);
  const obtained = scored.reduce((sum, row) => sum + (row.marks ?? 0), 0);
  const possible = scored.reduce((sum, row) => sum + row.maxMarks, 0);
  const average = possible ? Math.round((obtained / possible) * 1000) / 10 : null;
  if (input.examSubjectCount === 0) {
    return { status: "PENDING" as const, reason: "Term 2 exam has not been set up for this class.", average };
  }
  if (input.results.length < input.examSubjectCount) {
    return { status: "PENDING" as const, reason: "Term 2 results have not been published for every subject.", average };
  }
  if (input.results.some((row) => row.isAbsent)) {
    return { status: "REVIEW" as const, reason: "A subject is marked absent. Choose the outcome after review.", average };
  }
  if (average == null || average < 50) return { status: "FAIL" as const, reason: "The term average is below 50%.", average };
  if (input.terminal) return { status: "GRADUATION" as const, reason: "Eligible to complete this stage.", average };
  return { status: "PASS" as const, reason: "The term average is 50% or higher.", average };
}

export type MarkProgress = "MISSING" | "DRAFT" | "SUBMITTED" | "REJECTED" | "VERIFIED" | "PUBLISHED";

export function term2BlockReason(input: {
  termConfigured: boolean;
  examCreated: boolean;
  subjectCount: number;
  states: MarkProgress[];
}) {
  if (!input.termConfigured && !input.examCreated) return "Term 2 is not configured for this academic year.";
  if (!input.examCreated) return "Term 2 exam has not been created for this class.";
  if (input.subjectCount === 0) return "Term 2 exam has no subjects for this class.";
  if (input.states.length < input.subjectCount || input.states.some((state) => state === "MISSING" || state === "DRAFT")) {
    return "Marks have not been submitted for every subject.";
  }
  if (input.states.some((state) => state === "REJECTED")) return "Marks were rejected and have not been submitted again.";
  if (input.states.some((state) => state === "SUBMITTED")) return "Marks are awaiting admin review.";
  if (input.states.some((state) => state === "VERIFIED")) return "Results are approved but not published.";
  return null;
}
