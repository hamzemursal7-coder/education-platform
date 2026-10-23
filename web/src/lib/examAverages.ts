/** Same denominator rule as api/src/lib/examAverages.ts. Absent subjects remain in the denominator (maxMarks) and yield 0 marks, directly affecting the average until a re-exam is recorded. */
export function provisionalTotal(rows: Array<{ maxMarks: number; marks: number | null; counted: boolean; absent?: boolean }>) {
  const counted = rows.filter((row) => row.maxMarks > 0);
  const obtained = counted.reduce((sum, row) => sum + (!row.absent ? (row.marks ?? 0) : 0), 0);
  const possible = counted.reduce((sum, row) => sum + row.maxMarks, 0);
  const pending = rows.filter((row) => row.maxMarks > 0 && row.marks == null && !row.absent).length;
  return {
    obtained,
    possible,
    pending,
    average: possible > 0 ? Math.round((obtained / possible) * 10000) / 100 : null,
    final: rows.length > 0 && pending === 0,
  };
}
