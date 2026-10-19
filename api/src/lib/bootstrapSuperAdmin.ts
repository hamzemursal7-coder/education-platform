import { hashPassword } from "./passwords.js";
import { prisma } from "./prisma.js";

export async function bootstrapSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 8) {
    console.warn("Super admin bootstrap skipped because the password is shorter than 8 characters.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== "SUPER_ADMIN") {
    console.warn("Super admin bootstrap skipped because that email belongs to another account.");
    return;
  }

  const passwordHash = await hashPassword(password);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", schoolId: null },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        firstName: "Hamze",
        lastName: "Mursal",
        schoolId: null,
        isDemo: false,
      },
    });
  }
  console.log("Super admin account is ready.");
}
