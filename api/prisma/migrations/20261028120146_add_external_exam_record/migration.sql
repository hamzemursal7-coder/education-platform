-- CreateTable
CREATE TABLE "ExternalExamRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "originSchool" TEXT,
    "examYear" TEXT,
    "gradeOrClass" TEXT,
    "subject" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION DEFAULT 100,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalExamRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalExamRecord_studentId_idx" ON "ExternalExamRecord"("studentId");

-- CreateIndex
CREATE INDEX "ExternalExamRecord_enrollmentId_idx" ON "ExternalExamRecord"("enrollmentId");

-- AddForeignKey
ALTER TABLE "ExternalExamRecord" ADD CONSTRAINT "ExternalExamRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalExamRecord" ADD CONSTRAINT "ExternalExamRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
