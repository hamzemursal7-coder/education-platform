CREATE TABLE "SectionSubject" (
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "SectionSubject_pkey" PRIMARY KEY ("sectionId", "subjectId")
);

ALTER TABLE "SectionSubject"
ADD CONSTRAINT "SectionSubject_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionSubject"
ADD CONSTRAINT "SectionSubject_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SectionSubject" ("sectionId", "subjectId")
SELECT section."id", class_subject."subjectId"
FROM "Section" AS section
INNER JOIN "ClassSubject" AS class_subject
  ON class_subject."classGroupId" = section."classGroupId"
ON CONFLICT DO NOTHING;
