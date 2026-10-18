import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { levelLabel } from "../lib/levels.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

async function schoolOfAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user?.school?.isActive) throw new HttpError(403, "You are not allowed to access this record.");
  return user.school;
}

export const searchRouter = Router();

searchRouter.get("/search", requireAuth, requireRole("SCHOOL_ADMIN"), async (req, res, next) => {
  try {
    const school = await schoolOfAdmin(req.authUser!.id);
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json({ students: [], staff: [], teachers: [] });
      return;
    }
    const [students, teachers, staff] = await Promise.all([
      prisma.student.findMany({
        where: {
          organizationId: school.organizationId,
          enrollments: { some: { schoolId: school.id } },
          OR: [
            { permanentId: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { fatherName: { contains: q, mode: "insensitive" } },
            { grandfatherName: { contains: q, mode: "insensitive" } },
            { nationalId: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { enrollments: { some: { schoolId: school.id, studentNumber: { contains: q, mode: "insensitive" } } } },
            {
              guardians: {
                some: {
                  guardian: {
                    OR: [
                      { firstName: { contains: q, mode: "insensitive" } },
                      { lastName: { contains: q, mode: "insensitive" } },
                      { phone: { contains: q, mode: "insensitive" } },
                      { publicId: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        },
        take: 20,
        include: {
          enrollments: {
            where: { schoolId: school.id },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { academicYear: true, classGroup: true, section: true },
          },
        },
      }),
      prisma.teacher.findMany({
        where: {
          organizationId: school.organizationId,
          AND: [
            {
              OR: [
                { schools: { some: { schoolId: school.id } } },
                { assignments: { some: { schoolId: school.id } } },
                { user: { schoolId: school.id } },
              ],
            },
            {
              OR: [
                { publicId: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } },
              ],
            },
          ],
        },
        take: 10,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.staffMember.findMany({
        where: {
          schoolId: school.id,
          OR: [
            { publicId: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { designation: { contains: q, mode: "insensitive" } },
            { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } },
          ],
        },
        take: 10,
        include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
      }),
    ]);
    res.json({
      students: students.map((student) => {
        const enrollment = student.enrollments[0];
        return {
          id: student.id,
          permanentId: student.permanentId,
          name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
          year: enrollment?.academicYear.name ?? "",
          level: enrollment ? levelLabel(enrollment.classGroup.level) : "",
          section: enrollment?.section.name ?? "",
        };
      }),
      teachers: teachers.map((teacher) => ({
        id: teacher.id,
        publicId: teacher.publicId,
        name: `${teacher.user.firstName} ${teacher.user.lastName}`,
        email: teacher.user.email,
      })),
      staff: staff.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        name: `${row.user.firstName} ${row.user.lastName}`,
        role: row.user.role,
        designation: row.designation,
      })),
    });
  } catch (error) {
    next(error);
  }
});
