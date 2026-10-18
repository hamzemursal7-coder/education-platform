import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const schoolSettingsRouter = Router();

async function adminSchool(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return { user, school: user.school };
}

schoolSettingsRouter.get("/school/settings", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const { user, school } = await adminSchool(req.authUser!.id);
    res.json({
      schoolName: school.name,
      address: school.address ?? "",
      admin: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? "",
      },
    });
  } catch (error) {
    next(error);
  }
});

schoolSettingsRouter.patch("/school/settings", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const { school } = await adminSchool(req.authUser!.id);
    const body = z.object({ address: z.string().trim().min(3).max(300) }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter the school address.");
    await prisma.school.update({ where: { id: school.id }, data: { address: body.data.address } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

schoolSettingsRouter.patch("/school/settings/profile", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const { user } = await adminSchool(req.authUser!.id);
    const body = z.object({
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      email: z.string().email(),
      phone: z.string().trim().max(30).optional().or(z.literal("")),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter the administrator name and email.");
    const email = body.data.email.toLowerCase();
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
    if (taken) throw new HttpError(409, "That email is already used.");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: body.data.firstName,
        lastName: body.data.lastName,
        email,
        phone: body.data.phone || null,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
