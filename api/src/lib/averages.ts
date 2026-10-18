type Db = {
  subjectResult: {
    findMany: (args: unknown) => Promise<Array<{
      marks: number | null;
      isAbsent: boolean;
      examSubject: { maxMarks: number; exam: { term: "TERM_1" | "TERM_2" } };
    }>>;
  };
};

export async function annualAverage(db: Db, enrollmentId: string) {
  const results = await db.subjectResult.findMany({
    where: { enrollmentId, state: "PUBLISHED" },
    include: { examSubject: { include: { exam: true } } },
  });
  const term = (code: "TERM_1" | "TERM_2") => {
    const rows = results.filter((item) => item.examSubject.exam.term === code && !item.isAbsent && item.marks !== null);
    if (!rows.length) return null;
    const obtained = rows.reduce((sum, item) => sum + (item.marks ?? 0), 0);
    const possible = rows.reduce((sum, item) => sum + item.examSubject.maxMarks, 0);
    if (!possible) return null;
    return (obtained / possible) * 100;
  };
  const term1 = term("TERM_1");
  const term2 = term("TERM_2");
  if (term1 === null || term2 === null) {
    return { term1, term2, annual: null as number | null, ready: false };
  }
  return { term1, term2, annual: term1 * 0.5 + term2 * 0.5, ready: true };
}
