import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = await prisma.academicYear.findFirst({ where: { name: "2027-2028" } });
const form1 = await prisma.classGroup.upsert({
  where: { academicYearId_level: { academicYearId: year!.id, level: "FORM_1" } },
  update: {},
  create: { schoolId: year!.schoolId, academicYearId: year!.id, level: "FORM_1" },
});
const section = await prisma.section.upsert({
  where: { classGroupId_name: { classGroupId: form1.id, name: "A" } },
  update: {},
  create: { classGroupId: form1.id, name: "A" },
});
console.log(JSON.stringify({ yearId: year!.id, sectionId: section.id }));
await prisma.$disconnect();
