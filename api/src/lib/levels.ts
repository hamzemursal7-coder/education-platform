import type { LevelCode, SchoolType } from "@prisma/client";

const primary: LevelCode[] = [
  "CLASS_1",
  "CLASS_2",
  "CLASS_3",
  "CLASS_4",
  "CLASS_5",
  "CLASS_6",
  "CLASS_7",
  "CLASS_8",
];

const secondary: LevelCode[] = ["FORM_1", "FORM_2", "FORM_3", "FORM_4"];

export function levelsForSchool(type: SchoolType): LevelCode[] {
  if (type === "PRIMARY_ONLY") return primary;
  if (type === "SECONDARY_ONLY") return secondary;
  return [...primary, ...secondary];
}

export function levelLabel(level: LevelCode) {
  if (level.startsWith("CLASS_")) return `Class ${level.slice(6)}`;
  return `Form ${level.slice(5)}`;
}

const nextLevel: Partial<Record<LevelCode, LevelCode>> = {
  CLASS_1: "CLASS_2",
  CLASS_2: "CLASS_3",
  CLASS_3: "CLASS_4",
  CLASS_4: "CLASS_5",
  CLASS_5: "CLASS_6",
  CLASS_6: "CLASS_7",
  CLASS_7: "CLASS_8",
  FORM_1: "FORM_2",
  FORM_2: "FORM_3",
  FORM_3: "FORM_4",
};

export function nextLevelFor(level: LevelCode): LevelCode | null {
  return nextLevel[level] ?? null;
}

export function isTerminalLevel(level: LevelCode) {
  return level === "CLASS_8" || level === "FORM_4";
}

/** Primary schools finish at Class 8. Secondary schools finish at Form 4. A combined school keeps both, separately. */
export function terminalLevelsForSchool(type: SchoolType): LevelCode[] {
  if (type === "PRIMARY_ONLY") return ["CLASS_8"];
  if (type === "SECONDARY_ONLY") return ["FORM_4"];
  return ["CLASS_8", "FORM_4"];
}
