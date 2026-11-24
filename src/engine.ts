import { validate, type Architecture, type Block } from "./model";

type Request = { id: number; start: number; write: boolean };
type Event = { time: number; order: number; run: () => void };
type Status = {
  node: Block;
  targets: Status[];
  online: boolean;
  busy: number;
  capacity: number;
  waiting: Request[];
  inflight: Map<number, Request>;
  reserved: Set<number>;
  cursor: number;
  rateWindow: number;
  accepted: number;
  received: number;
  latestWrite: number;
};
export interface Log {
  time: number;
  message: string;
  level: "info" | "error";
  id: number;
}
export interface Packet {
  id: number;
  source: string;
  target: string;
  at: number;
}
export class Simulator {
  readonly states: Map<string, Status>;
  time = 0;
  result: "ready" | "running" | "paused" | "stopped" = "ready";
  logs: Log[] = [];
  packets: Packet[] = [];
  private pending = new Map<number, Request>();
  private events: Event[] = [];
  private completed: { at: number; latency: number; ok: boolean }[] = [];
  private histogram = new Uint32Array(30001);
  private order = 0;
  private id = 0;
  private randomState: number;
  private successes = 0;
  private failures = 0;
  private sum = 0;
  private hits = 0;
  private lookups = 0;

  constructor(graph: Architecture) {
    const errors = validate(graph);
    if (errors.length) throw Error(errors[0]);
    this.randomState = graph.seed || 0x9e3779b9;
    this.states = new Map(
      graph.nodes.map((node) => [
        node.id,
        {
          node,
          targets: [],
          online: true,
          busy: 0,
          capacity: node.config.capacity ?? 0,
          waiting: [],
          inflight: new Map(),
          reserved: new Set(),
          cursor: 0,
          rateWindow: -1,
          accepted: 0,
          received: 0,
          latestWrite: 0,
        },
      ]),
    );
    for (const { source, target } of graph.edges)
      this.states.get(source)!.targets.push(this.states.get(target)!);
    for (const state of this.states.values()) {
      const c = state.node.config;
      if (state.node.kind === "client")
        this.schedule(0, () => this.generate(state));
      if (c.failureAt) {
        this.schedule(c.failureAt, () => {
          state.online = false;
          this.log(state.node.id + " went offline", "error");
          for (const request of [...state.inflight.values(), ...state.waiting])
            this.finish(request, "Component went offline");
          state.inflight.clear();
          state.reserved.clear();
          state.waiting = [];
          state.busy = 0;
          this.schedule(c.recoverAfter, () => {
            state.online = true;
            this.log(state.node.id + " recovered");
            this.drainQueues(state);
          });
        });
      }
    }
  }
  start() {
    if (this.result === "ready" || this.result === "paused")
      this.result = "running";
  }
  pause() {
    if (this.result === "running") this.result = "paused";
  }
  stop() {
    this.result = "stopped";
    this.events = [];
    this.pending.clear();
    for (const s of this.states.values()) {
      s.waiting = [];
      s.inflight.clear();
      s.reserved.clear();
      s.busy = 0;
    }
  }
  step() {
    if (this.result === "ready" || this.result === "paused") {
      this.result = "paused";
      this.runUntil(100);
    }
  }
  advance(delta: number) {
    if (this.result === "running") this.runUntil(delta);
  }
  private runUntil(delta: number) {
    if (this.result === "stopped" || !Number.isFinite(delta) || delta < 0)
      return;
    const until = Math.min(this.time + delta, 3600000);
    let count = 0;
    while (this.events[0]?.time <= until) {
      if (++count > 100000) {
        this.log("Event budget exceeded", "error");
        this.stop();
        return;
      }
      const event = this.pop();
      this.time = event.time;
      event.run();
      if (this.isStopped()) return;
    }
    this.time = until;
    this.completed = this.completed.filter((e) => e.at > this.time - 1000);
    if (until === 3600000) {
      this.log("One-hour simulation limit reached");
      this.stop();
    }
  }
  private isStopped() {
    return this.result === "stopped";
  }
  private before(a: Event, b: Event) {
    return a.time < b.time || (a.time === b.time && a.order < b.order);
  }
  private schedule(delay: number, run: () => void) {
    if (this.events.length >= 100000) {
      this.log("Pending event limit reached", "error");
      this.stop();
      return;
    }
    if (this.isStopped()) return;
    const event = { time: this.time + delay, order: ++this.order, run };
    let i = this.events.length;
    this.events.push(event);
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!this.before(event, this.events[parent])) break;
      this.events[i] = this.events[parent];
      i = parent;
    }
    this.events[i] = event;
  }
  private pop() {
    const first = this.events[0],
      last = this.events.pop()!;
    if (!this.events.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.events.length) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.events.length &&
        this.before(this.events[child + 1], this.events[child])
      )
        child++;
      if (!this.before(this.events[child], last)) break;
      this.events[i] = this.events[child];
      i = child;
    }
    this.events[i] = last;
    return first;
  }
  private random() {
    let x = this.randomState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.randomState = x >>> 0;
    return this.randomState / 4294967296;
  }
  private log(message: string, level: Log["level"] = "info") {
    this.logs.push({ time: this.time, message, level, id: ++this.order });
    if (this.logs.length > 160) this.logs.shift();
  }
  private generate(state: Status) {
    const c = state.node.config;
    const rate =
      c.rate *
      (c.spikeAt &&
      this.time >= c.spikeAt &&
      this.time < c.spikeAt + c.spikeDuration
        ? c.spikeFactor
        : 1);
    const request = {
      id: ++this.id,
      start: this.time,
      write: this.random() < 0.25,
    };
    state.received++;
    this.pending.set(request.id, request);
    this.schedule(c.timeout, () => this.finish(request, "Request timed out"));
    this.forward(state, request);
    this.schedule(1000 / rate, () => this.generate(state));
  }
  private canRoute(target: Status) {
    return (
      target.online ||
      (target.node.kind === "database" &&
        target.targets.some((replica) => replica.online))
    );
  }
  private target(
    state: Status,
    eligible = state.targets.filter((t) => this.canRoute(t)),
  ) {
    if (state.node.kind === "balancer" && state.node.config.algorithm === 1) {
      let best: Status | undefined;
      let minimum = Infinity;
      for (const target of eligible) {
        const load =
          target.busy +
          target.waiting.filter((request) => this.pending.has(request.id))
            .length;
        if (load < minimum) {
          best = target;
          minimum = load;
        }
      }
      return best;
    }
    for (let i = 0; i < state.targets.length; i++) {
      const target = state.targets[state.cursor++ % state.targets.length];
      if (eligible.includes(target)) return target;
    }
  }
  private recordPacket(state: Status, target: Status) {
    this.packets.push({
      id: ++this.order,
      source: state.node.id,
      target: target.node.id,
      at: this.time,
    });
    if (this.packets.length > 90) this.packets.shift();
  }
  private forward(
    state: Status,
    request: Request,
    target = this.target(state),
  ) {
    if (!target) {
      this.finish(request, "No healthy route from " + state.node.id);
      return;
    }
    this.recordPacket(state, target);
    this.schedule(state.node.config.network ?? 0, () => {
      if (!this.pending.has(request.id)) return;
      if (!this.canRoute(target) && state.node.kind !== "queue") {
        const alternate = this.target(state);
        if (alternate) {
          this.forward(state, request, alternate);
          return;
        }
      }
      this.receive(target, request);
    });
  }
  private receive(state: Status, request: Request) {
    state.received++;
    const { kind, config: c } = state.node;
    if (!state.online) {
      const replica = kind === "database" && this.target(state);
      if (replica) {
        this.log("Database failover routed to " + replica.node.id);
        this.forward(state, request, replica);
      } else this.finish(request, "Component " + state.node.id + " is offline");
      return;
    }
    if (
      kind === "database" ||
      kind === "replica" ||
      kind === "server" ||
      kind === "worker"
    ) {
      if (state.busy >= state.capacity && state.capacity < (c.scaleTo ?? 0)) {
        state.capacity++;
        this.log(
          state.node.id +
            " scaled to " +
            state.capacity +
            " concurrent requests",
        );
      }
      if (state.busy < state.capacity) this.process(state, request);
      else this.enqueue(state, request);
      return;
    }
    if (kind === "queue") {
      this.enqueue(state, request);
      this.drain(state);
      return;
    }
    if (kind === "cache" || kind === "cdn") {
      this.lookups++;
      if (this.random() * 100 < c.hitRate) {
        this.hits++;
        this.schedule(c.processing, () => this.finish(request));
        return;
      }
    }
    if (kind === "gateway") {
      const window = Math.floor(this.time / 1000);
      if (state.rateWindow !== window) {
        state.rateWindow = window;
        state.accepted = 0;
      }
      if (state.accepted++ >= c.limit) {
        this.finish(request, "Gateway rate limit");
        return;
      }
    }
    if (kind === "firewall" && this.random() * 100 < c.blockRate) {
      this.finish(request, "Firewall rejected request");
      return;
    }
    this.forward(state, request);
  }
  private enqueue(state: Status, request: Request) {
    state.waiting = state.waiting.filter((r) => this.pending.has(r.id));
    if (state.waiting.length >= state.node.config.buffer)
      this.finish(request, "Queue full at " + state.node.id);
    else state.waiting.push(request);
  }
  private drain(state: Status) {
    while (state.waiting.length) {
      const request = state.waiting[0];
      if (!this.pending.has(request.id)) {
        state.waiting.shift();
        continue;
      }
      const target = this.target(
        state,
        state.targets.filter((t) => t.online && t.busy < t.capacity),
      );
      if (!target) return;
      state.waiting.shift();
      // Reserve worker capacity on dispatch so multiple queues cannot claim the same slot.
      target.busy++;
      target.reserved.add(request.id);
      this.recordPacket(state, target);
      this.schedule(state.node.config.network, () => {
        if (target.reserved.delete(request.id)) {
          target.busy--;
          if (this.pending.has(request.id)) this.receive(target, request);
          this.drainQueues(target);
        } else this.finish(request, "Worker offline during dispatch");
      });
    }
  }
  private drainQueues(worker: Status) {
    if (worker.node.kind !== "worker") return;
    for (const state of this.states.values())
      if (state.node.kind === "queue" && state.targets.includes(worker))
        this.drain(state);
  }
  private process(state: Status, request: Request) {
    state.busy++;
    state.inflight.set(request.id, request);
    this.schedule(state.node.config.processing, () => {
      if (!state.inflight.delete(request.id)) return;
      state.busy--;
      const { kind, config } = state.node;
      if (kind === "database" && request.write) {
        state.latestWrite = Math.max(state.latestWrite, request.id);
        for (const replica of state.targets) {
          this.recordPacket(state, replica);
          this.schedule(config.replication, () => {
            if (replica.online) {
              replica.latestWrite = Math.max(replica.latestWrite, request.id);
              this.log(
                "Write " + request.id + " replicated to " + replica.node.id,
              );
            } else
              this.log("Replica offline during write propagation", "error");
          });
        }
      }
      if (this.pending.has(request.id)) {
        if (kind === "server" && state.targets.length)
          this.forward(state, request);
        else this.finish(request);
      }
      while (state.waiting.length && state.busy < state.capacity) {
        const next = state.waiting.shift()!;
        if (this.pending.has(next.id)) this.process(state, next);
      }
      this.drainQueues(state);
    });
  }
  private finish(request: Request, reason?: string) {
    if (!this.pending.delete(request.id)) return;
    const latency = this.time - request.start;
    if (reason) {
      this.failures++;
      this.log(reason, "error");
    } else {
      this.successes++;
      this.sum += latency;
      this.histogram[Math.min(30000, Math.round(latency))]++;
      if (this.successes === 1 || this.successes % 25 === 0) {
        this.log(`Request ${request.id} completed in ${latency.toFixed(1)} ms`);
      }
    }
    this.completed.push({ at: this.time, latency, ok: !reason });
  }
  metrics() {
    const total = this.successes + this.failures;
    const percentile = (p: number) => {
      const rank = Math.ceil(this.successes * p);
      if (!rank) return 0;
      let count = 0;
      for (let i = 0; i < this.histogram.length; i++) {
        count += this.histogram[i];
        if (count >= rank) return i;
      }
      return 0;
    };
    return {
      rps: this.completed.filter((e) => e.at > this.time - 1000).length,
      success: this.successes,
      failed: this.failures,
      average: this.successes ? this.sum / this.successes : 0,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      availability: total ? (100 * this.successes) / total : 0,
      errorRate: total ? (100 * this.failures) / total : 0,
      cacheRate: this.lookups ? (100 * this.hits) / this.lookups : 0,
      depth: [...this.states.values()].reduce(
        (sum, s) =>
          sum + s.waiting.filter((r) => this.pending.has(r.id)).length,
        0,
      ),
      components: [...this.states.values()].map((s) => ({
        id: s.node.id,
        online: s.online,
        received: s.received,
        latestWrite: s.latestWrite,
        utilization: s.capacity ? (100 * s.busy) / s.capacity : 0,
        depth: s.waiting.filter((r) => this.pending.has(r.id)).length,
      })),
    };
  }
}
