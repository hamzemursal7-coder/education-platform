-- CreateEnum
CREATE TYPE "ConductCategory" AS ENUM ('CLASSROOM_DISRUPTION', 'REPEATED_LATENESS', 'UNEXCUSED_ABSENCE', 'PEER_CONFLICT', 'ACADEMIC_DISHONESTY', 'PROPERTY_DAMAGE', 'POSITIVE_CONDUCT', 'WELFARE_CONCERN', 'SAFEGUARDING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConductSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConductStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConductVisibilityLevel" AS ENUM ('RESTRICTED_ADMIN_ONLY', 'STAFF_INTERNAL', 'PARENT_APPROVED', 'STUDENT_APPROVED', 'COMMUNITY_PUBLISHED');

-- CreateTable
CREATE TABLE "ConductReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "reporterTeacherId" TEXT,
    "reporterUserId" TEXT NOT NULL,
    "category" "ConductCategory" NOT NULL,
    "severity" "ConductSeverity" NOT NULL DEFAULT 'LOW',
    "isPositive" BOOLEAN NOT NULL DEFAULT false,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionsTakenByTeacher" TEXT,
    "status" "ConductStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assignedToUserId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "requestedVisibility" "ConductVisibilityLevel" NOT NULL DEFAULT 'STAFF_INTERNAL',
    "visibilityLevel" "ConductVisibilityLevel" NOT NULL DEFAULT 'RESTRICTED_ADMIN_ONLY',
    "isParentVisible" BOOLEAN NOT NULL DEFAULT false,
    "isStudentVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConductReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductAction" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "previousStatus" "ConductStatus",
    "newStatus" "ConductStatus",
    "comment" TEXT,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isParentVisible" BOOLEAN NOT NULL DEFAULT false,
    "isStudentVisible" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConductReport_schoolId_status_idx" ON "ConductReport"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ConductReport_studentId_isParentVisible_idx" ON "ConductReport"("studentId", "isParentVisible");

-- CreateIndex
CREATE INDEX "ConductReport_studentId_isStudentVisible_idx" ON "ConductReport"("studentId", "isStudentVisible");

-- CreateIndex
CREATE INDEX "ConductReport_reporterUserId_idx" ON "ConductReport"("reporterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ConductReport_schoolId_reportNumber_key" ON "ConductReport"("schoolId", "reportNumber");

-- CreateIndex
CREATE INDEX "ConductAction_reportId_createdAt_idx" ON "ConductAction"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConductAttachment_storageKey_key" ON "ConductAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ConductAttachment_reportId_idx" ON "ConductAttachment"("reportId");

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_reporterTeacherId_fkey" FOREIGN KEY ("reporterTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductReport" ADD CONSTRAINT "ConductReport_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductAction" ADD CONSTRAINT "ConductAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConductReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductAction" ADD CONSTRAINT "ConductAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductAttachment" ADD CONSTRAINT "ConductAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConductReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
