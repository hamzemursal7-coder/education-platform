ALTER TABLE "SubjectResult" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "SubjectResult" ADD COLUMN "reviewedByUserId" TEXT;
ALTER TABLE "SubjectResult" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "SubjectResult" ADD COLUMN "publishedByUserId" TEXT;
ALTER TABLE "SubjectResult" ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE TABLE "ResultPublication" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "publishedByUserId" TEXT NOT NULL,
  "publishedCount" INTEGER NOT NULL,
  "classCount" INTEGER NOT NULL,
  "subjectCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResultPublication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultPublication_examId_createdAt_idx" ON "ResultPublication"("examId", "createdAt");

ALTER TABLE "ResultPublication" ADD CONSTRAINT "ResultPublication_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
