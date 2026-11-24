import { catalog, type Architecture } from "./model";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function exportImage(graph: Architecture) {
  if (!graph.nodes.length)
    throw Error("Add a component before exporting an image.");
  const x = Math.min(...graph.nodes.map((n) => n.x)) - 40,
    y = Math.min(...graph.nodes.map((n) => n.y)) - 40;
  const w = Math.max(...graph.nodes.map((n) => n.x)) + 215 - x,
    h = Math.max(...graph.nodes.map((n) => n.y)) + 105 - y;
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const lines = graph.edges
    .map((e) => {
      const a = nodes.get(e.source)!,
        b = nodes.get(e.target)!;
      return (
        '<path d="M ' +
        (a.x + 170) +
        " " +
        (a.y + 30) +
        " L " +
        b.x +
        " " +
        (b.y + 30) +
        '" marker-end="url(#arrow)"/>'
      );
    })
    .join("");
  const boxes = graph.nodes
    .map(
      (n) =>
        '<g transform="translate(' +
        n.x +
        " " +
        n.y +
        ')"><rect width="170" height="60" rx="10" fill="#182339" stroke="#6177ab"/><text x="12" y="27" fill="white" font-size="14">' +
        escape(catalog[n.kind][0]) +
        '</text><text x="12" y="45" fill="#abb9d4" font-size="10">' +
        escape(n.id.slice(0, 18)) +
        "</text></g>",
    )
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
    [x, y, w, h].join(" ") +
    '" width="' +
    w +
    '" height="' +
    h +
    '"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#7089d8"/></marker></defs><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    w +
    '" height="' +
    h +
    '" fill="#0e1421"/><g stroke="#7089d8" stroke-width="2">' +
    lines +
    '</g><g font-family="system-ui,sans-serif">' +
    boxes +
    "</g></svg>"
  );
}
