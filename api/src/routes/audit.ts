import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const auditRouter = Router();

auditRouter.get("/audit", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { school: true } });
    if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
    const rows = await prisma.auditEvent.findMany({
      where: { schoolId: user.school.id },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    const actors = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.actorUserId))] } },
      select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true, role: true },
    });
    res.json(
      rows.map((row) => {
        const actor = actors.find((item) => item.id === row.actorUserId);
        return {
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          summary: row.summary,
          createdAt: row.createdAt,
          actor: actor ? `${actor.firstName} ${actor.lastName}`.trim() : (row.actorUserId.startsWith("cmv") ? "School Administrator" : row.actorUserId),
          actorEmail: actor?.email ?? "",
          actorRole: actor?.role ?? "SCHOOL_ADMIN",
          actorPhotoUrl: actor?.photoUrl ?? null,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});
