ALTER TABLE "Teacher" ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "address" TEXT,
ADD COLUMN "nationalId" TEXT;

CREATE UNIQUE INDEX "Teacher_nationalId_key" ON "Teacher"("nationalId");
