import { useEffect, useState } from "react";

import "./landing.css";

const acts = [
  {
    label: "Decompose",
    title: "One question becomes three independent lines of inquiry.",
    detail: "Architecture, performance, and security start in parallel.",
  },
  {
    label: "Challenge",
    title: "A reviewer finds the assumption shared by every branch.",
    detail: "The map makes disagreement visible before it becomes consensus.",
  },
  {
    label: "Test",
    title: "An experiment is assigned to falsify the strongest claim.",
    detail: "Evidence replaces another round of confident prose.",
  },
  {
    label: "Revise",
    title: "The weak hypothesis is refuted. The decision path updates.",
    detail: "Nothing disappears: the failed idea remains inspectable.",
  },
  {
    label: "Decide",
    title: "The agents stop where human judgment matters.",
    detail: "You get one precise decision—not another unread transcript.",
  },
] as const;

function ResearchFilm() {
  const [act, setAct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const currentAct = acts[act] ?? acts[0];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAct(acts.length - 1);
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      setAct((current) => (current + 1) % acts.length);
    }, 2_600);
    return () => window.clearTimeout(timer);
  }, [act, isPlaying]);

  return (
    <div className="research-film" data-act={act}>
      <div className="film-chrome">
        <div className="film-title">
          <span className="film-live" />
          Live inquiry
        </div>
        <span>07 agents · local</span>
      </div>

      <div className="film-canvas" aria-hidden="true">
        <svg viewBox="0 0 800 490" preserveAspectRatio="none">
          <path className="line line-a" d="M400 78 C310 112 235 125 170 173" />
          <path className="line line-b" d="M400 78 C400 115 400 130 400 173" />
          <path className="line line-c" d="M400 78 C490 112 565 125 630 173" />
          <path
            className="line line-review"
            d="M170 211 C205 275 290 276 340 306"
          />
          <path className="line line-review" d="M400 211 L400 293" />
          <path
            className="line line-review"
            d="M630 211 C595 275 510 276 460 306"
          />
          <path
            className="line line-test"
            d="M400 340 C400 357 400 365 400 380"
          />
          <path
            className="line line-evidence"
            d="M400 418 C455 431 516 430 572 441"
          />
        </svg>

        <article className="film-node node-question">
          <span>Question</span>
          <strong>How should a live workspace recover?</strong>
        </article>
        <article className="film-node node-expert node-architecture">
          <i>A</i>
          <div>
            <span>Architecture</span>
            <strong>Replay model</strong>
          </div>
        </article>
        <article className="film-node node-expert node-performance">
          <i>P</i>
          <div>
            <span>Performance</span>
            <strong>Latency budget</strong>
          </div>
        </article>
        <article className="film-node node-expert node-security">
          <i>S</i>
          <div>
            <span>Security</span>
            <strong>Trust boundary</strong>
          </div>
        </article>
        <article className="film-node node-reviewer">
          <span>Reviewer challenge</span>
          <strong>What happens after reconnect?</strong>
        </article>
        <article className="film-node node-experiment">
          <span>Experiment 03</span>
          <strong>Interrupt 5% of sessions</strong>
        </article>
        <article className="film-node node-evidence">
          <span>Evidence</span>
          <strong>31 updates lost</strong>
        </article>
        <article className="film-node node-refuted">
          <span>Refuted</span>
          <strong>Socket-only recovery</strong>
        </article>
        <article className="film-node node-decision">
          <span>Human decision</span>
          <strong>Approve the recovery boundary</strong>
        </article>
      </div>

      <div className="film-caption" aria-live="polite">
        <div>
          <span>
            0{act + 1} / 0{acts.length} · {currentAct.label}
          </span>
          <strong>{currentAct.title}</strong>
          <p>{currentAct.detail}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPlaying((playing) => !playing)}
          aria-label={isPlaying ? "Pause research film" : "Play research film"}
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
      </div>

      <div className="film-progress" aria-label="Research film chapters">
        {acts.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={index === act ? "active" : ""}
            onClick={() => {
              setAct(index);
              setIsPlaying(false);
            }}
            aria-label={`Show ${item.label} chapter`}
            aria-current={index === act ? "step" : undefined}
          >
            <span />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Mark() {
  return (
    <span className="landing-mark" aria-hidden="true">
      Z
    </span>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-brand" href="/" aria-label="Zmind+ home">
          <Mark />
          <span>
            Zmind<sup>+</sup>
          </span>
        </a>
        <div className="landing-links">
          <a href="#how-it-works">How it works</a>
          <a href="#self-host">Self-host</a>
          <a href="https://github.com/hrterry/zmind-plus">GitHub ↗</a>
        </div>
        <a className="nav-cta" href="/workbench">
          Open workbench <span>↗</span>
        </a>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span>Open source</span>
            <i />
            Local-first research supervision
          </div>
          <h1>
            Your agents can think in parallel.
            <em>You should see why.</em>
          </h1>
          <p>
            Zmind+ turns sprawling agent research into a living map of claims,
            critiques, experiments, evidence, and decisions—so you can supervise
            the work without reading every token.
          </p>
          <div className="hero-actions">
            <a className="hero-primary" href="#research-film">
              Watch research unfold <span>↓</span>
            </a>
            <a className="hero-secondary" href="/workbench">
              Explore the live prototype
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <i className="proof-local" /> Runs on your machine
            </span>
            <span>
              <i className="proof-provider" /> Works across agent runtimes
            </span>
          </div>
        </div>

        <div className="hero-map" aria-label="A miniature research graph">
          <div className="map-grid" />
          <svg
            viewBox="0 0 600 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M300 90 C210 128 170 155 132 206" />
            <path d="M300 90 L300 206" />
            <path d="M300 90 C390 128 430 155 468 206" />
            <path className="challenge" d="M132 253 C180 315 245 322 300 356" />
            <path className="challenge" d="M468 253 C420 315 355 322 300 356" />
          </svg>
          <div className="map-question">
            <small>Research objective</small>
            <strong>Choose a resilient collaboration model</strong>
          </div>
          <div className="map-agent agent-one">
            <span>A</span>
            <div>
              <small>Expert 01</small>
              <strong>Architecture</strong>
            </div>
          </div>
          <div className="map-agent agent-two">
            <span>P</span>
            <div>
              <small>Expert 02</small>
              <strong>Performance</strong>
            </div>
          </div>
          <div className="map-agent agent-three">
            <span>S</span>
            <div>
              <small>Expert 03</small>
              <strong>Security</strong>
            </div>
          </div>
          <div className="map-challenge">
            <small>Reviewer challenge</small>
            <strong>Shared assumption detected</strong>
          </div>
          <div className="map-toast">
            <span>!</span>
            <div>
              <small>Your judgment is needed</small>
              <strong>Review the evidence boundary</strong>
            </div>
          </div>
          <div className="map-meta">
            <span>06:42 elapsed</span>
            <span className="map-live">Live</span>
          </div>
        </div>
      </section>

      <section className="manifesto-strip" aria-label="Product promise">
        <span>Delegate broadly.</span>
        <span>Challenge early.</span>
        <span>Decide with evidence.</span>
      </section>

      <section className="film-section" id="research-film">
        <div className="section-intro" id="how-it-works">
          <span className="section-number">01</span>
          <div>
            <p className="section-eyebrow">
              See the work, not the token stream
            </p>
            <h2>A research process you can actually supervise.</h2>
          </div>
          <p>
            Watch delegation, disagreement, and evidence change the shape of a
            conclusion. Pause anywhere. Inspect everything.
          </p>
        </div>
        <ResearchFilm />
      </section>

      <section className="contrast-section">
        <div className="section-intro compact">
          <span className="section-number">02</span>
          <div>
            <p className="section-eyebrow">From transcript to terrain</p>
            <h2>Stop scrolling. Start seeing.</h2>
          </div>
        </div>
        <div className="contrast-grid">
          <article className="transcript-card">
            <div className="card-label">Without Zmind+</div>
            <div className="transcript-lines" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => (
                <span
                  key={index}
                  style={{ width: `${96 - (index % 4) * 11}%` }}
                />
              ))}
            </div>
            <strong>2,847 messages later…</strong>
            <p>The conclusion changed. The reason is somewhere above.</p>
          </article>
          <article className="terrain-card">
            <div className="card-label">With Zmind+</div>
            <div className="terrain-result">
              <span className="result-icon">✓</span>
              <div>
                <small>Current decision</small>
                <strong>Use durable replay with live delivery</strong>
              </div>
              <b>93%</b>
            </div>
            <div className="terrain-evidence">
              <span>3 experiments</span>
              <span>7 evidence items</span>
              <span>2 refuted claims</span>
            </div>
            <p>Every conclusion keeps its evidence, objections, and history.</p>
          </article>
        </div>
      </section>

      <section className="capabilities-section">
        <div className="capability-heading">
          <span className="section-number">03</span>
          <h2>
            Built for the moment one agent becomes a research organization.
          </h2>
        </div>
        <div className="capability-grid">
          <article>
            <span>01 / Delegate</span>
            <h3>See every workstream</h3>
            <p>
              Know who is exploring what, what is blocked, and where work
              overlaps.
            </p>
          </article>
          <article>
            <span>02 / Challenge</span>
            <h3>Make dissent visible</h3>
            <p>
              Reviewer objections stay attached to the exact claim they
              challenge.
            </p>
          </article>
          <article>
            <span>03 / Verify</span>
            <h3>Trace claims to evidence</h3>
            <p>
              Experiments, sources, and reversals remain inspectable after the
              answer.
            </p>
          </article>
          <article>
            <span>04 / Intervene</span>
            <h3>Decide at the right moment</h3>
            <p>
              Agents keep moving until a boundary genuinely needs human
              judgment.
            </p>
          </article>
        </div>
      </section>

      <section className="local-section" id="self-host">
        <div className="local-copy">
          <span className="section-number">04</span>
          <p className="section-eyebrow">Local-first by design</p>
          <h2>Your research stays where your research lives.</h2>
          <p>
            Zmind+ stores an append-only event record locally, projects only the
            graph you need, and keeps raw content capture off by default.
          </p>
          <a href="https://github.com/hrterry/zmind-plus">
            Read the source on GitHub ↗
          </a>
        </div>
        <div className="architecture-card">
          <div className="arch-row">
            <span>Your agents</span>
            <b>Any runtime</b>
          </div>
          <i>↓ adapters</i>
          <div className="arch-row active">
            <span>Local event log</span>
            <b>SQLite</b>
          </div>
          <i>↓ projections</i>
          <div className="arch-row">
            <span>Zmind+ canvas</span>
            <b>Your browser</b>
          </div>
          <div className="arch-note">
            <span>◇</span>
            No cloud account required
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <Mark />
          <span>Open source · local first · provider neutral</span>
        </div>
        <h2>
          Let agents go wide.
          <br />
          Keep human judgment close.
        </h2>
        <div className="final-actions">
          <a href="/workbench">Open the workbench ↗</a>
          <a href="https://github.com/hrterry/zmind-plus">Star on GitHub</a>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/">
          <Mark /> Zmind<sup>+</sup>
        </a>
        <p>A visual interface for supervising agent research.</p>
        <span>Built in the open.</span>
      </footer>
    </main>
  );
}
