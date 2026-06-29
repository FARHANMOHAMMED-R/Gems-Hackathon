import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** JSON columns are stored as serialized strings on SQLite. */
const j = (v: unknown) => JSON.stringify(v);

/**
 * Seed a small, realistic CBSE Class 11 dataset so every endpoint is
 * immediately demoable: students, grading history, teacher availability and
 * a couple of lab reservations.
 */
async function main() {
  // Clean slate (order matters for FK).
  await prisma.gradingRecord.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.labReservation.deleteMany();
  await prisma.teacherAvailability.deleteMany();

  const aarav = await prisma.studentProfile.create({
    data: {
      name: "Aarav Sharma",
      grade: "11",
      section: "A",
      totalTokens: 18,
      adaptivePreferenceProfile: j({ track: "Standard", pace: "normal" }),
      gradingRecords: {
        create: [
          {
            type: "Exam",
            rawScannedText: "Q1: Newton's second law F=ma ... derivation partially correct.",
            scores: j({ total: 7, max: 10, Q1: 3, Q2: 4 }),
            aiFeedbackText:
              "Strong grasp of force concepts; lost marks on unit consistency in Q2.",
          },
          {
            type: "Notebook",
            rawScannedText: "Chapter 4 notes — kinematics graphs neatly drawn.",
            scores: j({ Handwriting: 4, Creativity: 3, Content: 5 }),
            aiFeedbackText: "Excellent content coverage; add more worked examples for creativity.",
          },
        ],
      },
    },
  });

  const diya = await prisma.studentProfile.create({
    data: {
      name: "Diya Nair",
      grade: "11",
      section: "A",
      totalTokens: 27,
      adaptivePreferenceProfile: j({ track: "Neurodivergent", subtype: "ADHD", pace: "micro" }),
      gradingRecords: {
        create: [
          {
            type: "Exam",
            rawScannedText: "Q1: Mole concept calculation, minor arithmetic slip.",
            scores: j({ total: 8, max: 10, Q1: 4, Q2: 4 }),
            aiFeedbackText: "Conceptually solid; double-check arithmetic under time pressure.",
          },
        ],
      },
    },
  });

  await prisma.studentProfile.create({
    data: {
      name: "Kabir Verma",
      grade: "11",
      section: "B",
      totalTokens: 9,
      adaptivePreferenceProfile: j({ track: "Advanced", pace: "fast" }),
    },
  });

  // current_period_free_status: booleans for periods 1..7.
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

  console.log("Seed complete.");
  console.log(`Sample student IDs:\n  Aarav: ${aarav.id}\n  Diya:  ${diya.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
