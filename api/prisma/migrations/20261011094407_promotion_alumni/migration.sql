-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'ALUMNI', 'WITHDRAWN', 'ON_LEAVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnrollmentStatus" ADD VALUE 'PROMOTED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'RETAINED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'ALUMNI';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'TRANSFERRED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "AlumniRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "fromLevel" "LevelCode" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AlumniRecord" ADD CONSTRAINT "AlumniRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
