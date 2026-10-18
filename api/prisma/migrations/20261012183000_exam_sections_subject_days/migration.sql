ALTER TABLE "Exam" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "ExamSubject" ADD COLUMN "examDay" TIMESTAMP(3);

CREATE TABLE "ExamSection" (
    "examId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("examId","sectionId")
);

ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
