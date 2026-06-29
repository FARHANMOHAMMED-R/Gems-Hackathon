import { useMemo, useState } from "react";
import {
  PHET_PHYSICS_SIMS,
  PHET_TOPICS,
  topicLabel,
  type PhetSimulation,
} from "../data/phetPhysicsSims";
import { Card, EmptyState, Field } from "../components/ui";

export function ThreeDLab() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>("all");
  const [active, setActive] = useState<PhetSimulation | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PHET_PHYSICS_SIMS.filter((sim) => {
      if (topic !== "all" && sim.topic !== topic) return false;
      if (!q) return true;
      return (
        sim.name.toLowerCase().includes(q) ||
        sim.description.toLowerCase().includes(q) ||
        sim.id.includes(q)
      );
    });
  }, [query, topic]);

  if (active) {
    return (
      <div className="phet-lab">
        <Card
          title={active.name}
          subtitle={`${topicLabel(active.topic)} · Interactive PhET simulation`}
          actions={
            <>
              <a
                href={active.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Open on PhET ↗
              </a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActive(null)}>
                ← All simulations
              </button>
            </>
          }
        >
          <div className="phet-viewer-wrap">
            <iframe
              title={active.name}
              src={active.runUrl}
              className="phet-viewer"
              allowFullScreen
            />
          </div>
          {active.description && <p className="muted phet-desc">{active.description}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="phet-lab">
      <Card
        title="3D Lab"
        subtitle={`${PHET_PHYSICS_SIMS.length} interactive physics simulations from PhET Colorado — HTML5, free for classroom use`}
      >
        <p className="muted" style={{ marginBottom: 16 }}>
          Explore motion, waves, electricity, optics, thermodynamics, and quantum physics. Click any
          simulation to run it here — no install required.
        </p>

        <div className="phet-toolbar">
          <Field label="Search simulations">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. circuit, projectile, waves…"
            />
          </Field>
          <div className="field">
            <span className="field-label">Topic</span>
            <div className="chip-group phet-topic-chips">
              <button
                type="button"
                className={`chip${topic === "all" ? " active" : ""}`}
                onClick={() => setTopic("all")}
              >
                All ({PHET_PHYSICS_SIMS.length})
              </button>
              {PHET_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip${topic === t ? " active" : ""}`}
                  onClick={() => setTopic(t)}
                >
                  {topicLabel(t)} ({PHET_PHYSICS_SIMS.filter((s) => s.topic === t).length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🔭"
            title="No simulations match"
            hint="Try a different search or topic filter."
          />
        ) : (
          <div className="phet-grid">
            {filtered.map((sim) => (
              <button
                key={sim.id}
                type="button"
                className="phet-sim-card"
                onClick={() => setActive(sim)}
              >
                <span className="phet-sim-topic">{topicLabel(sim.topic)}</span>
                <span className="phet-sim-name">{sim.name}</span>
                <span className="phet-sim-blurb">{sim.description}</span>
                <span className="phet-sim-cta">Launch simulation →</span>
              </button>
            ))}
          </div>
        )}

        <p className="phet-credit muted">
          Simulations ©{" "}
          <a href="https://phet.colorado.edu" target="_blank" rel="noopener noreferrer">
            PhET Interactive Simulations
          </a>
          , University of Colorado Boulder, licensed under CC-BY-4.0.
        </p>
      </Card>
    </div>
  );
}
