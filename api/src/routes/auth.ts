import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.cookieSecure,
  path: "/",
};

function setSessionCookies(res: import("express").Response, accessToken: string, refreshToken: string) {
  res.cookie("emp_access", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
  res.cookie("emp_refresh", refreshToken, { ...cookieBase, maxAge: 14 * 24 * 60 * 60 * 1000 });
}

export const authRouter = Router();

const setPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

authRouter.post("/set-password", async (req, res, next) => {
  try {
    const body = setPasswordSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "A valid link and a password of at least 8 characters are required.");
    const tokenHash = hashRefreshToken(body.data.token);
    const invite = await prisma.inviteToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new HttpError(400, "This link is no longer valid.");
    }
    const passwordHash = await hashPassword(body.data.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: invite.userId },
        data: { passwordHash, status: "ACTIVE" },
      }),
      prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    ]);
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
    setSessionCookies(res, accessToken, refresh.token);
    res.json({
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      firstName: sessionUser.firstName,
      lastName: sessionUser.lastName,
      schoolId: sessionUser.schoolId,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const current = req.cookies?.emp_refresh as string | undefined;
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
    setSessionCookies(res, accessToken, refresh.token);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const current = req.cookies?.emp_refresh as string | undefined;
    if (current) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(current), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie("emp_access", { path: "/" });
    res.clearCookie("emp_refresh", { path: "/" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.authUser!;
  const school = user.schoolId
    ? await prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { id: true, name: true, code: true, type: true },
      })
    : null;
  res.json({ ...user, school });
});
