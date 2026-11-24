import { useLayoutEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
} from "@xyflow/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { icons } from "./landing";
import { Rack } from "./infrastructure-art";
import { catalog, type Kind, type Architecture } from "./model";
import type { Simulator } from "./engine";

export type CanvasNode = Node<{
  kind: Kind;
  label: string;
  online: boolean;
  utilization: number;
}>;
export type CanvasEdge = Edge<{ pulse?: number; paused: boolean }>;
function ComponentNode({
  data,
  selected,
  isConnectable,
}: NodeProps<CanvasNode>) {
  const Icon = icons[data.kind];
  return (
    <div
      className={
        "component " +
        (selected ? "selected " : "") +
        (!data.online ? "offline" : "")
      }
    >
      {data.kind !== "client" && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
        />
      )}
      <span className={"component-icon kind-" + data.kind}>
        {data.kind === "server" || data.kind === "worker" ? (
          <svg viewBox="0 0 68 83" width="22" height="26" aria-hidden="true">
            <Rack />
          </svg>
        ) : (
          <Icon size={18} />
        )}
      </span>
      <span className="component-copy">
        <strong>{data.label}</strong>
        <small>
          <i />
          {data.online ? "Online" : "Offline"}
          {data.utilization > 0
            ? " · " + Math.round(data.utilization) + "%"
            : ""}
        </small>
      </span>
      {!["worker", "replica"].includes(data.kind) && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
        />
      )}
    </div>
  );
}
function PacketEdge(props: EdgeProps<CanvasEdge>) {
  const [path, x, y] = getBezierPath(props);
  const pulse = props.data?.pulse;
  const paused = props.data?.paused;
  const motion = useRef<SVGAnimateMotionElement>(null);
  useLayoutEffect(() => {
    motion.current?.beginElement();
  }, [pulse]);
  useLayoutEffect(() => {
    const svg = motion.current?.ownerSVGElement;
    if (paused) svg?.pauseAnimations();
    else svg?.unpauseAnimations();
  }, [pulse, paused]);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: props.selected
            ? "var(--brand)"
            : props.data?.pulse !== undefined
              ? "var(--edge-active)"
              : "var(--edge)",
          strokeWidth: props.selected ? 2.6 : 1.8,
        }}
      />
      {props.data?.pulse !== undefined && (
        <g className="edge-traffic" aria-hidden="true">
          <g className="edge-packet" key={pulse}>
            <animateMotion
              ref={motion}
              path={path}
              begin="indefinite"
              dur=".58s"
              fill="freeze"
            />
            <circle r="7" className="packet-halo" />
            <circle r="3" />
          </g>
          <circle className="static-packet" cx={x} cy={y} r="3" />
        </g>
      )}
    </>
  );
}
export const nodeTypes = { component: ComponentNode },
  edgeTypes = { packet: PacketEdge };
export type Sample = { time: number; rps: number; p95: number; depth: number };
export function Analytics({
  graph,
  sim,
  metrics,
  status,
  history,
}: {
  graph: Architecture;
  sim: Simulator | null;
  metrics: ReturnType<Simulator["metrics"]> | null;
  status: string;
  history: Sample[];
}) {
  const [tab, setTab] = useState<"metrics" | "events" | "components">(
    "metrics",
  );
  const [series, setSeries] = useState<"rps" | "p95" | "depth">("rps");
  const componentMetrics = new Map(metrics?.components.map((c) => [c.id, c]));
  return (
    <section className="analytics" aria-label="Simulation analytics">
      <div className="analytics-heading">
        <div aria-label="Analytics views">
          {(["metrics", "events", "components"] as const).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "events"
                ? "Event timeline"
                : t === "components"
                  ? "Components"
                  : "Live metrics"}
            </button>
          ))}
        </div>
        <span className="run-status">
          <i className={status === "running" ? "live-dot" : ""} />
          {status}
        </span>
      </div>
      {tab === "metrics" && (
        <div className="metrics-panel">
          <div className="metrics-grid">
            {[
              ["Requests / sec", metrics?.rps],
              ["Successful", metrics?.success],
              ["Failed", metrics?.failed],
              ["Average latency", metrics?.average.toFixed(1), " ms"],
              [
                "P50 / P95 / P99",
                metrics && [metrics.p50, metrics.p95, metrics.p99].join(" / "),
                " ms",
              ],
              ["Availability", metrics?.availability.toFixed(1), "%"],
              ["Error rate", metrics?.errorRate.toFixed(1), "%"],
              ["Cache hit rate", metrics?.cacheRate.toFixed(1), "%"],
              ["Queue depth", metrics?.depth],
            ].map(([label, value, suffix]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>
                  {value == null ? "—" : String(value) + (suffix ?? "")}
                </strong>
              </div>
            ))}
          </div>
          <div className="chart">
            <label>
              Trend{" "}
              <select
                aria-label="Trend metric"
                value={series}
                onChange={(e) => setSeries(e.target.value as typeof series)}
              >
                <option value="rps">Requests / sec</option>
                <option value="p95">P95 latency (ms)</option>
                <option value="depth">Queue depth</option>
              </select>
            </label>
            {history.length ? (
              <div className="chart-body">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={1}
                  minHeight={1}
                >
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient
                        id="trend-fill"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--brand)"
                          stopOpacity={0.36}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--brand)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickCount={5}
                      tick={{ fontSize: 10, fill: "var(--subtle)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(n) => Number(n).toFixed(1) + "s"}
                    />
                    <YAxis
                      width={34}
                      tick={{ fontSize: 10, fill: "var(--subtle)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        Number(value).toFixed(2) + " s"
                      }
                      contentStyle={{
                        background: "var(--panel)",
                        borderColor: "var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <Area
                      dataKey={series}
                      stroke="var(--brand)"
                      strokeWidth={2}
                      fill="url(#trend-fill)"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="quiet">Run the simulation to see a trend.</p>
            )}
          </div>
        </div>
      )}
      {tab === "events" && (
        <div className="event-list">
          {sim?.logs.length ? (
            [...sim.logs].reverse().map((log) => (
              <div key={log.id}>
                <time>{(log.time / 1000).toFixed(3)} s</time>
                <span className={log.level === "error" ? "error-text" : ""}>
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <p className="quiet">No events recorded yet.</p>
          )}
        </div>
      )}
      {tab === "components" && (
        <div className="event-list">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Arrivals</th>
                <th>Utilization</th>
                <th>Queued</th>
                <th>Latest write</th>
              </tr>
            </thead>
            <tbody>
              {graph.nodes.map((n, i) => {
                const m = componentMetrics.get(n.id);
                return (
                  <tr key={n.id}>
                    <td>
                      {catalog[n.kind][0]} {i + 1}
                    </td>
                    <td>{m?.online === false ? "Offline" : "Online"}</td>
                    <td>{m?.received ?? 0}</td>
                    <td>{Math.round(m?.utilization ?? 0)}%</td>
                    <td>{m?.depth ?? 0}</td>
                    <td>{m?.latestWrite || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
