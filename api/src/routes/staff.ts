import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { issueSetPasswordLink, syncLoginEmail } from "../lib/accountLink.js";
import { newRefreshToken } from "../lib/tokens.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const staffSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(5),
  designation: z.string().trim().min(2),
  role: z.enum(["ACCOUNTANT", "STAFF"]),
  joinedAt: z.string().optional(),
});

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

export const staffRouter = Router();
staffRouter.use("/staff", requireAuth, requireRole("SCHOOL_ADMIN"));

staffRouter.get("/staff", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const rows = await prisma.staffMember.findMany({
      where: { schoolId: school.id },
      include: { user: { select: { firstName: true, lastName: true, email: true, status: true, role: true } } },
      orderBy: { publicId: "asc" },
    });
    res.json(rows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      name: `${row.user.firstName} ${row.user.lastName}`,
      email: row.user.email,
      phone: row.phone,
      designation: row.designation,
      role: row.user.role,
      status: row.user.status,
      joinedAt: row.joinedAt,
      isActive: row.isActive,
    })));
  } catch (error) {
    next(error);
  }
});

staffRouter.post("/staff", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = staffSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Staff name, email, phone, designation, and role are required.");
    const email = body.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, include: { staffMember: true, teacher: true } });
    if (existing?.staffMember) throw new HttpError(409, "This email already belongs to a staff member.");
    if (existing?.teacher) throw new HttpError(409, "This email already belongs to a teacher. Use a separate school-staff email.");
    if (existing) throw new HttpError(409, "This email is already used by another account.");
    const invite = newRefreshToken();
    const staff = await prisma.$transaction(async (tx) => {
      const sequence = await nextValue(tx, `staff:${school.organizationId}`);
      const user = await tx.user.create({
        data: {
          email,
          role: body.data.role,
          status: "INVITED",
          firstName: body.data.firstName,
          lastName: body.data.lastName,
          schoolId: school.id,
          isDemo: false,
        },
      });
      await tx.inviteToken.create({
        data: {
          userId: user.id,
          tokenHash: invite.tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return tx.staffMember.create({
        data: {
          organizationId: school.organizationId,
          schoolId: school.id,
          userId: user.id,
          publicId: `STF-${String(sequence).padStart(5, "0")}`,
          phone: body.data.phone,
          designation: body.data.designation,
          joinedAt: body.data.joinedAt ? new Date(body.data.joinedAt) : new Date(),
        },
      });
    });
    res.status(201).json({
      id: staff.id,
      publicId: staff.publicId,
      setPasswordPath: `/set-password/${invite.token}`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      next(new HttpError(409, "This staff email or ID is already in use."));
      return;
    }
    next(error);
  }
});

staffRouter.get("/staff/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await prisma.staffMember.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true, role: true, passwordHash: true } },
        school: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new HttpError(404, "Staff member was not found.");
    res.json({
      id: row.id,
      publicId: row.publicId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      name: `${row.user.firstName} ${row.user.lastName}`,
      email: row.user.email,
      phone: row.phone,
      designation: row.designation,
      role: row.user.role,
      status: row.user.status,
      hasLogin: Boolean(row.user.passwordHash),
      joinedAt: row.joinedAt,
      isActive: row.isActive,
      school: { id: row.school.id, name: row.school.name },
    });
  } catch (error) {
    next(error);
  }
});

const staffUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().min(5).max(30),
  designation: z.string().trim().min(2).max(120),
});

staffRouter.patch("/staff/:id", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = staffUpdateSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Enter valid staff details.");
    const row = await prisma.staffMember.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!row) throw new HttpError(404, "Staff member was not found.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { firstName: body.data.firstName, lastName: body.data.lastName, email: await syncLoginEmail(row.userId, body.data.email) } }),
      prisma.staffMember.update({ where: { id: row.id }, data: { phone: body.data.phone, designation: body.data.designation } }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

staffRouter.post("/staff/:id/access", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await prisma.staffMember.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: { user: { select: { id: true, passwordHash: true } } },
    });
    if (!row) throw new HttpError(404, "Staff member was not found.");
    const setPasswordPath = await issueSetPasswordLink(row.user.id);
    res.json({ kind: row.user.passwordHash ? "reset" : "invite", setPasswordPath });
  } catch (error) {
    next(error);
  }
});

staffRouter.post("/staff/:id/deactivate", async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const staff = await prisma.staffMember.findFirst({
      where: { id: String(req.params.id), schoolId: school.id },
      include: { user: true },
    });
    if (!staff) throw new HttpError(404, "Staff member was not found.");
    await prisma.$transaction([
      prisma.staffMember.update({ where: { id: staff.id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: staff.userId }, data: { status: "DISABLED" } }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
