import { block, type Kind, type Architecture } from "./model";
export interface Scenario {
  name: string;
  description: string;
  expected: string;
  graph: Architecture;
}
function scenario(
  name: string,
  description: string,
  expected: string,
  components: [Kind, number, number, Record<string, number>?][],
  edges: number[][],
): Scenario {
  return {
    name,
    description,
    expected,
    graph: {
      seed: 42,
      nodes: components.map(([kind, x, y, config], index) =>
        block(kind, "n" + index, x, y, config),
      ),
      edges: edges.map(([source, target]) => ({
        source: "n" + source,
        target: "n" + target,
      })),
    },
  };
}
export const scenarios = [
  scenario(
    "Basic web application",
    "Follow a request from the browser to a persistent data store.",
    "Each successful request passes through the app and database.",
    [
      ["client", 0, 100],
      ["server", 230, 100],
      ["database", 460, 100],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  ),
  scenario(
    "Load-balanced application",
    "Distribute incoming requests across two application servers.",
    "Round robin alternates between servers while both are online.",
    [
      ["client", 0, 100],
      ["balancer", 230, 100],
      ["server", 460, 20],
      ["server", 460, 180],
    ],
    [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  ),
  scenario(
    "High-availability architecture",
    "Route application traffic around an unavailable server.",
    "After 2.5 seconds the load balancer directs new requests to the surviving server.",
    [
      ["client", 0, 100],
      ["balancer", 230, 100],
      ["server", 460, 20, { failureAt: 2500, recoverAfter: 5000 }],
      ["server", 460, 180],
      ["database", 690, 100],
    ],
    [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
    ],
  ),
  scenario(
    "Database replication",
    "Observe asynchronous writes and read failover.",
    "Writes arrive at the replica after 600 ms. During the primary outage, the replica handles new requests.",
    [
      ["client", 0, 100],
      ["database", 230, 100, { failureAt: 3500 }],
      ["replica", 460, 100],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  ),
  scenario(
    "Cache-enabled application",
    "Compare origin requests with responses served directly from cache.",
    "The cache serves approximately 75% of requests over a long run.",
    [
      ["client", 0, 100],
      ["cache", 230, 100],
      ["server", 460, 100],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  ),
  scenario(
    "E-commerce traffic spike",
    "Watch queue pressure and concurrency change during a surge.",
    "A fivefold surge begins at 2 seconds, bringing the gateway limit and server scaling into play.",
    [
      ["client", 0, 100, { rate: 35, spikeAt: 2000, spikeFactor: 5 }],
      ["gateway", 230, 100, { limit: 140 }],
      ["server", 460, 100, { processing: 110, scaleTo: 14 }],
      ["database", 690, 100, { capacity: 12 }],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  ),
  scenario(
    "Message queue and workers",
    "Buffer a burst of work and drain it across two workers.",
    "Queue depth rises during the spike and decreases as workers become available.",
    [
      ["client", 0, 100, { rate: 16, spikeAt: 1500, spikeFactor: 5 }],
      ["queue", 230, 100],
      ["worker", 460, 20, { processing: 240, capacity: 3 }],
      ["worker", 460, 180, { processing: 240, capacity: 3 }],
    ],
    [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  ),
  scenario(
    "Server failure and recovery",
    "Track failed requests while a single app server is offline.",
    "The server goes offline at 2 seconds and starts accepting new work again at 5.5 seconds.",
    [
      ["client", 0, 100],
      ["server", 230, 100, { failureAt: 2000 }],
    ],
    [[0, 1]],
  ),
];
