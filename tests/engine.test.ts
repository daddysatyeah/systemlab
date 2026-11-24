import { describe, expect, it } from "vitest";
import { Simulator } from "../src/engine";
import { blank, block, validate, type Architecture } from "../src/model";
import { scenarios } from "../src/scenarios";

function run(graph: Architecture, ms: number) {
  const sim = new Simulator(graph);
  sim.start();
  sim.advance(ms);
  return sim;
}
function scenario(index: number) {
  return structuredClone(scenarios[index].graph);
}
describe("scenario fixtures", () => {
  it.each(scenarios)("executes $name reproducibly", ({ graph }) => {
    expect(validate(graph)).toEqual([]);
    const first = run(graph, 12000),
      second = run(graph, 12000);
    expect(first.metrics()).toEqual(second.metrics());
    expect(first.logs).toEqual(second.logs);
    expect(first.metrics().success).toBeGreaterThan(0);
  });
});
describe("discrete events", () => {
  it("splits round robin traffic evenly", () => {
    const { components } = run(scenario(1), 6000).metrics();
    expect(
      Math.abs(components[2].received - components[3].received),
    ).toBeLessThanOrEqual(1);
  });
  it("uses occupancy for least connections", () => {
    const graph = scenario(1);
    graph.nodes[0].config.rate = 70;
    graph.nodes[1].config.algorithm = 1;
    graph.nodes[2].config.processing = 700;
    const { components } = run(graph, 6000).metrics();
    expect(components[3].received).toBeGreaterThan(components[2].received * 2);
  });
  it("routes to a healthy app during failure and returns to both after recovery", () => {
    const sim = run(scenario(2), 2500);
    const before = sim.metrics().components[2].received;
    sim.advance(4500);
    expect(sim.metrics().components[2]).toMatchObject({ online: false });
    expect(sim.metrics().components[2].received).toBe(before);
    sim.advance(1500);
    expect(sim.metrics().components[2].online).toBe(true);
    expect(sim.metrics().components[2].received).toBeGreaterThan(before);
  });
  it("records single-server errors and recovers", () => {
    const sim = run(scenario(7), 5100);
    expect(sim.metrics().failed).toBeGreaterThan(0);
    expect(sim.metrics().components[1].online).toBe(false);
    const success = sim.metrics().success;
    sim.advance(1200);
    expect(sim.metrics().components[1].online).toBe(true);
    expect(sim.metrics().success).toBeGreaterThan(success);
  });
  it("queues, overflows and drains burst traffic", () => {
    const graph = scenario(6);
    graph.nodes[1].config.buffer = 24;
    const sim = run(graph, 5300);
    expect(sim.metrics().depth).toBeGreaterThan(0);
    expect(sim.logs.some((log) => log.message.includes("Queue full"))).toBe(
      true,
    );
    sim.advance(4300);
    expect(sim.metrics().depth).toBe(0);
  });
  it("routes misses to origin and ends cache hits immediately after cache delay", () => {
    const graph = scenario(4);
    graph.nodes[1].config.hitRate = 100;
    expect(run(graph, 4000).metrics()).toMatchObject({
      cacheRate: 100,
      average: 48,
    });
    graph.nodes[1].config.hitRate = 0;
    expect(run(graph, 4000).metrics()).toMatchObject({
      cacheRate: 0,
      average: 56,
    });
  });
  it("replicates writes after delay and routes to replica during primary downtime", () => {
    const sim = run(scenario(3), 599);
    expect(sim.metrics().components[2].latestWrite).toBe(0);
    expect(sim.packets).toContainEqual(
      expect.objectContaining({ source: "n1", target: "n2" }),
    );
    sim.advance(2500);
    expect(sim.metrics().components[2].latestWrite).toBeGreaterThan(0);
    expect(sim.metrics().components[2].received).toBe(0);
    sim.advance(2200);
    expect(sim.metrics().components[2].received).toBeGreaterThan(0);
  });
  it("scales under a spike and applies the gateway limiter", () => {
    const sim = run(scenario(5), 5000);
    expect(sim.metrics().failed).toBeGreaterThan(0);
    expect(
      sim.logs.some((log) => log.message.includes("Gateway rate limit")),
    ).toBe(true);
    expect(sim.states.get("n2")?.capacity).toBeGreaterThan(4);
  });
  it("applies CDN hits and firewall rejects", () => {
    const graph = {
      seed: 1,
      nodes: [
        block("client", "c", 0, 0),
        block("firewall", "f", 10, 0, { blockRate: 100 }),
        block("cdn", "e", 20, 0, { hitRate: 100 }),
        block("server", "a", 30, 0),
      ],
      edges: [
        { source: "c", target: "f" },
        { source: "f", target: "e" },
        { source: "e", target: "a" },
      ],
    };
    expect(run(graph, 2000).metrics()).toMatchObject({
      availability: 0,
      errorRate: 100,
    });
    graph.nodes[1].config.blockRate = 0;
    const metrics = run(graph, 2000).metrics();
    expect(metrics).toMatchObject({ cacheRate: 100, availability: 100 });
    expect(metrics.components[3].received).toBe(0);
  });
  it("measures completions and does not count timed-out requests twice", () => {
    const graph = scenario(0);
    const good = run(graph, 4000).metrics();
    expect(good).toMatchObject({
      availability: 100,
      failed: 0,
      p50: 96,
      p95: 96,
      p99: 96,
    });
    expect(good.average).toBeCloseTo(96);
    expect(good.rps).toBe(24);
    graph.nodes[0].config.timeout = 20;
    const bad = run(graph, 4000).metrics();
    expect(bad).toMatchObject({ success: 0, errorRate: 100 });
    expect(bad.failed).toBeLessThanOrEqual(bad.components[0].received);
  });
  it("refuses invalid topology, cycles, duplicate edges, and disconnected blocks", () => {
    expect(() => new Simulator(blank())).toThrow(/traffic generator/);
    const graph = scenario(1);
    graph.edges.push({ source: "n2", target: "n1" });
    expect(validate(graph)).toContain("Routing loops are forbidden.");
    graph.edges.pop();
    graph.edges.push(graph.edges[0]);
    graph.nodes.push(block("server", "isolated", 0, 0));
    expect(validate(graph)).toEqual(
      expect.arrayContaining([
        "Duplicate connection.",
        "Every component must be reachable from a traffic generator.",
      ]),
    );
  });
  it("supports start, pause, step, resume, stop, and fresh reset", () => {
    const graph = scenario(0),
      sim = new Simulator(graph);
    sim.start();
    sim.advance(100);
    sim.pause();
    expect(sim.result).toBe("paused");
    sim.advance(1000);
    expect(sim.time).toBe(100);
    sim.step();
    expect(sim.time).toBe(200);
    sim.start();
    sim.advance(500);
    expect(sim.time).toBe(700);
    sim.stop();
    sim.start();
    sim.advance(500);
    expect(sim.time).toBe(700);
    expect(new Simulator(graph).metrics()).toMatchObject({
      success: 0,
      failed: 0,
    });
  });
});
