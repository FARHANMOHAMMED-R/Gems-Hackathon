import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/http";
import { isTeacherOnline, requireAdminPasscode } from "../lib/adminAuth";

export const adminMonitorRouter = Router();

/** GET /api/admin/monitor — teachers, online status, all students. */
adminMonitorRouter.get(
  "/admin/monitor",
  requireAdminPasscode,
  asyncHandler(async (_req, res) => {
    const [teachers, students, classGroups] = await Promise.all([
      prisma.teacherProfile.findMany({
        orderBy: [{ lastSeenAt: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          classManaged: true,
          lastSeenAt: true,
          createdAt: true,
        },
      }),
      prisma.studentProfile.findMany({
        orderBy: [{ classManaged: "asc" }, { rollNumber: "asc" }],
        select: {
          id: true,
          name: true,
          rollNumber: true,
          schoolId: true,
          classManaged: true,
          grade: true,
          section: true,
          totalTokens: true,
          createdAt: true,
        },
      }),
      prisma.studentProfile.groupBy({
        by: ["classManaged"],
        _count: { id: true },
      }),
    ]);

    const now = Date.now();
    const teacherRows = teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      classManaged: t.classManaged,
      lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
      signedUpAt: t.createdAt.toISOString(),
      isOnline: isTeacherOnline(t.lastSeenAt, now),
    }));

    const onlineTeachers = teacherRows.filter((t) => t.isOnline).length;

    res.json({
      stats: {
        totalTeachers: teachers.length,
        onlineTeachers,
        offlineTeachers: teachers.length - onlineTeachers,
        totalStudents: students.length,
        totalClasses: classGroups.filter((g) => g.classManaged).length,
      },
      teachers: teacherRows,
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        schoolId: s.schoolId,
        classManaged: s.classManaged,
        grade: s.grade,
        section: s.section,
        totalTokens: s.totalTokens,
        uploadedAt: s.createdAt.toISOString(),
      })),
      classCounts: classGroups
        .filter((g) => g.classManaged)
        .map((g) => ({ classManaged: g.classManaged, count: g._count.id }))
        .sort((a, b) => a.classManaged.localeCompare(b.classManaged)),
    });
  }),
);
