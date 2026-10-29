-- AlterEnum
ALTER TYPE "ExternalTransferStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

-- DropIndex
DROP INDEX IF EXISTS "Enrollment_studentId_academicYearId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Enrollment_studentId_academicYearId_idx" ON "Enrollment"("studentId", "academicYearId");

-- AlterTable
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "newEnrollmentId" TEXT,
ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExternalTransfer" ADD COLUMN IF NOT EXISTS "reversedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ExternalTransfer_reversedByUserId_fkey'
    ) THEN
        ALTER TABLE "ExternalTransfer" ADD CONSTRAINT "ExternalTransfer_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

