/**
 * Capture README screenshots from the running dev app.
 * Prereq: backend + frontend running (localhost:5173).
 */
import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "docs", "screenshots");
const BASE = "http://localhost:5173";

const TEACHER_SESSION = {
  role: "teacher",
  name: "Demo Teacher",
  classManaged: "11-A",
  email: "demo@gems.edu",
  signedInAt: new Date().toISOString(),
};

const DEMO_ROSTER = {
  "11-A": [
    {
      id: "demo-1",
      name: "Aarav Sharma",
      rollNumber: "01",
      schoolId: "GEMS-1101",
      grade: "11",
      section: "A",
      classManaged: "11-A",
      totalTokens: 12,
    },
    {
      id: "demo-2",
      name: "Priya Nair",
      rollNumber: "02",
      schoolId: "GEMS-1102",
      grade: "11",
      section: "A",
      classManaged: "11-A",
      totalTokens: 8,
    },
  ],
};

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: false,
  });
  console.log("Saved", name);
}

async function seedTeacher(page) {
  await page.goto(BASE);
  await page.evaluate(
    ({ session, roster }) => {
      localStorage.setItem("gems-auth-session", JSON.stringify(session));
      localStorage.setItem("gems-class-roster", JSON.stringify(roster));
    },
    { session: TEACHER_SESSION, roster: DEMO_ROSTER },
  );
  await page.reload({ waitUntil: "networkidle" });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await mkdir(OUT, { recursive: true });

await page.goto(BASE, { waitUntil: "networkidle" });
await shot(page, "01-sign-in.png");

await seedTeacher(page);
await shot(page, "02-dashboard.png");

await page.locator(".nav-item").filter({ hasText: "Scan Analyzer" }).click();
await page.waitForTimeout(400);
await shot(page, "03-scan-analyzer.png");

await page.locator(".nav-item").filter({ hasText: "Blueprint Generator" }).click();
await page.waitForTimeout(400);
await shot(page, "04-blueprint-generator.png");

await page.locator(".nav-item").filter({ hasText: "Text Leveler" }).click();
await page.waitForTimeout(400);
await shot(page, "05-text-leveler.png");

await page.locator(".nav-item").filter({ hasText: "Substitution Finder" }).click();
await page.waitForTimeout(400);
await shot(page, "06-substitution-finder.png");

await page.locator(".nav-item").filter({ hasText: "Lab Booking" }).click();
await page.waitForTimeout(600);
await shot(page, "07-lab-booking.png");

await page.locator(".nav-item").filter({ hasText: "PPT Generator" }).click();
await page.waitForTimeout(400);
await shot(page, "08-ppt-generator.png");

await browser.close();
console.log("Done → docs/screenshots/");
