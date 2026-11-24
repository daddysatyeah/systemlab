import {
  Activity,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Box,
  Cable,
  ChevronRight,
  Cpu,
  Database,
  GitBranch,
  Globe2,
  Layers3,
  ListOrdered,
  Moon,
  Network,
  Play,
  Radio,
  Server,
  Shield,
  Sun,
  Workflow,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { catalog, type Kind } from "./model";
import { scenarios } from "./scenarios";
import { Infrastructure, Rack, TopologyArt } from "./infrastructure-art";
export const icons = {
  client: Globe2,
  balancer: Network,
  server: Server,
  gateway: Cable,
  database: Database,
  replica: Layers3,
  cache: Zap,
  queue: ListOrdered,
  worker: Cpu,
  cdn: Radio,
  firewall: Shield,
};
export function Brand() {
  return (
    <a className="brand" href="#home">
      <span className="brand-mark">
        <Box size={20} />
      </span>
      SystemLab<span className="brand-dot">.</span>
    </a>
  );
}
export function Header({
  theme,
  toggle,
}: {
  theme: string;
  toggle: () => void;
}) {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#capabilities">Features</a>
          <a href="#scenarios">Scenarios</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="nav-actions">
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={toggle}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a className="button small primary" href="#studio">
            Launch Studio <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </header>
  );
}
const route =
  "M115 209 H184 M256 209 H294 Q309 209 309 194 V141 Q309 128 324 128 H358 M256 209 H294 Q309 209 309 224 V277 Q309 290 324 290 H358 M430 128 H465 Q478 128 478 143 V194 Q478 209 493 209 H527 M430 290 H465 Q478 290 478 275 V224 Q478 209 493 209 H527";
const demoPaths = [
  "M115 209 H184 M256 209 H294 Q309 209 309 194 V141 Q309 128 324 128 H358 M430 128 H465 Q478 128 478 143 V194 Q478 209 493 209 H527",
  "M115 209 H184 M256 209 H294 Q309 209 309 224 V277 Q309 290 324 290 H358 M430 290 H465 Q478 290 478 275 V224 Q478 209 493 209 H527",
];
const previewNodes = [
  { kind: "client", name: "Client traffic", sub: "INGRESS", x: 79, y: 209 },
  {
    kind: "balancer",
    name: "Load balancer",
    sub: "ROUND ROBIN",
    x: 220,
    y: 209,
  },
  { kind: "server", name: "App server A", sub: "COMPUTE", x: 394, y: 128 },
  { kind: "server", name: "App server B", sub: "COMPUTE", x: 394, y: 290 },
  { kind: "database", name: "Database", sub: "STORAGE", x: 563, y: 209 },
] as const;
export function Blueprint() {
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="blueprint">
      <div className="blueprint-top">
        <span>
          <span className="live-dot" /> ARCHITECTURE PREVIEW
        </span>
        <span className="blueprint-code">LOAD BALANCING</span>
      </div>
      <svg
        className={"blueprint-svg " + (playing ? "" : "freeze")}
        viewBox="0 0 642 398"
        aria-label="Load-balanced application architecture"
      >
        <defs>
          <pattern
            id="grid"
            width="17"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#41516b" opacity=".56" />
          </pattern>
        </defs>
        <rect width="642" height="398" fill="url(#grid)" />
        <path
          d="M20 60v-12h12m590 12v-12h-12M20 340v12h12m590-12v12h-12"
          fill="none"
          stroke="#3b4a66"
        />
        <path d={route} fill="none" stroke="#35496c" strokeWidth="1.5" />
        {[
          [145, 209],
          [309, 170],
          [471, 283],
          [503, 209],
          [342, 128],
        ].map(([x, y], i) => (
          <g
            key={i}
            className="signal"
            style={{ animationDelay: i * 0.27 + "s" }}
          >
            <circle cx={x} cy={y} r="8" fill="#5782ff" opacity=".12" />
            <circle cx={x} cy={y} r="3" fill="#8fa8ff" />
          </g>
        ))}
        {playing &&
          demoPaths.map((path, i) => (
            <circle
              className="preview-packet"
              key={path}
              r="3.6"
              fill="#aabbff"
              visibility="hidden"
            >
              <set
                attributeName="visibility"
                to="visible"
                begin={i * 0.9 + "s"}
              />
              <animateMotion
                path={path}
                dur="3s"
                begin={i * 0.9 + "s"}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        {previewNodes.map(({ kind, name, sub, x, y }, i) => {
          const Icon = icons[kind];
          const toggle = () => setSelected(selected === i ? null : i);
          return (
            <g
              className={"preview-node " + (selected === i ? "chosen" : "")}
              key={name}
              transform={"translate(" + x + " " + y + ")"}
              role="button"
              tabIndex={0}
              aria-label={name}
              aria-pressed={selected === i}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              <rect
                x="-36"
                y="-34"
                width="72"
                height="68"
                rx="13"
                className="preview-box"
              />
              <rect
                x="-29"
                y="-27"
                width="58"
                height="54"
                rx="9"
                fill="none"
                stroke="#253556"
              />
              {kind === "server" ? (
                <Rack x={-22} y={-27} scale={0.65} />
              ) : (
                <Icon x="-13" y="-13" size={26} strokeWidth={1.55} />
              )}
              <text y="55" className="preview-label">
                {name}
              </text>
              <text y="72" className="preview-sub">
                {sub}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="blueprint-bottom">
        <span>
          {selected === null ? (
            <>
              <Activity size={14} /> Select a component to inspect it
            </>
          ) : (
            catalog[previewNodes[selected].kind][1]
          )}
        </span>
        <button
          className="icon-button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          {playing ? <span className="pause-glyph" /> : <Play size={15} />}
        </button>
      </div>
    </div>
  );
}
const features = [
  [
    Workflow,
    "Design architectures",
    "Connect traffic generators, services, queues, and databases on a freeform canvas.",
    1,
  ],
  [
    Activity,
    "Watch systems behave",
    "Follow live requests, inspect latency, and see how load moves through your architecture.",
    6,
  ],
  [
    Zap,
    "Experiment with failure",
    "Introduce outages and traffic spikes to explore failover, backpressure, and recovery.",
    7,
  ],
] as const;
export function Landing({ launch }: { launch: (i: number) => void }) {
  const [feature, setFeature] = useState(0);
  const [, name, copy, variant] = features[feature];
  return (
    <main className="landing">
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> INTERACTIVE INFRASTRUCTURE LAB
          </div>
          <h1>
            Visualize the
            <br />
            <em>invisible.</em>
          </h1>
          <p>
            Design distributed systems, simulate traffic, and see what happens
            when infrastructure is put under pressure.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#studio">
              Launch Studio <ArrowRight size={19} />
            </a>
            <a className="button secondary" href="#scenarios">
              Explore scenarios <ArrowDown size={17} />
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <GitBranch size={15} /> Deterministic simulation
            </span>
            <span>
              <Shield size={15} /> Runs in your browser
            </span>
          </div>
        </div>
        <Blueprint />
      </section>
      <section className="feature-section" id="capabilities">
        <div className="wrap">
          <div className="eyebrow section-label">THE WORKBENCH</div>
          <h2>Design and test distributed systems.</h2>
          <div className="feature-workbench">
            <div className="feature-controls" aria-label="Capability previews">
              {features.map(([Icon, label], index) => (
                <button
                  key={label}
                  aria-pressed={feature === index}
                  onClick={() => setFeature(index)}
                >
                  <Icon size={19} /> {label} <ChevronRight size={16} />
                </button>
              ))}
            </div>
            <article className="feature-preview">
              <TopologyArt
                graph={scenarios[variant].graph}
                variant={variant}
                active
              />
              <div>
                <h3>{name}</h3>
                <p>{copy}</p>
                <button
                  className="button secondary small"
                  onClick={() => launch(variant)}
                >
                  Open {scenarios[variant].name} <ArrowRight size={15} />
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section id="scenarios" className="wrap scenarios-section">
        <div className="eyebrow section-label">READY-TO-RUN LABS</div>
        <h2>Explore a system in motion.</h2>
        <div className="scenario-grid">
          {scenarios.map((scenario, i) => {
            return (
              <button
                key={scenario.name}
                className="scenario-card"
                onClick={() => launch(i)}
              >
                <TopologyArt graph={scenario.graph} variant={i} />
                <span className="scenario-copy">
                  <strong>{scenario.name}</strong>
                  <small>{scenario.description}</small>
                </span>
                <ChevronRight className="scenario-arrow" size={17} />
              </button>
            );
          })}
        </div>
      </section>
      <section className="feature-section">
        <div className="wrap how">
          <div>
            <div className="eyebrow section-label">YOUR FIRST SIMULATION</div>
            <h2>Start with a single request.</h2>
            <p className="section-intro">
              Load a scenario or build from scratch, configure the components,
              then run and inspect the outcome.
            </p>
            <a className="button secondary" href="#docs">
              <BookOpen size={17} /> Read the learning center
            </a>
          </div>
          <Infrastructure className="server-stack" />
        </div>
      </section>
      <footer className="wrap footer">
        <Brand />
        <span>Educational infrastructure simulator</span>
        <a href="#docs">
          Documentation <ArrowRight size={15} />
        </a>
      </footer>
    </main>
  );
}
export function Docs() {
  return (
    <main className="wrap docs">
      <div className="eyebrow section-label">SYSTEMLAB LEARNING CENTER</div>
      <h1>Read the system.</h1>
      <p className="section-intro">
        Understand each component, how requests move, and what the simulator
        measures.
      </p>
      <h2>Components</h2>
      <div className="docs-grid">
        {Object.entries(catalog).map(([key, [name, copy]]) => {
          const Glyph = icons[key as Kind];
          return (
            <article key={key}>
              <Glyph size={20} />
              <h3>{name}</h3>
              <p>{copy}</p>
            </article>
          );
        })}
      </div>
      <h2>Routing and simulation controls</h2>
      <p>
        Round robin walks healthy destinations in connection order. Least
        connections chooses the destination with the lowest number of active and
        queued requests, breaking ties in connection order. The gateway resets
        its rate limit at each simulated second. App server concurrency
        increases one slot under load until the configured maximum.
      </p>
      <p>
        Start begins a run. Pause freezes simulated time, Resume continues the
        same run, and Step advances paused time by 100 ms. Stop ends the run and
        keeps results visible. Reset restores the engine to time zero using the
        current topology and seed. Speed changes the relationship between real
        and simulated time.
      </p>
      <h2>Metrics</h2>
      <ul>
        <li>
          Requests per second counts all completed requests in the trailing
          simulated second.
        </li>
        <li>
          Average latency is total successful request time divided by successes.
          P50, P95, and P99 use nearest rank on latencies rounded to
          milliseconds.
        </li>
        <li>
          Availability is successes divided by completions. Error rate is
          failures divided by completions.
        </li>
        <li>
          Utilization is occupied concurrency divided by active concurrency.
          Queue depth counts pending requests waiting for processing.
        </li>
        <li>
          Cache hit rate is hits divided by cache and CDN lookups. Traffic
          distribution counts arrivals at each component.
        </li>
      </ul>
      <h2>Model assumptions</h2>
      <p>
        SystemLab is an educational simulator. Processing and network delays are
        fixed. Cache and firewall decisions use seeded probabilities.
        Replication tracks write progress with asynchronous delivery and no
        replay. Scaling adds concurrency on a single component. End-to-end
        latency excludes response return paths. Runs end after one simulated
        hour or when engine safety limits are reached.
      </p>
      <h2>Example architectures</h2>
      <p>
        Explore eight built-in labs covering web requests, load balancing,
        availability, replication, cache, traffic spikes, queues and recovery.
      </p>
      <a className="button primary" href="#scenarios">
        Browse scenarios <ArrowRight size={17} />
      </a>
    </main>
  );
}
