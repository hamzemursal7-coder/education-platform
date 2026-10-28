import type { AnnouncementAudience, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(5000),
  audience: z.enum(["ALL", "STUDENTS", "PARENTS", "TEACHERS", "STAFF", "ALUMNI"]),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
  pinned: z.boolean().optional(),
  publishAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  publishNow: z.boolean().optional(),
});

function audiencesForRole(role: UserRole): AnnouncementAudience[] {
  switch (role) {
    case "SCHOOL_ADMIN":
      return ["ALL", "STUDENTS", "PARENTS", "TEACHERS", "STAFF", "ALUMNI"];
    case "TEACHER":
      return ["ALL", "TEACHERS"];
    case "ACCOUNTANT":
    case "STAFF":
      return ["ALL", "STAFF"];
    case "PARENT":
      return ["ALL", "PARENTS"];
    case "STUDENT":
      return ["ALL", "STUDENTS"];
    default:
      return [];
  }
}

async function schoolIdsForUser(userId: string, role: UserRole, schoolId: string | null) {
  if (role === "PARENT") {
    const guardian = await prisma.guardian.findFirst({
      where: { userId },
      include: {
        students: {
          include: {
            student: {
              include: { enrollments: { select: { schoolId: true } } },
            },
          },
        },
      },
    });
    return [...new Set(guardian?.students.flatMap((link) => link.student.enrollments.map((item) => item.schoolId)) ?? [])];
  }
  if (schoolId) return [schoolId];
  return [];
}

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

function mapAnnouncement(row: {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  audience: string;
  pinned: boolean;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  reads?: Array<{ userId: string }>;
}, userId?: string) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    priority: row.priority,
    audience: row.audience,
    pinned: row.pinned,
    publishAt: row.publishAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    read: userId ? Boolean(row.reads?.some((item) => item.userId === userId)) : undefined,
    readCount: row.reads?.length,
  };
}

export const announcementsRouter = Router();

announcementsRouter.use("/announcements", requireAuth);

announcementsRouter.get("/announcements", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const rows = await prisma.announcement.findMany({
      where: { schoolId: school.id },
      include: { reads: true },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    res.json(rows.map((row) => mapAnnouncement(row)));
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/announcements", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const body = createSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Title, body, and audience are required.");
    const publishNow = body.data.publishNow ?? false;
    const created = await prisma.announcement.create({
      data: {
        schoolId: school.id,
        title: body.data.title,
        body: body.data.body,
        audience: body.data.audience,
        priority: body.data.priority ?? "NORMAL",
        pinned: body.data.pinned ?? false,
        publishAt: body.data.publishAt ? new Date(body.data.publishAt) : publishNow ? new Date() : null,
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
        status: publishNow ? "PUBLISHED" : "DRAFT",
        createdByUserId: req.authUser!.id,
      },
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: publishNow ? "ANNOUNCEMENT_PUBLISH" : "ANNOUNCEMENT_DRAFT",
      entityType: "Announcement",
      entityId: created.id,
      summary: `${publishNow ? "Published" : "Drafted"} announcement: ${created.title}`,
    });
    res.status(201).json(mapAnnouncement(created));
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get(
  "/announcements/inbox",
  requireRole("SCHOOL_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF", "PARENT", "STUDENT"),
  async (req, res, next) => {
    try {
      const user = req.authUser!;
      const schoolIds = await schoolIdsForUser(user.id, user.role, user.schoolId);
      if (!schoolIds.length) {
        res.json([]);
        return;
      }
      const now = new Date();
      const audiences = audiencesForRole(user.role);
      const rows = await prisma.announcement.findMany({
        where: {
          schoolId: { in: schoolIds },
          status: "PUBLISHED",
          audience: { in: audiences },
          AND: [
            { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        include: { reads: { where: { userId: user.id } } },
        orderBy: [{ pinned: "desc" }, { priority: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      });
      res.json(rows.map((row) => mapAnnouncement(row, user.id)));
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.post("/announcements/:id/publish", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await prisma.announcement.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!row) throw new HttpError(404, "Announcement was not found.");
    if (row.status === "ARCHIVED") throw new HttpError(400, "Archived announcements cannot be published.");
    const updated = await prisma.announcement.update({
      where: { id: row.id },
      data: { status: "PUBLISHED", publishAt: row.publishAt ?? new Date() },
    });
    res.json(mapAnnouncement(updated));
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/announcements/:id/archive", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await prisma.announcement.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!row) throw new HttpError(404, "Announcement was not found.");
    const updated = await prisma.announcement.update({
      where: { id: row.id },
      data: { status: "ARCHIVED", pinned: false },
    });
    res.json(mapAnnouncement(updated));
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/announcements/:id/pin", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const pinned = z.object({ pinned: z.boolean() }).safeParse(req.body);
    if (!pinned.success) throw new HttpError(400, "Pinned value is required.");
    const row = await prisma.announcement.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!row) throw new HttpError(404, "Announcement was not found.");
    const updated = await prisma.announcement.update({
      where: { id: row.id },
      data: { pinned: pinned.data.pinned },
    });
    res.json(mapAnnouncement(updated));
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post(
  "/announcements/:id/read",
  requireRole("SCHOOL_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF", "PARENT", "STUDENT"),
  async (req, res, next) => {
    try {
      const user = req.authUser!;
      const schoolIds = await schoolIdsForUser(user.id, user.role, user.schoolId);
      const row = await prisma.announcement.findFirst({
        where: {
          id: String(req.params.id),
          schoolId: { in: schoolIds },
          status: "PUBLISHED",
          audience: { in: audiencesForRole(user.role) },
        },
      });
      if (!row) throw new HttpError(404, "Announcement was not found.");
      await prisma.announcementRead.upsert({
        where: { announcementId_userId: { announcementId: row.id, userId: user.id } },
        create: { announcementId: row.id, userId: user.id },
        update: { readAt: new Date() },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.delete("/announcements/:id", requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const row = await prisma.announcement.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!row) throw new HttpError(404, "Announcement was not found.");
    await prisma.announcementRead.deleteMany({ where: { announcementId: row.id } });
    await prisma.announcement.delete({ where: { id: row.id } });
    res.json({ ok: true, id: row.id });
  } catch (error) {
    next(error);
  }
});

