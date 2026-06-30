import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** JSON columns are stored as serialized strings on SQLite. */
const j = (v: unknown) => JSON.stringify(v);

/**
 * Seed supporting data only — teachers add their own class roster (0 tokens).
 * Lab reservations and teacher availability for substitution demos.
 */
async function main() {
  await prisma.gradingRecord.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.labReservation.deleteMany();
  await prisma.teacherAvailability.deleteMany();

  await prisma.teacherAvailability.createMany({
    data: [
      {
        teacherName: "Irfana Ma'am",
        department: "Computer Science",
        currentPeriodFreeStatus: j([true, false, true, true, false, true, false]),
      },
      {
        teacherName: "Tina Ma'am",
        department: "Mathematics",
        currentPeriodFreeStatus: j([false, true, true, false, true, false, true]),
      },
      {
        teacherName: "Yogesh Sir",
        department: "CHEM",
        currentPeriodFreeStatus: j([false, true, false, true, true, false, true]),
      },
    ],
  });

  const today = new Date().toISOString().slice(0, 10);
  await prisma.labReservation.createMany({
    data: [
      {
        roomName: "Chemistry Lab 2",
        date: today,
        periodNumber: 1,
        reservedByTeacherId: "Yogesh Sir · CHEM",
        status: "Occupied",
      },
      {
        roomName: "Chemistry Lab 1",
        date: today,
        periodNumber: 2,
        reservedByTeacherId: "Ms. Fatima Khan · CHEM",
        status: "Occupied",
      },
      {
        roomName: "Physics Lab 1",
        date: today,
        periodNumber: 4,
        reservedByTeacherId: "Mr. Rajesh Kumar · PHY",
        status: "Occupied",
      },
      {
        roomName: "Computer Lab 1",
        date: today,
        periodNumber: 2,
        reservedByTeacherId: "Irfana Ma'am · CS",
        status: "Occupied",
      },
      {
        roomName: "Computer Lab 1",
        date: today,
        periodNumber: 6,
        reservedByTeacherId: "Irfana Ma'am · CS",
        status: "Occupied",
      },
    ],
  });

  console.log("Seed complete (no students — teacher sets up class roster on first sign-in).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
