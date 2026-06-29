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
        teacherName: "Mr. Rajesh Kumar",
        department: "Physics",
        currentPeriodFreeStatus: j([true, false, true, false, true, false, true]),
      },
      {
        teacherName: "Ms. Anita Desai",
        department: "Physics",
        currentPeriodFreeStatus: j([false, false, true, true, false, true, false]),
      },
      {
        teacherName: "Mr. Suresh Iyer",
        department: "Mathematics",
        currentPeriodFreeStatus: j([true, true, true, false, false, false, true]),
      },
      {
        teacherName: "Ms. Fatima Khan",
        department: "Chemistry",
        currentPeriodFreeStatus: j([false, true, false, true, true, false, true]),
      },
    ],
  });

  const today = new Date().toISOString().slice(0, 10);
  await prisma.labReservation.create({
    data: {
      roomName: "Physics Lab 1",
      date: today,
      periodNumber: 2,
      reservedByTeacherId: "Mr. Rajesh Kumar",
      status: "Occupied",
    },
  });

  console.log("Seed complete (no students — teacher sets up class roster on first sign-in).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
