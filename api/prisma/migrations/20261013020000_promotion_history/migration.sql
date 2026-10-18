CREATE TYPE "PromotionOutcome" AS ENUM ('PROMOTED', 'REPEATED', 'ALUMNI');

CREATE TABLE "PromotionBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fromYearId" TEXT NOT NULL,
    "toYearId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "promoted" INTEGER NOT NULL,
    "repeated" INTEGER NOT NULL,
    "alumni" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionDecision" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "outcome" "PromotionOutcome" NOT NULL,
    "fromLevel" "LevelCode" NOT NULL,
    "fromSectionName" TEXT NOT NULL,
    "toLevel" "LevelCode",
    "toSectionId" TEXT,
    "toSectionName" TEXT,
    "term2Average" DOUBLE PRECISION,
    "remarks" TEXT,

    CONSTRAINT "PromotionDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionDecision_enrollmentId_key" ON "PromotionDecision"("enrollmentId");
CREATE INDEX "PromotionDecision_studentId_idx" ON "PromotionDecision"("studentId");

ALTER TABLE "PromotionBatch" ADD CONSTRAINT "PromotionBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionDecision" ADD CONSTRAINT "PromotionDecision_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PromotionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
