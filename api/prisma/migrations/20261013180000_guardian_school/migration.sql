ALTER TABLE "Guardian" ADD COLUMN "registeredSchoolId" TEXT;

ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_registeredSchoolId_fkey" FOREIGN KEY ("registeredSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Guardian_registeredSchoolId_idx" ON "Guardian"("registeredSchoolId");
