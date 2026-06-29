import raw from "./phetPhysicsSims.json";

export interface PhetSimulation {
  id: string;
  name: string;
  description: string;
  topic: string;
  topics: string[];
  runUrl: string;
  pageUrl: string;
}

const TOPIC_LABELS: Record<string, string> = {
  motion: "Motion",
  "sound-and-waves": "Sound & Waves",
  "work-energy-and-power": "Work, Energy & Power",
  "heat-and-thermodynamics": "Heat & Thermodynamics",
  "quantum-phenomena": "Quantum Phenomena",
  "light-and-radiation": "Light & Radiation",
  "electricity-magnets-and-circuits": "Electricity & Magnetism",
  physics: "General Physics",
};

function categorize(id: string, name: string): string {
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

export function topicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic;
}

export const PHET_PHYSICS_SIMS: PhetSimulation[] = (raw as PhetSimulation[]).map((sim) => {
  const topic = categorize(sim.id, sim.name);
  return { ...sim, topic, topics: [topic] };
});

export const PHET_TOPICS = [...new Set(PHET_PHYSICS_SIMS.map((s) => s.topic))].sort((a, b) =>
  topicLabel(a).localeCompare(topicLabel(b)),
);
