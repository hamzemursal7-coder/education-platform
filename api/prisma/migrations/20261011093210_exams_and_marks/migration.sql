-- CreateEnum
CREATE TYPE "MarkState" AS ENUM ('DRAFT', 'SUBMITTED', 'REJECTED', 'VERIFIED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "term" "TermCode" NOT NULL,
    "generalMax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubject" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "minMarks" INTEGER NOT NULL,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "marks" INTEGER,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "state" "MarkState" NOT NULL DEFAULT 'DRAFT',
    "rejectReason" TEXT,
    "editAllowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubjectResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_academicYearId_term_key" ON "Exam"("academicYearId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubject_examId_classGroupId_subjectId_key" ON "ExamSubject"("examId", "classGroupId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectResult_enrollmentId_examSubjectId_key" ON "SubjectResult"("enrollmentId", "examSubjectId");

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectResult" ADD CONSTRAINT "SubjectResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectResult" ADD CONSTRAINT "SubjectResult_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
