import { useId } from "react";
import type { Architecture } from "./model";

export function Rack({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g className="iso-rack" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path className="rack-top" d="M0 22 34 4l34 18-34 18Z" />
      <path className="rack-left" d="M0 22v39l34 18V40Z" />
      <path className="rack-right" d="M34 40v39l34-18V22Z" />
      <path
        className="rack-detail"
        d="m8 37 16 8m-16 4 16 8m-16 4 16 8M42 47l18-9M42 59l18-9M42 71l18-9M20 22l14-7 14 7-14 7Z"
      />
      <path className="rack-leds" d="m54 44 .1 0m-.1 12 .1 0m-.1 12 .1 0" />
    </g>
  );
}

export function Infrastructure({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 460 240" aria-hidden="true">
      <g className="iso-floor" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M${38 + i * 26} ${137 - i * 13}l176 88 M${38 + i * 22} ${137 + i * 11}l208 -104`}
          />
        ))}
        <path
          className="iso-trace"
          d="m64 151 88 44 54-27 54 27 90-45M206 168v-29m54 56v-49"
        />
      </g>
      <Rack x={72} y={84} scale={1.15} />
      <Rack x={170} y={55} scale={1.33} />
      <Rack x={217} y={95} scale={1.1} />
      <Rack x={300} y={60} scale={1.42} />
    </svg>
  );
}

const accents = [
  "#6988ee",
  "#9b7ce8",
  "#68adf0",
  "#49aeb0",
  "#b18af1",
  "#e69c60",
  "#73ba9c",
  "#d67d92",
];
export function TopologyArt({
  graph,
  variant,
  active = false,
}: {
  graph: Architecture;
  variant: number;
  active?: boolean;
}) {
  const grid = useId();
  const maxX = Math.max(...graph.nodes.map((node) => node.x), 1);
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  const maxY = Math.max(...graph.nodes.map((node) => node.y));
  const points = new Map(
    graph.nodes.map((node) => [
      node.id,
      {
        x: 32 + (node.x / maxX) * 216,
        y: maxY === minY ? 57 : 31 + ((node.y - minY) / (maxY - minY)) * 52,
        kind: node.kind,
      },
    ]),
  );
  return (
    <svg
      className="topology-art"
      viewBox="0 0 280 114"
      aria-hidden="true"
      style={{ color: accents[variant] }}
    >
      <defs>
        <pattern id={grid} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".65" fill="currentColor" opacity=".28" />
        </pattern>
      </defs>
      <rect width="280" height="114" fill={`url(#${grid})`} />
      <ellipse
        cx="140"
        cy="83"
        rx="115"
        ry="22"
        fill="currentColor"
        opacity=".055"
      />
      {graph.edges.map(({ source, target }) => {
        const a = points.get(source)!;
        const b = points.get(target)!;
        const middle = (a.x + b.x) / 2;
        const path = `M${a.x} ${a.y}C${middle} ${a.y} ${middle} ${b.y} ${b.x} ${b.y}`;
        return (
          <g key={source + target}>
            <path d={path} className="art-link" />
            {active && (
              <circle r="1.8" fill="currentColor" className="preview-packet">
                <animateMotion
                  path={path}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}
      {[...points].map(([id, { x, y, kind }]) => (
        <g key={id} transform={`translate(${x} ${y})`}>
          {kind === "server" || kind === "worker" ? (
            <Rack x={-11} y={-15} scale={0.32} />
          ) : (
            <>
              <rect
                className="art-node"
                x="-11"
                y="-10"
                width="22"
                height="20"
                rx={kind === "client" ? 9 : 5}
              />
              <path
                className="art-icon"
                d={
                  kind === "client"
                    ? "M-5 0h10M0-5v10M-4-4l8 8M4-4l-8 8"
                    : kind === "database" || kind === "replica"
                      ? "M-5-3c0-3 10-3 10 0v6c0 3-10 3-10 0Zm0 0c0 3 10 3 10 0m-10 3c0 3 10 3 10 0"
                      : kind === "cache"
                        ? "M1-5l-5 6h4l-1 4 5-6H0Z"
                        : "M-5 0h10M1-4l4 4-4 4"
                }
              />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
