/** Same denominator rule as api/src/lib/examAverages.ts. Pending subjects keep their maximum marks. Official absences are left out of both sides. */
export function provisionalTotal(rows: Array<{ maxMarks: number; marks: number | null; counted: boolean }>) {
  const counted = rows.filter((row) => row.counted && row.maxMarks > 0);
  const obtained = counted.reduce((sum, row) => sum + (row.marks ?? 0), 0);
  const possible = counted.reduce((sum, row) => sum + row.maxMarks, 0);
  const pending = rows.filter((row) => row.counted && row.maxMarks > 0 && row.marks == null).length;
  return {
    obtained,
    possible,
    pending,
    average: possible > 0 ? Math.round((obtained / possible) * 10000) / 100 : null,
    final: rows.length > 0 && pending === 0,
  };
}
