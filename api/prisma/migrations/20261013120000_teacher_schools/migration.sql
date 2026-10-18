CREATE TABLE "TeacherSchool" (
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSchool_pkey" PRIMARY KEY ("teacherId","schoolId")
);

ALTER TABLE "TeacherSchool" ADD CONSTRAINT "TeacherSchool_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSchool" ADD CONSTRAINT "TeacherSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TeacherSchool" ("teacherId", "schoolId")
SELECT t."id", u."schoolId"
FROM "Teacher" t
JOIN "User" u ON u."id" = t."userId"
WHERE u."schoolId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "TeacherSchool" ("teacherId", "schoolId")
SELECT DISTINCT a."teacherId", a."schoolId"
FROM "TeacherAssignment" a
ON CONFLICT DO NOTHING;
