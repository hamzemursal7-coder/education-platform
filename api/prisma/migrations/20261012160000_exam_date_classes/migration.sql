ALTER TABLE "Exam" ADD COLUMN "examDate" TIMESTAMP(3);

CREATE TABLE "ExamClass" (
    "examId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,

    CONSTRAINT "ExamClass_pkey" PRIMARY KEY ("examId","classGroupId")
);

ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
