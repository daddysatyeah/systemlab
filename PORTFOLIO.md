# SystemLab portfolio guide

## Resume project description

**SystemLab | React, TypeScript, Vite, XYFlow, Recharts, Vitest, Playwright**

- Built a browser-based cloud architecture simulator with a drag-and-drop editor, 11 infrastructure component types, and eight scenarios covering load balancing, caching, queues, replication, traffic spikes, and failover.
- Implemented a seeded TypeScript discrete-event engine and live metrics for throughput, latency percentiles, and availability. Verified deterministic results and production workflows with Vitest and Playwright.

## 90-second recruiter demo

| Time | Show | Say |
| --- | --- | --- |
| 0–15 s | Homepage and architecture preview | “SystemLab is an interactive cloud architecture simulator. I built it so you can move from a static diagram to a running model and see how changes affect requests.” |
| 15–35 s | Open High-availability architecture. Select a faster simulation speed and start. | “Traffic flows through a load balancer to two application servers. The topology is editable, and the engine schedules arrivals, network hops, and processing events using a repeatable seed.” |
| 35–55 s | Point to the offline server, surviving route, and availability. Pause and open Event timeline. | “One server goes offline after 2.5 simulated seconds. The load balancer skips it, and the requests continue through the other server. I can pause the run and inspect the failure in the event timeline.” |
| 55–75 s | Load Message queue and workers, run during the spike, and switch the chart to Queue depth. | “This scenario shows a different behavior. A traffic spike creates a backlog, and worker capacity determines how fast it drains. The chart is driven by the same event engine.” |
| 75–90 s | Open the project menu and point out JSON and SVG exports. | “Projects stay in browser storage and can be exported. I verified all eight scenarios in the production build, including direct links and matching the displayed metrics to an independent engine run.” |

## Technical interview questions and answers

1. **Why a discrete-event simulator?** The engine jumps between scheduled arrivals, completions, timeouts, and failures. It can model events more precisely than the UI refresh interval and avoids processing every simulated millisecond.
2. **How are events ordered?** A binary min-heap orders them by simulated timestamp and then by insertion sequence. Inserting and removing events is logarithmic in the number of queued events.
3. **What makes runs reproducible?** The topology, configuration, seed, and deterministic event ordering determine the result. A 32-bit xorshift generator drives probability-based decisions.
4. **How does changing speed affect results?** It changes how much simulated time the UI advances per tick. The engine still processes events in timestamp order. Step advances a paused run by 100 simulated milliseconds.
5. **How do you avoid counting a timed-out request twice?** The engine keeps outstanding requests in a map. Finishing a request removes it, and subsequent attempts to finish the same ID cannot change completion counts.
6. **How does round robin handle failure?** It advances a cursor through the connected targets and skips unavailable routes. Recovery makes the target eligible again.
7. **What does least connections mean here?** It chooses the eligible target with the fewest occupied slots plus pending queued requests. Connection order breaks ties.
8. **How is concurrent worker execution modeled?** A queue reserves a worker slot before sending a request across the simulated network. Arrival consumes that reservation, which prevents multiple dispatches from claiming the same slot.
9. **How do the queue and autoscaling models differ?** The queue buffers pending work under a configured limit. Autoscaling adds an app-server concurrency slot on pressure up to the configured maximum.
10. **How is API rate limiting implemented?** The gateway counts requests in fixed simulated one-second windows and rejects requests above the configured limit.
11. **How are the cache and CDN modeled?** Both use seeded hit probabilities. A hit completes locally after the configured processing delay, and a miss forwards to the next eligible component.
12. **How does replication work?** A primary write schedules a future replica update carrying the write ID. If the primary goes offline and a healthy replica is reachable, the simulator can route requests through that replica.
13. **How are throughput and latency measured?** Throughput counts completions over the latest simulated second. Successful requests contribute to the latency average and a bounded histogram used for P50, P95, and P99.
14. **What is availability in this model?** It is the percentage of completed requests that succeeded. Pending requests are outside the denominator.
15. **How are bad topologies handled?** The validator checks component settings, edges, reachability, and cycles. JSON imports are normalized and validated before replacing or creating project state.
16. **Why did the Studio canvas disappear during simulation?** Controlled node updates omitted dimensions measured by React Flow. Keeping measurements through runtime updates preserved node visibility and edge handle bounds.
17. **How do packets stay on their connections?** The engine records actual request hops and replication dispatches. The UI samples those records and animates the packets along the corresponding SVG edge paths.
18. **Where are projects saved?** The app stores topology, settings, and seed in browser localStorage. JSON export allows backup and transfer, while the active run and undo history remain session-local.
19. **How did you verify the metrics shown in the UI?** Browser tests run each scenario against the production build, then advance a separate engine instance to the same simulated time and compare all nine reported values.
20. **Why use hash-based routing and GitHub Pages?** A fragment route is handled by the browser, so Studio and Docs can share one static entry point. Vite builds assets with a project-specific base path, and GitHub Actions verifies the build before deploying it.

See the [architecture decisions](ARCHITECTURE.md) and [verification report](TEST-REPORT.md) for implementation details and test scope.
