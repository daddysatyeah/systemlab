# SystemLab architecture

## Runtime

The React and TypeScript application builds to static files with Vite. The landing page uses locally authored SVG and CSS. The studio uses XYFlow for controls and viewport transforms, Lucide for icons, and Recharts for trends. The studio loads on navigation. The project can run from localhost without external runtime assets.

| Module | Responsibility |
| --- | --- |
| `model.ts` | Component catalog, defaults, numeric bounds, topology checks and JSON normalization |
| `engine.ts` | Simulated clock, bounded event heap, seeded decisions, request accounting and metrics |
| `scenarios.ts` | Self-contained architecture fixtures with descriptions and expected outcomes |
| `studio.tsx`, `panels.tsx` | Topology editor, run controls, inspector and analytics |
| `projects.ts`, `image-export.ts` | Local persistence, JSON round trips and standalone SVG generation |

## Simulation

The engine captures one architecture and seed per run. Events are ordered by timestamp and then insertion sequence. A request stays pending until exactly one completion, failure or timeout. Network hops, processing, failure, recovery, and replication schedule future events. Resource queues drain when capacity becomes available. Workers reserve capacity as a queue dispatches each job. Scheduled worker arrivals carry the reservation identity across network delay.

The load balancer skips unavailable targets. Round robin walks the connection order. Least connections uses occupied slots plus pending queue depth, with connection order as the tie breaker. An unavailable database remains routable while it has a healthy replica. A single seeded pseudo-random generator controls writes, cache and CDN hit decisions, and firewall rejections. The gateway applies a fixed-window limit. App scaling adds one concurrency slot on pressure until the configured cap.

The engine uses a rolling one-second completion count for throughput, counts successful and failed completions, and computes successful-request latencies with a bounded millisecond histogram. Live arrivals, concurrency, queue depth, and cache hits come from the runtime state. The UI samples the metric state for chart history and samples real hop events for packet animation.

Projects retain their architecture configuration, node positions and seed. Invalid or malformed imports leave the current project intact. Edits share the same topology validator and are tracked for up to 50 undo operations. Runtime simulation state and editor history are session-local.

## Known limitations

- This is an educational model. There is no actual network or cloud provisioning. Configured network and service delays are fixed and response return hops are excluded.
- Cache and CDN outcomes are probability-based. There is no object store, TTL, key eviction, or invalidation protocol.
- Replication models asynchronous propagation of write IDs. It omits consistency protocols, replay, and data payloads. Scaling changes local service concurrency and omits provisioning delay and scale-down.
- Stop discards pending work and leaves completed metrics visible. Reloading, changing projects, or leaving Studio ends the active run. Each component supports one scheduled outage and recovery per run.
- Limits include 80 components and 240 edges per project, 100 projects per browser workspace, a one-hour simulation horizon, 100,000 pending events, and 100,000 events per engine advance. Browser storage may impose a lower practical project limit. Event and chart history keep recent samples only.
- SVG export contains the topology and component labels. It omits transient playback state. Local project storage assumes one active editing tab at a time. There is no cloud synchronization.

## Release decisions

| Decision | Trade-off |
| --- | --- |
| Separate the event engine from React | Deterministic unit tests can run without a browser. Studio must translate user controls into simulated time and preserve React Flow measurements during playback. |
| Order events with a binary min-heap | Insertion and removal take logarithmic time in the number of queued events. The insertion sequence resolves equal timestamps. |
| Use a fixed histogram and bounded display history | Percentiles are reproducible without retaining every latency sample. Values are rounded to milliseconds and charts show recent history. |
| Keep storage in the browser | A static deployment needs no application server. Projects are local to the browser origin and JSON export is required to move them between origins. |
| Use fragment navigation and a Vite project base | Direct Studio and Docs links load the same HTML file. The production base matches the `systemlab` repository name. |

Measured checks and their scope are recorded in [the test report](TEST-REPORT.md).
