export const catalog = {
  client: [
    "Traffic generator",
    "Creates requests at a fixed rate with an optional temporary spike.",
  ],
  balancer: [
    "Load balancer",
    "Distributes work using round robin or least connections and skips offline targets.",
  ],
  server: [
    "App server",
    "Processes requests with limited concurrency and an optional automatic capacity increase.",
  ],
  gateway: [
    "API gateway",
    "Applies a per-second rate limit before forwarding traffic.",
  ],
  database: [
    "Database",
    "Processes data requests and schedules asynchronous replication to connected replicas.",
  ],
  replica: [
    "Database replica",
    "Serves as a failover target and tracks the most recent applied write.",
  ],
  cache: [
    "Cache",
    "Serves seeded cache hits locally and forwards misses to the origin.",
  ],
  queue: [
    "Message queue",
    "Buffers work until a connected worker can accept it.",
  ],
  worker: ["Worker", "Processes buffered jobs with configurable concurrency."],
  cdn: ["CDN", "Serves seeded edge hits and forwards misses to the origin."],
  firewall: [
    "Firewall",
    "Rejects a configured percentage of incoming traffic.",
  ],
} as const;
export type Kind = keyof typeof catalog;
type Field = readonly [
  label: string,
  min: number,
  max: number,
  initial: number,
];
const network: Field = ["Network latency (ms)", 0, 5000, 8];
const processing: Field = ["Processing time (ms)", 1, 10000, 40];
const capacity: Field = ["Concurrency", 1, 100, 4];
const buffer: Field = ["Queue limit", 0, 500, 40];
const failure = {
  failureAt: ["Failure at (ms, 0 = off)", 0, 120000, 0],
  recoverAfter: ["Recovery after (ms)", 1, 60000, 3500],
} as const;
export const fields: Record<Kind, Record<string, Field>> = {
  client: {
    rate: ["Requests per second", 1, 200, 24],
    spikeAt: ["Spike at (ms, 0 = off)", 0, 120000, 0],
    spikeDuration: ["Spike duration (ms)", 1, 60000, 4000],
    spikeFactor: ["Spike multiplier", 1, 10, 3],
    timeout: ["Timeout (ms)", 10, 30000, 2200],
    network,
  },
  balancer: { algorithm: ["Algorithm", 0, 1, 0], network },
  server: {
    processing,
    capacity,
    buffer,
    scaleTo: ["Maximum concurrency", 1, 100, 4],
    network,
    ...failure,
  },
  gateway: { limit: ["Requests per second", 1, 1000, 100], network },
  database: {
    processing,
    capacity,
    buffer,
    replication: ["Replication delay (ms)", 0, 10000, 600],
    network,
    ...failure,
  },
  replica: { processing, capacity, buffer, ...failure },
  cache: { hitRate: ["Hit probability (%)", 0, 100, 75], processing, network },
  queue: { buffer: ["Queue limit", 1, 500, 80], network },
  worker: { processing, capacity, buffer, ...failure },
  cdn: { hitRate: ["Hit probability (%)", 0, 100, 65], processing, network },
  firewall: { blockRate: ["Blocked traffic (%)", 0, 100, 5], network },
};
export interface Block {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  config: Record<string, number>;
}
export interface Link {
  source: string;
  target: string;
}
export interface Architecture {
  nodes: Block[];
  edges: Link[];
  seed: number;
}
export const blank = (): Architecture => ({ nodes: [], edges: [], seed: 42 });
export function block(
  kind: Kind,
  id: string,
  x: number,
  y: number,
  overrides: Record<string, number> = {},
): Block {
  return {
    kind,
    id,
    x,
    y,
    config: {
      ...Object.fromEntries(
        Object.entries(fields[kind]).map(([key, field]) => [key, field[3]]),
      ),
      ...overrides,
    },
  };
}
export function connectionError(
  source: Block,
  target: Block,
): string | undefined {
  if (source.id === target.id || target.kind === "client")
    return "That connection is invalid.";
  if (source.kind === "replica" || source.kind === "worker")
    return "This component is a terminal destination.";
  if (source.kind === "database" && target.kind !== "replica")
    return "Databases connect only to replicas.";
  if (source.kind === "queue" && target.kind !== "worker")
    return "Queues connect only to workers.";
}
export function validate(graph: Architecture, runnable = true): string[] {
  const errors: string[] = [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const visited = new Set<string>(),
    active = new Set<string>();
  if (graph.nodes.length > 80 || graph.edges.length > 240)
    errors.push(
      "The workspace supports up to 80 components and 240 connections.",
    );
  if (
    !Number.isInteger(graph.seed) ||
    graph.seed < 0 ||
    graph.seed > 4294967295
  )
    errors.push("Invalid simulation seed.");
  if (nodes.size !== graph.nodes.length)
    errors.push("Component IDs must be unique.");
  for (const { source, target } of graph.edges) {
    const a = nodes.get(source),
      b = nodes.get(target),
      route = outgoing.get(source) ?? [];
    if (!a || !b) errors.push("Connection references a missing component.");
    else {
      const issue = connectionError(a, b);
      if (issue) errors.push(issue);
    }
    if (route.includes(target)) errors.push("Duplicate connection.");
    route.push(target);
    outgoing.set(source, route);
  }
  function visit(id: string) {
    if (active.has(id)) {
      errors.push("Routing loops are forbidden.");
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    active.add(id);
    for (const target of outgoing.get(id) ?? []) visit(target);
    active.delete(id);
  }
  for (const id of nodes.keys()) visit(id);
  for (const node of graph.nodes) {
    if (
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      Math.abs(node.x) > 100000 ||
      Math.abs(node.y) > 100000
    )
      errors.push("Component positions must be within the workspace bounds.");
    for (const [key, [label, min, max]] of Object.entries(fields[node.kind])) {
      const value = node.config[key];
      if (!Number.isInteger(value) || value < min || value > max)
        errors.push(
          label + " must be an integer between " + min + " and " + max + ".",
        );
    }
    if (node.kind === "server" && node.config.scaleTo < node.config.capacity)
      errors.push("Maximum concurrency must cover base concurrency.");
    if (
      runnable &&
      [
        "client",
        "balancer",
        "gateway",
        "cache",
        "cdn",
        "queue",
        "firewall",
      ].includes(node.kind) &&
      !outgoing.get(node.id)?.length
    )
      errors.push(catalog[node.kind][0] + " needs an outgoing connection.");
  }
  if (runnable) {
    const clients = graph.nodes.filter((node) => node.kind === "client");
    if (!clients.length) errors.push("Add a traffic generator.");
    visited.clear();
    for (const node of clients) visit(node.id);
    if (graph.nodes.some((node) => !visited.has(node.id)))
      errors.push(
        "Every component must be reachable from a traffic generator.",
      );
  }
  return [...new Set(errors)];
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function importGraph(input: unknown): Architecture {
  if (
    !object(input) ||
    !Array.isArray(input.nodes) ||
    !Array.isArray(input.edges) ||
    input.nodes.length > 80 ||
    input.edges.length > 240 ||
    typeof input.seed !== "number" ||
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 4294967295
  )
    throw Error("Invalid architecture format or size.");
  const nodes = input.nodes.map((n: unknown) => {
    if (
      !object(n) ||
      typeof n.id !== "string" ||
      !/^[\w-]{1,80}$/.test(n.id) ||
      typeof n.kind !== "string" ||
      !Object.hasOwn(catalog, n.kind) ||
      typeof n.x !== "number" ||
      typeof n.y !== "number" ||
      Math.abs(n.x) > 100000 ||
      Math.abs(n.y) > 100000 ||
      !Number.isFinite(n.x + n.y) ||
      !object(n.config)
    )
      throw Error("Invalid component.");
    const kind = n.kind as Kind;
    const config = n.config;
    return {
      id: n.id,
      kind,
      x: n.x,
      y: n.y,
      config: Object.fromEntries(
        Object.keys(fields[kind]).map((key) => [key, config[key] as number]),
      ),
    };
  });
  const edges = input.edges.map((e: unknown) => {
    if (
      !object(e) ||
      typeof e.source !== "string" ||
      typeof e.target !== "string"
    )
      throw Error("Invalid connection.");
    return { source: e.source, target: e.target };
  });
  const graph = { nodes, edges, seed: input.seed };
  const errors = validate(graph, false);
  if (errors.length) throw Error(errors[0]);
  return graph;
}
