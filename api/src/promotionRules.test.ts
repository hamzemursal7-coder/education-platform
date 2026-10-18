import assert from "node:assert/strict";
import test from "node:test";
import { isTerminalLevel, nextLevelFor } from "./lib/levels.js";
import { judgeTerm2, term2BlockReason } from "./lib/promotionRules.js";

const subject = (marks: number, minMarks = 50) => ({ marks, isAbsent: false, maxMarks: 100, minMarks });

test("term 2 promotion uses the configured pass mark", () => {
  assert.equal(judgeTerm2({ examSubjectCount: 0, results: [], terminal: false }).status, "PENDING");
  assert.equal(judgeTerm2({ examSubjectCount: 2, results: [subject(80)], terminal: false }).status, "PENDING");
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [subject(80, 50)], terminal: false }).status, "PASS");
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [subject(80, 50)], terminal: false }).average, 80);
  assert.equal(judgeTerm2({ examSubjectCount: 2, results: [subject(99), subject(66)], terminal: false }).average, 82.5);
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [subject(40, 50)], terminal: false }).status, "FAIL");
  assert.equal(judgeTerm2({ examSubjectCount: 2, results: [subject(46), subject(70)], terminal: true }).status, "GRADUATION");
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [subject(80, 0)], terminal: false }).status, "PASS");
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [subject(80, 50)], terminal: true }).status, "GRADUATION");
  assert.equal(judgeTerm2({ examSubjectCount: 1, results: [{ marks: null, isAbsent: true, maxMarks: 100, minMarks: 50 }], terminal: false }).status, "REVIEW");
  assert.equal(nextLevelFor("CLASS_8"), null);
  assert.equal(nextLevelFor("CLASS_7"), "CLASS_8");
  assert.equal(nextLevelFor("FORM_3"), "FORM_4");
  assert.equal(isTerminalLevel("FORM_4"), true);
  assert.equal(isTerminalLevel("CLASS_5"), false);
  assert.equal(term2BlockReason({ termConfigured: false, examCreated: false, subjectCount: 0, states: [] }), "Term 2 is not configured for this academic year.");
  assert.equal(term2BlockReason({ termConfigured: true, examCreated: false, subjectCount: 0, states: [] }), "Term 2 exam has not been created for this class.");
  assert.equal(term2BlockReason({ termConfigured: true, examCreated: true, subjectCount: 1, states: ["MISSING"] }), "Marks have not been submitted for every subject.");
  assert.equal(term2BlockReason({ termConfigured: true, examCreated: true, subjectCount: 1, states: ["SUBMITTED"] }), "Marks are awaiting admin review.");
  assert.equal(term2BlockReason({ termConfigured: true, examCreated: true, subjectCount: 1, states: ["VERIFIED"] }), "Results are approved but not published.");
  assert.equal(term2BlockReason({ termConfigured: true, examCreated: true, subjectCount: 1, states: ["PUBLISHED"] }), null);
});
