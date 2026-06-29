/**
 * Fetches PhET HTML simulation metadata and writes subject JSON catalogs.
 * Run: node scripts/fetch-phet-sims.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../frontend/src/data");

const META_URL =
  "https://phet.colorado.edu/services/metadata/1.3/simulations?format=json&locale=en";

const SUBJECT_CATEGORIES = {
  physics: 4,
  chemistry: 13,
  math: 15,
};

function absUrl(path) {
  if (!path) return "";
  return path.startsWith("http") ? path : `https://phet.colorado.edu${path}`;
}

function slug(projectName) {
  return projectName.replace(/^html\//, "");
}

function extract(meta, subject, categoryId) {
  const cats = Object.values(meta.categories);
  const idSet = new Set(cats.find((c) => c.id === categoryId)?.simulationIds ?? []);
  const out = [];

  for (const project of meta.projects) {
    if (project.type !== 2) continue;
    const id = slug(project.name);
    for (const sim of project.simulations ?? []) {
      if (!idSet.has(sim.id)) continue;
      const en = sim.localizedSimulations?.en;
      if (!en?.runUrl) continue;
      out.push({
        id,
        name:
          en.title ||
          id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: (en.description || "").replace(/\s+/g, " ").trim().slice(0, 220),
        topic: "general",
        topics: [],
        runUrl: absUrl(en.runUrl),
        pageUrl: absUrl(en.simPageUrl),
      });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

const meta = await fetch(META_URL).then((r) => r.json());

for (const [subject, categoryId] of Object.entries(SUBJECT_CATEGORIES)) {
  const sims = extract(meta, subject, categoryId);
  const file = join(OUT, `phet${subject[0].toUpperCase()}${subject.slice(1)}Sims.json`);
  writeFileSync(file, `${JSON.stringify(sims, null, 2)}\n`);
  console.log(`Wrote ${sims.length} ${subject} sims → ${file}`);
}
