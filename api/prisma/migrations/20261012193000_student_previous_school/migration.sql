ALTER TABLE "Student" ADD COLUMN "previousSchoolId" TEXT;
ALTER TABLE "Student" ADD COLUMN "previousClass" TEXT;
ALTER TABLE "Student" ADD COLUMN "leavingYear" TEXT;
ALTER TABLE "Student" ADD COLUMN "transferCertificateNo" TEXT;
ALTER TABLE "Student" ADD COLUMN "staffNotes" TEXT;

ALTER TABLE "Student" ADD CONSTRAINT "Student_previousSchoolId_fkey"
  FOREIGN KEY ("previousSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
