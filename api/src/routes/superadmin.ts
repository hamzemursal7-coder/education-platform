import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { newRefreshToken, signAccessToken } from "../lib/tokens.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.cookieSecure,
  path: "/",
};

const schoolSchema = z.object({
  organizationId: z.string().min(1).optional(),
  organizationName: z.string().trim().min(2).max(120).optional(),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["PRIMARY_ONLY", "SECONDARY_ONLY", "PRIMARY_AND_SECONDARY"]),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  iconKey: z.enum(["school", "book", "graduation", "building", "star"]).optional(),
  isDemo: z.boolean().optional(),
});

const adminSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  middleName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().min(5).max(30),
});

async function availableSchoolCode(organizationId: string, name: string) {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]).join("");
  const compact = words.join("").slice(0, 10);
  const base = (initials.length >= 2 ? initials : compact || "SCH").slice(0, 12);
  let code = base;
  let suffix = 2;
  while (await prisma.school.findUnique({ where: { organizationId_code: { organizationId, code } } })) {
    code = `${base.slice(0, 16)}${suffix}`;
    suffix += 1;
  }
  return code;
}

export const superadminRouter = Router();

/** Enter/exit must work while acting as SCHOOL_ADMIN inside a school. */
superadminRouter.post("/superadmin/schools/:id/enter", requireAuth, async (req, res, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!actor || actor.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "Only Super Admin can enter a school.");
    }
    const school = await prisma.school.findUnique({ where: { id: String(req.params.id) } });
    if (!school) throw new HttpError(404, "School was not found.");
    if (!school.isActive) throw new HttpError(400, "Activate the school before entering it.");
    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: { schoolId: school.id },
    });
    const accessToken = signAccessToken({
      sub: updated.id,
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
    });
    res.cookie("emp_access", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    await writeAudit({
      schoolId: school.id,
      actorUserId: actor.id,
      action: "SCHOOL_ENTER",
      entityType: "School",
      entityId: school.id,
      summary: `Super Admin entered school ${school.name}`,
    });
    res.json({
      id: updated.id,
      email: updated.email,
      role: "SCHOOL_ADMIN",
      firstName: updated.firstName,
      lastName: updated.lastName,
      schoolId: school.id,
      actingFromSuperAdmin: true,
      school: { id: school.id, name: school.name, code: school.code, type: school.type },
    });
  } catch (error) {
    next(error);
  }
});

superadminRouter.post("/superadmin/exit-school", requireAuth, async (req, res, next) => {
  try {
    const actor = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!actor || actor.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "Only Super Admin can exit school view.");
    }
    const previousSchoolId = actor.schoolId;
    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: { schoolId: null },
    });
    const accessToken = signAccessToken({
      sub: updated.id,
      role: "SUPER_ADMIN",
      schoolId: null,
    });
    res.cookie("emp_access", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    if (previousSchoolId) {
      await writeAudit({
        schoolId: previousSchoolId,
        actorUserId: actor.id,
        action: "SCHOOL_EXIT",
        entityType: "School",
        entityId: previousSchoolId,
        summary: "Super Admin left school view",
      });
    }
    res.json({
      id: updated.id,
      email: updated.email,
      role: "SUPER_ADMIN",
      firstName: updated.firstName,
      lastName: updated.lastName,
      schoolId: null,
      actingFromSuperAdmin: false,
      school: null,
    });
  } catch (error) {
    next(error);
  }
});

superadminRouter.use("/superadmin", requireAuth, requireRole("SUPER_ADMIN"));

superadminRouter.get("/superadmin/organizations", async (_req, res, next) => {
  try {
    const rows = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isDemo: true, _count: { select: { schools: true } } },
    });
    res.json(rows.map((row) => ({
      id: row.id,
      name: row.name,
      isDemo: row.isDemo,
      schools: row._count.schools,
    })));
  } catch (error) {
    next(error);
  }
});

superadminRouter.post("/superadmin/organizations", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().trim().min(2).max(120), isDemo: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Organization name is required.");
    const created = await prisma.organization.create({
      data: { name: body.data.name, isDemo: body.data.isDemo ?? false },
    });
    await writeAudit({
      actorUserId: req.authUser!.id,
      action: "ORG_CREATE",
      entityType: "Organization",
      entityId: created.id,
      summary: `Created organization ${created.name}`,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

superadminRouter.post("/superadmin/schools", async (req, res, next) => {
  try {
    const body = schoolSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "School name is required.");
    let organizationId = body.data.organizationId;
    if (!organizationId) {
      const named = body.data.organizationName?.trim();
      const existing = named
        ? null
        : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
      if (existing) {
        organizationId = existing.id;
      } else {
        const org = await prisma.organization.create({
          data: { name: named || "Ilays Educational Academy", isDemo: body.data.isDemo ?? false },
        });
        organizationId = org.id;
      }
    } else {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org) throw new HttpError(404, "Organization was not found.");
    }
    const code = await availableSchoolCode(organizationId, body.data.name);
    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          organizationId,
          name: body.data.name,
          code,
          type: body.data.type,
          address: body.data.address?.trim() || null,
          primaryColor: body.data.primaryColor ?? "#4f46e5",
          accentColor: body.data.accentColor ?? "#10b981",
          iconKey: body.data.iconKey ?? "school",
          isDemo: body.data.isDemo ?? false,
        },
      });
      return created;
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "SCHOOL_CREATE",
      entityType: "School",
      entityId: school.id,
      summary: `Created school ${school.name} (${school.code})`,
    });
    res.status(201).json(school);
  } catch (error) {
    next(error);
  }
});

superadminRouter.post("/superadmin/schools/:id/toggle", async (req, res, next) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: String(req.params.id) } });
    if (!school) throw new HttpError(404, "School was not found.");
    const updated = await prisma.school.update({
      where: { id: school.id },
      data: { isActive: !school.isActive },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: updated.isActive ? "SCHOOL_ACTIVATE" : "SCHOOL_DEACTIVATE",
      entityType: "School",
      entityId: school.id,
      summary: `${updated.isActive ? "Activated" : "Deactivated"} school ${school.name}`,
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    next(error);
  }
});

superadminRouter.delete("/superadmin/schools/:id", async (req, res, next) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: String(req.params.id) } });
    if (!school) throw new HttpError(404, "School was not found.");
    if (school.isActive) throw new HttpError(400, "Deactivate the school before deleting it.");
    const [users, academicYears, enrollments, staff, announcements, transfers, documents, alumni, fees, exams, assignments] = await Promise.all([
      prisma.user.count({ where: { schoolId: school.id } }),
      prisma.academicYear.count({ where: { schoolId: school.id } }),
      prisma.enrollment.count({ where: { schoolId: school.id } }),
      prisma.staffMember.count({ where: { schoolId: school.id } }),
      prisma.announcement.count({ where: { schoolId: school.id } }),
      prisma.transferRequest.count({ where: { OR: [{ fromSchoolId: school.id }, { toSchoolId: school.id }] } }),
      prisma.studentDocument.count({ where: { schoolId: school.id } }),
      prisma.alumniRecord.count({ where: { schoolId: school.id } }),
      prisma.studentFee.count({ where: { schoolId: school.id } }),
      prisma.exam.count({ where: { schoolId: school.id } }),
      prisma.teacherAssignment.count({ where: { schoolId: school.id } }),
    ]);
    if (users || academicYears || enrollments || staff || announcements || transfers || documents || alumni || fees || exams || assignments) {
      throw new HttpError(409, "This school has records and cannot be deleted. Deactivate it instead.");
    }
    await prisma.$transaction([
      prisma.subject.deleteMany({ where: { schoolId: school.id } }),
      prisma.school.delete({ where: { id: school.id } }),
    ]);
    await writeAudit({
      actorUserId: req.authUser!.id,
      action: "SCHOOL_DELETE",
      entityType: "School",
      entityId: school.id,
      summary: `Deleted empty school ${school.name}`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

superadminRouter.post("/superadmin/schools/:id/admins", async (req, res, next) => {
  try {
    const body = adminSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "The admin's three names, phone number, and email are required.");
    const school = await prisma.school.findUnique({ where: { id: String(req.params.id) } });
    if (!school) throw new HttpError(404, "School was not found.");
    const email = body.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "This email is already used by another account.");
    const invite = newRefreshToken();
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          role: "SCHOOL_ADMIN",
          status: "INVITED",
          firstName: body.data.firstName,
          lastName: `${body.data.middleName} ${body.data.lastName}`,
          phone: body.data.phone,
          schoolId: school.id,
          isDemo: false,
        },
      });
      await tx.inviteToken.create({
        data: {
          userId: created.id,
          tokenHash: invite.tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return created;
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "SCHOOL_ADMIN_INVITE",
      entityType: "User",
      entityId: user.id,
      summary: `Invited school admin ${email} for ${school.name}`,
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      setPasswordPath: `/set-password?token=${invite.token}`,
    });
  } catch (error) {
    next(error);
  }
});
