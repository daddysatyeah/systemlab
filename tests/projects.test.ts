import { expect, it } from "vitest";
import { exportImage } from "../src/image-export";
import {
  loadProjects,
  parseArchitecture,
  project,
  saveProjects,
  serializeArchitecture,
} from "../src/projects";
import { scenarios } from "../src/scenarios";
const graph = scenarios[2].graph;
it("round-trips JSON and exports a standalone SVG", () => {
  expect(parseArchitecture(serializeArchitecture(graph))).toEqual(graph);
  expect(exportImage(graph)).toMatch(/^<svg xmlns=.*<\/svg>$/);
});
it("rejects malformed, oversized, and invalid data", () => {
  expect(() => parseArchitecture("{")).toThrow();
  expect(() => parseArchitecture(" ".repeat(1000001))).toThrow(/size/);
  expect(() =>
    parseArchitecture(
      JSON.stringify({
        ...graph,
        edges: [{ source: "missing", target: "n1" }],
      }),
    ),
  ).toThrow(/missing/);
  expect(() =>
    parseArchitecture(JSON.stringify({ ...graph, seed: -2 })),
  ).toThrow();
});
it("clones project data and round-trips local storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const a = project("First project", graph),
    b = project("First project copy", a.graph);
  b.graph.nodes[0].config.rate = 100;
  expect(a.graph.nodes[0].config.rate).not.toBe(100);
  saveProjects(storage, [a, b]);
  expect(loadProjects(storage)).toEqual([a, b]);
  expect(() => loadProjects({ getItem: () => "{" })).toThrow();
  expect(() =>
    saveProjects(
      {
        setItem: () => {
          throw Error("Quota exceeded");
        },
      },
      [a],
    ),
  ).toThrow(/Quota/);
});
