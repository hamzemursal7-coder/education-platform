ALTER TABLE "Student" ADD COLUMN "secondaryPermanentId" TEXT;
CREATE UNIQUE INDEX "Student_secondaryPermanentId_key" ON "Student"("secondaryPermanentId");
