import physicsRaw from "./phetPhysicsSims.json";
import chemistryRaw from "./phetChemistrySims.json";
import mathRaw from "./phetMathSims.json";

export type PhetSubject = "physics" | "chemistry" | "math";

export interface PhetSimulation {
  id: string;
  name: string;
  description: string;
  /** Primary subject for topic categorization */
  subject: PhetSubject;
  /** All PhET subject tags for this simulation */
  subjects: PhetSubject[];
  topic: string;
  topics: string[];
  runUrl: string;
  pageUrl: string;
}

interface RawSim {
  id: string;
  name: string;
  description: string;
  topic: string;
  topics: string[];
  runUrl: string;
  pageUrl: string;
}

const SUBJECT_LABELS: Record<PhetSubject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
};

const TOPIC_LABELS: Record<string, string> = {
  // Physics
  motion: "Motion",
  "sound-and-waves": "Sound & Waves",
  "work-energy-and-power": "Work, Energy & Power",
  "heat-and-thermodynamics": "Heat & Thermodynamics",
  "quantum-phenomena": "Quantum Phenomena",
  "light-and-radiation": "Light & Radiation",
  "electricity-magnets-and-circuits": "Electricity & Magnetism",
  physics: "General Physics",
  // Chemistry
  "acids-bases-solutions": "Acids, Bases & Solutions",
  "atoms-and-quantum": "Atoms & Quantum",
  "molecules-and-reactions": "Molecules & Reactions",
  "physical-chemistry": "Physical Chemistry",
  "general-chemistry": "General Chemistry",
  // Math
  "numbers-and-algebra": "Numbers & Algebra",
  "functions-and-geometry": "Functions & Geometry",
  "statistics-and-data": "Statistics & Data",
  "math-applications": "Math Applications",
  "general-math": "General Math",
};

function categorizePhysics(id: string, name: string): string {
  const n = `${id} ${name}`.toLowerCase();
  if (/circuit|ohm|charge|capacitor|coulomb|faraday|magnet|electric|travoltage|resistance|generator|balloon/.test(n)) {
    return "electricity-magnets-and-circuits";
  }
  if (/wave|fourier|plinko|interference|string/.test(n)) {
    return "sound-and-waves";
  }
  if (/light|color|optics|bending|blackbody|vision|molecule/.test(n)) {
    return "light-and-radiation";
  }
  if (/gas|states-of-matter|diffusion|density|pressure|buoyancy|friction/.test(n)) {
    return "heat-and-thermodynamics";
  }
  if (/quantum|atom|nucleus|hydrogen|rutherford|atomic|build-a-nucleus|build-an-atom/.test(n)) {
    return "quantum-phenomena";
  }
  if (/energy|skate|gravity-force|gravity-and|hooke|spring|masses|under-pressure/.test(n)) {
    return "work-energy-and-power";
  }
  if (/projectile|pendulum|forces|motion|collision|balancing|vector|curve|calculus|orbit|kepler|solar|my-solar/.test(n)) {
    return "motion";
  }
  return "physics";
}

function categorizeChemistry(id: string, name: string): string {
  const n = `${id} ${name}`.toLowerCase();
  if (/acid|base|ph|beers|molarity|concentration/.test(n)) {
    return "acids-bases-solutions";
  }
  if (/atom|nucleus|isotope|hydrogen|rutherford|quantum|build-an-atom|build-a-nucleus/.test(n)) {
    return "atoms-and-quantum";
  }
  if (/molecule|shape|polarity|reactant|leftover|balancing-chemical|membrane/.test(n)) {
    return "molecules-and-reactions";
  }
  if (/gas|state|diffusion|density|energy-form|blackbody|balloon|static|coulomb|wave-on-a-string|fourier/.test(n)) {
    return "physical-chemistry";
  }
  return "general-chemistry";
}

function categorizeMath(id: string, name: string): string {
  const n = `${id} ${name}`.toLowerCase();
  if (/fraction|arithmetic|make-a-ten|number-|proportion|ratio|unit-rate|equality|expression/.test(n)) {
    return "numbers-and-algebra";
  }
  if (/area|quadrilateral|vector|trig|graphing|function|calculus|curve|regression|slope|quadratic|line/.test(n)) {
    return "functions-and-geometry";
  }
  if (/plinko|projectile-data|projectile-sampling|mean|center|variability|data/.test(n)) {
    return "statistics-and-data";
  }
  if (/balancing-act|pendulum|projectile-motion|masses-and-springs|kepler|ohms|resistance|wave-on-a-string/.test(n)) {
    return "math-applications";
  }
  return "general-math";
}

function enrich(raw: RawSim[], subject: PhetSubject): PhetSimulation[] {
  const categorize =
    subject === "physics"
      ? categorizePhysics
      : subject === "chemistry"
        ? categorizeChemistry
        : categorizeMath;

  return raw.map((sim) => {
    const topic = categorize(sim.id, sim.name);
    return { ...sim, subject, subjects: [subject], topic, topics: [topic] };
  });
}

export const PHET_SUBJECTS: PhetSubject[] = ["physics", "chemistry", "math"];

function mergeCatalogs(): PhetSimulation[] {
  const byId = new Map<string, PhetSimulation>();

  for (const subject of PHET_SUBJECTS) {
    for (const sim of enrich(
      (subject === "physics"
        ? physicsRaw
        : subject === "chemistry"
          ? chemistryRaw
          : mathRaw) as RawSim[],
      subject,
    )) {
      const existing = byId.get(sim.id);
      if (existing) {
        for (const s of sim.subjects) {
          if (!existing.subjects.includes(s)) existing.subjects.push(s);
        }
      } else {
        byId.set(sim.id, sim);
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function subjectLabel(subject: PhetSubject): string {
  return SUBJECT_LABELS[subject];
}

export function topicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic;
}

export const PHET_PHYSICS_SIMS = enrich(physicsRaw as RawSim[], "physics");
export const PHET_CHEMISTRY_SIMS = enrich(chemistryRaw as RawSim[], "chemistry");
export const PHET_MATH_SIMS = enrich(mathRaw as RawSim[], "math");

export const PHET_ALL_SIMS: PhetSimulation[] = mergeCatalogs();

export function subjectLabels(sim: PhetSimulation): string {
  return sim.subjects.map(subjectLabel).join(" · ");
}

export function simsForSubject(subject: PhetSubject | "all"): PhetSimulation[] {
  if (subject === "all") return PHET_ALL_SIMS;
  if (subject === "physics") return PHET_PHYSICS_SIMS;
  if (subject === "chemistry") return PHET_CHEMISTRY_SIMS;
  return PHET_MATH_SIMS;
}

export function topicsForSubject(subject: PhetSubject | "all"): string[] {
  const sims = simsForSubject(subject);
  return [...new Set(sims.map((s) => s.topic))].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b)));
}

/** @deprecated Use PHET_PHYSICS_SIMS from phetSims.ts */
export { PHET_PHYSICS_SIMS as default };
