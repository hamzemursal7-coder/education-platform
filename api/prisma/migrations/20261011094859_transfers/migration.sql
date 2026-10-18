-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromSchoolId" TEXT NOT NULL,
    "toSchoolId" TEXT NOT NULL,
    "fromEnrollmentId" TEXT NOT NULL,
    "toAcademicYearId" TEXT NOT NULL,
    "toSectionId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "rejectReason" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionMove" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fromSectionId" TEXT NOT NULL,
    "toSectionId" TEXT NOT NULL,
    "fromRollNumber" INTEGER NOT NULL,
    "toRollNumber" INTEGER NOT NULL,
    "movedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionMove_pkey" PRIMARY KEY ("id")
);
