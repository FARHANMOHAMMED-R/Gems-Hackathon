import { prisma } from "./prisma";

/** Demo occupied slots shown in Lab Booking (upserted for today on server start). */
export const DEMO_LAB_SLOTS = [
  {
    roomName: "Chemistry Lab 2",
    periodNumber: 1,
    reservedByTeacherId: "Yogesh Sir · CHEM",
  },
  {
    roomName: "Chemistry Lab 1",
    periodNumber: 2,
    reservedByTeacherId: "Ms. Fatima Khan · CHEM",
  },
  {
    roomName: "Physics Lab 1",
    periodNumber: 4,
    reservedByTeacherId: "Mr. Rajesh Kumar · PHY",
  },
  {
    roomName: "Computer Lab 1",
    periodNumber: 2,
    reservedByTeacherId: "Irfana Ma'am · CS",
  },
  {
    roomName: "Computer Lab 1",
    periodNumber: 6,
    reservedByTeacherId: "Irfana Ma'am · CS",
  },
] as const;

/** Retired demo slots — deleted on sync so old duplicates do not linger. */
const RETIRED_DEMO_SLOTS = [
  { roomName: "Chemistry Lab 2", periodNumber: 3 },
  { roomName: "Chemistry Lab 2", periodNumber: 5 },
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ensure demo lab slots exist for today (idempotent upsert). */
export async function ensureDemoLabBookings(date: string = todayIso()): Promise<void> {
  for (const slot of RETIRED_DEMO_SLOTS) {
    await prisma.labReservation.deleteMany({
      where: {
        roomName: slot.roomName,
        date,
        periodNumber: slot.periodNumber,
      },
    });
  }

  for (const slot of DEMO_LAB_SLOTS) {
    await prisma.labReservation.upsert({
      where: {
        room_date_period: {
          roomName: slot.roomName,
          date,
          periodNumber: slot.periodNumber,
        },
      },
      create: {
        roomName: slot.roomName,
        date,
        periodNumber: slot.periodNumber,
        reservedByTeacherId: slot.reservedByTeacherId,
        status: "Occupied",
      },
      update: {
        reservedByTeacherId: slot.reservedByTeacherId,
        status: "Occupied",
      },
    });
  }
}
