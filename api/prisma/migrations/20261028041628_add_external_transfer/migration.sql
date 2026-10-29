-- CreateEnum
CREATE TYPE "ExternalTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExternalTransfer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "destinationSchoolName" TEXT,
    "reason" TEXT,
    "certificateNumber" TEXT NOT NULL,
    "status" "ExternalTransferStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "transcriptDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "tcDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTransfer_enrollmentId_key" ON "ExternalTransfer"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTransfer_certificateNumber_key" ON "ExternalTransfer"("certificateNumber");

-- CreateIndex
CREATE INDEX "ExternalTransfer_schoolId_status_idx" ON "ExternalTransfer"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ExternalTransfer_studentId_idx" ON "ExternalTransfer"("studentId");

-- AddForeignKey
ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
