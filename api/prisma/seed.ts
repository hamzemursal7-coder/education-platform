import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("DemoAdmin#2026");
  const organization = await prisma.organization.upsert({
    where: { id: "org-demo" },
    update: {},
    create: {
      id: "org-demo",
      name: "Demo Education Organization",
      isDemo: true,
    },
  });
  const school = await prisma.school.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "ILAYS" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Ilays Combined School",
      code: "ILAYS",
      type: "PRIMARY_AND_SECONDARY",
      isDemo: true,
    },
  });
  for (const subject of [
    { name: "Mathematics", code: "MATH" },
    { name: "English", code: "ENG" },
    { name: "Somali", code: "SOM" },
  ]) {
    await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: subject.code } },
      update: {},
      create: { ...subject, schoolId: school.id, isDemo: true },
    });
  }
  await prisma.user.upsert({
    where: { email: "schooladmin.ilays@demo.school" },
    update: { passwordHash, status: "ACTIVE", schoolId: school.id },
    create: {
      email: "schooladmin.ilays@demo.school",
      passwordHash,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Hodan",
      lastName: "Ali",
      schoolId: school.id,
      isDemo: true,
    },
  });
  const xaafuun = await prisma.school.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "XAAFUUN" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Xaafuun Secondary School",
      code: "XAAFUUN",
      type: "SECONDARY_ONLY",
      isDemo: true,
    },
  });
  await prisma.user.upsert({
    where: { email: "schooladmin.xaafuun@demo.school" },
    update: { passwordHash, status: "ACTIVE", schoolId: xaafuun.id },
    create: {
      email: "schooladmin.xaafuun@demo.school",
      passwordHash,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
      firstName: "Fartuun",
      lastName: "Omar",
      schoolId: xaafuun.id,
      isDemo: true,
    },
  });
  await prisma.user.upsert({
    where: { email: "superadmin@demo.school" },
    update: { passwordHash, status: "ACTIVE" },
    create: {
      email: "superadmin@demo.school",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      firstName: "Amina",
      lastName: "Hassan",
      isDemo: true,
    },
  });
  const accountant = await prisma.user.upsert({
    where: { email: "accountant.ilays@demo.school" },
    update: { passwordHash, status: "ACTIVE", schoolId: school.id, role: "ACCOUNTANT" },
    create: {
      email: "accountant.ilays@demo.school",
      passwordHash,
      role: "ACCOUNTANT",
      status: "ACTIVE",
      firstName: "Sahra",
      lastName: "Yusuf",
      schoolId: school.id,
      isDemo: true,
    },
  });
  if (!(await prisma.staffMember.findUnique({ where: { userId: accountant.id } }))) {
    await prisma.staffMember.create({
      data: {
        organizationId: organization.id,
        schoolId: school.id,
        userId: accountant.id,
        publicId: "STF-00001",
        phone: "+252610000010",
        designation: "School Accountant",
        isActive: true,
      },
    });
  }
  await prisma.$executeRaw`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${`staff:${organization.id}`}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("IdSequence"."value", 1)
  `;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
