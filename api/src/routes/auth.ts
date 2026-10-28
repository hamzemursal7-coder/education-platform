import { createReadStream } from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { assertPhotoSize, detectImage, storeUserPhoto } from "../lib/photos.js";
import { clearSession, clearSharedSession, newSessionKey, readRefreshToken, sessionKeyFrom, writeSession } from "../lib/sessionCookie.js";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function setSessionCookies(res: import("express").Response, key: string, accessToken: string, refreshToken: string) {
  clearSharedSession(res);
  writeSession(res, key, accessToken, refreshToken);
}

export const authRouter = Router();

const setPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

async function openInvite(token: string) {
  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashRefreshToken(token.trim()) },
    include: { user: { select: { role: true } } },
  });
  if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) return null;
  return invite;
}

authRouter.post("/set-password/check", async (req, res, next) => {
  try {
    const token = z.string().min(20).safeParse(req.body?.token);
    if (!token.success) throw new HttpError(400, "This link is no longer valid.");
    let invite: Awaited<ReturnType<typeof openInvite>> = null;
    try {
      invite = await openInvite(token.data);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "ERR";
      res.setHeader("X-Error-Code", code);
      throw new HttpError(400, "This link is no longer valid.");
    }
    if (!invite) throw new HttpError(400, "This link is no longer valid.");
    res.json({ ok: true, role: invite.user.role });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/set-password", async (req, res, next) => {
  try {
    const body = setPasswordSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "A valid link and a password of at least 8 characters are required.");
    const invite = await openInvite(body.data.token);
    if (!invite) throw new HttpError(400, "This link is no longer valid.");
    const passwordHash = await hashPassword(body.data.password);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.inviteToken.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new HttpError(400, "This link is no longer valid.");
      await tx.inviteToken.updateMany({
        where: { userId: invite.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: invite.userId },
        data: { passwordHash, status: "ACTIVE" },
      });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, "Email and password are required.");
    }
    const email = body.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE") {
      throw new HttpError(401, "That email is not registered.");
    }
    if (!user.passwordHash) {
      throw new HttpError(401, "This account has no password yet. Use the invite link to set one.");
    }
    const valid = await verifyPassword(user.passwordHash, body.data.password);
    if (!valid) {
      throw new HttpError(401, "The password is incorrect.");
    }
    const sessionUser =
      user.role === "SUPER_ADMIN" && user.schoolId
        ? await prisma.user.update({ where: { id: user.id }, data: { schoolId: null } })
        : user;
    const accessToken = signAccessToken({
      sub: sessionUser.id,
      role: sessionUser.role,
      schoolId: sessionUser.schoolId,
    });
    const refresh = newRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: sessionUser.id,
        tokenHash: refresh.tokenHash,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    const sessionKey = newSessionKey();
    setSessionCookies(res, sessionKey, accessToken, refresh.token);
    res.json({
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      firstName: sessionUser.firstName,
      lastName: sessionUser.lastName,
      schoolId: sessionUser.schoolId,
      sessionKey,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const current = readRefreshToken(req);
    if (!current) {
      throw new HttpError(401, "Authentication is required.");
    }
    const tokenHash = hashRefreshToken(current);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.status !== "ACTIVE") {
      throw new HttpError(401, "Authentication is required.");
    }
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const refresh = newRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: refresh.tokenHash,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    const actingFromSuperAdmin = stored.user.role === "SUPER_ADMIN" && Boolean(stored.user.schoolId);
    const accessToken = signAccessToken({
      sub: stored.user.id,
      role: actingFromSuperAdmin ? "SCHOOL_ADMIN" : stored.user.role,
      schoolId: stored.user.schoolId,
    });
    const sessionKey = sessionKeyFrom(req) || newSessionKey();
    setSessionCookies(res, sessionKey, accessToken, refresh.token);
    res.json({ ok: true, sessionKey });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const current = readRefreshToken(req);
    if (current) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(current), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearSession(res, sessionKeyFrom(req));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.authUser!;
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      photoUrl: true,
      schoolId: true,
      status: true,
      school: {
        select: { id: true, name: true, code: true, type: true },
      },
    },
  });
  res.json({
    ...user,
    photoUrl: fullUser?.photoUrl ?? null,
    phone: fullUser?.phone ?? null,
    school: fullUser?.school ?? null,
  });
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

authRouter.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        schoolId: true,
        school: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });
    if (!user) throw new HttpError(404, "User not found.");
    res.json(user);
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.errors.map((e) => e.message).join(", "));
    }

    const { firstName, lastName, phone, currentPassword, newPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) throw new HttpError(404, "User not found.");

    let newPasswordHash: string | undefined;
    if (newPassword) {
      if (!currentPassword) {
        throw new HttpError(400, "Current password is required to set a new password.");
      }
      if (user.passwordHash) {
        const matches = await verifyPassword(user.passwordHash, currentPassword);
        if (!matches) {
          throw new HttpError(400, "Current password is not correct.");
        }
      }
      newPasswordHash = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        schoolId: true,
      },
    });

    res.json({ ok: true, user: updated });
  } catch (error) {
    next(error);
  }
});

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

authRouter.post("/profile/photo", requireAuth, profileUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No photo file uploaded.");
    assertPhotoSize(req.file.size);
    const detected = detectImage(req.file.buffer);
    if (!detected) throw new HttpError(400, "Photo must be JPEG, PNG, or WebP.");

    const stored = await storeUserPhoto(req.authUser!.id, req.file.buffer, detected.extension);

    const updated = await prisma.user.update({
      where: { id: req.authUser!.id },
      data: {
        photoUrl: stored.photoUrl,
        photoStorageKey: stored.photoStorageKey,
      },
      select: { id: true, photoUrl: true },
    });

    res.json({ ok: true, photoUrl: updated.photoUrl });
  } catch (error) {
    next(error);
  }
});

authRouter.delete("/profile/photo", requireAuth, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.authUser!.id },
      data: {
        photoUrl: null,
        photoStorageKey: null,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/profile/photo/:userId", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.userId) },
      select: { photoStorageKey: true },
    });
    if (!user?.photoStorageKey) throw new HttpError(404, "Photo not found.");

    const filePath = path.join(process.cwd(), "storage", user.photoStorageKey);
    const stream = createReadStream(filePath);
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

