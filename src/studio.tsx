import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowDownToLine,
  ChevronDown,
  Copy,
  FileUp,
  FolderPlus,
  Image,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { icons } from "./landing";
import {
  blank,
  block,
  catalog,
  fields,
  validate,
  connectionError,
  type Architecture,
  type Kind,
} from "./model";
import { Simulator } from "./engine";
import { scenarios } from "./scenarios";
import {
  download,
  parseArchitecture,
  serializeArchitecture,
  type Project,
} from "./projects";
import {
  Analytics,
  nodeTypes,
  edgeTypes,
  type CanvasEdge,
  type CanvasNode,
  type Sample,
} from "./panels";
import { exportImage } from "./image-export";

type Props = {
  projects: Project[];
  active: Project;
  update: (p: Project) => void;
  select: (id: string) => void;
  create: (name: string, graph: Architecture) => void;
  remove: () => void;
  notice: (s: string) => void;
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected error.";
const edgeId = (source: string, target: string) => source + "::" + target;
const uid = () => "n-" + crypto.randomUUID();
function updateSelection(
  previous: string[],
  changes: { id: string; selected: boolean }[],
) {
  const ids = new Set(previous);
  for (const change of changes) {
    if (change.selected) ids.add(change.id);
    else ids.delete(change.id);
  }
  return [...ids];
}
export function Studio(props: Props) {
  return (
    <ReactFlowProvider>
      <Workbench {...props} />
    </ReactFlowProvider>
  );
}
function Workbench({
  projects,
  active,
  update,
  select,
  create,
  remove,
  notice,
}: Props) {
  const graph = active.graph;
  const initialFit = useRef(graph.nodes.length > 0);
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const past = useRef<Architecture[]>([]),
    future = useRef<Architecture[]>([]);
  const engine = useRef<Simulator | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [moving, setMoving] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [metrics, setMetrics] = useState<ReturnType<
    Simulator["metrics"]
  > | null>(null);
  const [status, setStatus] = useState<Simulator["result"]>("ready");
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [history, setHistory] = useState<Sample[]>([]);
  const [menu, setMenu] = useState(false);
  const [issue, setIssue] = useState("");
  const [name, setName] = useState(active.name);
  const lastSample = useRef(-250);
  const editing = status === "ready" || status === "stopped";
  const report = useCallback(
    (message: string) => {
      setIssue(message);
      notice(message);
    },
    [notice],
  );
  const clearEngine = () => {
    engine.current = null;
    lastSample.current = -250;
    setStatus("ready");
    setTime(0);
    setMetrics(null);
    setHistory([]);
    setIssue("");
  };
  function refresh() {
    const sim = engine.current;
    if (!sim) return;
    const next = sim.metrics();
    setMetrics(next);
    setTime(sim.time);
    setStatus(sim.result);
    if (sim.time - lastSample.current >= 250) {
      lastSample.current = sim.time;
      setHistory((previous) => [
        ...previous.slice(-119),
        {
          time: sim.time / 1000,
          rps: next.rps,
          p95: next.p95,
          depth: next.depth,
        },
      ]);
    }
  }
  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => {
      const sim = engine.current;
      if (sim?.result === "running") {
        sim.advance(50 * speed);
        refresh();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [status, speed]);
  function change(next: Architecture) {
    if (!editing) {
      report("Stop or reset the simulation before editing.");
      return false;
    }
    if (next.nodes.length > 80 || next.edges.length > 240) {
      report("The workspace supports up to 80 components and 240 connections.");
      return false;
    }
    const errors = validate(next, false);
    if (errors.length) {
      report(errors[0]);
      return false;
    }
    past.current = [...past.current.slice(-49), graph];
    future.current = [];
    update({ ...active, graph: next });
    clearEngine();
    return true;
  }
  function restore(direction: "undo" | "redo") {
    if (!editing) return;
    const from = direction === "undo" ? past : future,
      to = direction === "undo" ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(graph);
    update({ ...active, graph: next });
    setSelected([]);
    setSelectedEdges([]);
    clearEngine();
  }
  function add(kind: Kind, position?: { x: number; y: number }) {
    const p =
      position ??
      flow.screenToFlowPosition({
        x: window.innerWidth / 2 + (graph.nodes.length % 3) * 25,
        y: 240 + (graph.nodes.length % 4) * 28,
      });
    const node = block(kind, uid(), p.x, p.y);
    if (change({ ...graph, nodes: [...graph.nodes, node] }))
      setSelected([node.id]);
  }
  function connect(connection: Connection) {
    if (editing)
      change({
        ...graph,
        edges: [
          ...graph.edges,
          { source: connection.source, target: connection.target },
        ],
      });
  }
  function erase() {
    change({
      ...graph,
      nodes: graph.nodes.filter((n) => !selected.includes(n.id)),
      edges: graph.edges.filter(
        (e) =>
          !selected.includes(e.source) &&
          !selected.includes(e.target) &&
          !selectedEdges.includes(edgeId(e.source, e.target)),
      ),
    });
    setSelected([]);
    setSelectedEdges([]);
  }
  function duplicate() {
    const originals = graph.nodes.filter((n) => selected.includes(n.id));
    const replacements = new Map(
      originals.map((n) => [
        n.id,
        { ...n, id: uid(), x: n.x + 28, y: n.y + 28 },
      ]),
    );
    const edges = graph.edges
      .filter((e) => replacements.has(e.source) && replacements.has(e.target))
      .map((e) => ({
        source: replacements.get(e.source)!.id,
        target: replacements.get(e.target)!.id,
      }));
    if (
      change({
        ...graph,
        nodes: [...graph.nodes, ...replacements.values()],
        edges: [...graph.edges, ...edges],
      })
    )
      setSelected([...replacements.values()].map((n) => n.id));
  }
  function launch(step = false) {
    try {
      if (!engine.current || status === "stopped") {
        clearEngine();
        engine.current = new Simulator(graph);
      }
      if (step) engine.current.step();
      else engine.current.start();
      refresh();
    } catch (error) {
      report(errorText(error));
    }
  }
  const component = graph.nodes.find((n) => n.id === selected[0]);
  const componentMetrics = useMemo(
    () => new Map(metrics?.components.map((c) => [c.id, c])),
    [metrics],
  );
  const nodes: CanvasNode[] = graph.nodes.map((n) => {
    const live = componentMetrics.get(n.id);
    return {
      id: n.id,
      type: "component",
      position: moving[n.id] ?? { x: n.x, y: n.y },
      measured: measurements[n.id],
      selected: selected.includes(n.id),
      data: {
        kind: n.kind,
        label: catalog[n.kind][0],
        online: live?.online ?? true,
        utilization: live?.utilization ?? 0,
      },
    };
  });
  const pulses = new Map<string, number>();
  if (status === "running" || status === "paused") {
    const interval = 650 * speed;
    const windowStart = (Math.floor(time / interval) - 1) * interval;
    for (const packet of engine.current?.packets ?? []) {
      if (packet.at >= windowStart) {
        pulses.set(
          edgeId(packet.source, packet.target),
          Math.floor(packet.at / interval),
        );
      }
    }
  }
  const edges: CanvasEdge[] = graph.edges.map((e) => ({
    id: edgeId(e.source, e.target),
    ...e,
    type: "packet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "var(--edge)",
      width: 14,
      height: 14,
    },
    selected: selectedEdges.includes(edgeId(e.source, e.target)),
    data: {
      pulse: pulses.get(edgeId(e.source, e.target)),
      paused: status !== "running",
    },
  }));
  const problems = useMemo(() => validate(graph), [graph]);
  const scenario = scenarios.find((s) => s.name === active.name);
  const safeName = active.name.replace(/[^\w-]+/g, "-") || "architecture";
  return (
    <main
      className="studio"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,select,button,textarea"))
          return;
        if (
          editing &&
          (e.key === "Delete" || e.key === "Backspace") &&
          (selected.length || selectedEdges.length)
        ) {
          e.preventDefault();
          erase();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          restore(e.shiftKey ? "redo" : "undo");
        }
      }}
    >
      <div className="studio-bar">
        <div className="project-tools">
          <select
            aria-label="Project"
            value={active.id}
            onChange={(e) => select(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="menu-anchor">
            <button
              className="icon-button"
              aria-label="Project actions"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <ChevronDown size={17} />
            </button>
            {menu && (
              <div className="project-menu">
                <button
                  onClick={() => {
                    setMenu(false);
                    create("Untitled project", blank());
                  }}
                >
                  <FolderPlus size={15} /> New project
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    document.getElementById("project-name")?.focus();
                  }}
                >
                  Rename project
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    create(active.name.slice(0, 73) + " copy", graph);
                  }}
                >
                  <Copy size={15} /> Duplicate project
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    remove();
                  }}
                >
                  <Trash2 size={15} /> Delete project
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    input.current?.click();
                  }}
                >
                  <FileUp size={15} /> Import JSON
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    try {
                      download(
                        serializeArchitecture(graph),
                        safeName + ".json",
                        "application/json",
                      );
                    } catch (error) {
                      report(errorText(error));
                    }
                  }}
                >
                  <ArrowDownToLine size={15} /> Export JSON
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    try {
                      download(
                        exportImage(graph),
                        safeName + ".svg",
                        "image/svg+xml",
                      );
                    } catch (error) {
                      report(errorText(error));
                    }
                  }}
                >
                  <Image size={15} /> Export image
                </button>
                <button
                  disabled={!editing}
                  onClick={() => {
                    setMenu(false);
                    if (
                      window.confirm("Clear this workspace?") &&
                      change(blank())
                    ) {
                      setSelected([]);
                      setSelectedEdges([]);
                    }
                  }}
                >
                  <RotateCcw size={15} /> Clear workspace
                </button>
              </div>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              try {
                if (file.size > 1000000)
                  throw Error("Architecture exceeds the import size limit.");
                create(
                  file.name
                    .replace(/\.json$/i, "")
                    .slice(0, 80)
                    .trim() || "Imported project",
                  parseArchitecture(await file.text()),
                );
              } catch (error) {
                report(errorText(error));
              }
            }}
          />
        </div>
        <div className="simulation-tools">
          {status === "running" ? (
            <button
              className="button small primary"
              onClick={() => {
                engine.current?.pause();
                refresh();
              }}
            >
              <Pause size={15} /> Pause
            </button>
          ) : (
            <button className="button small primary" onClick={() => launch()}>
              <Play size={15} /> {status === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Step simulation"
            title="Step 100 ms"
            disabled={status === "running" || status === "stopped"}
            onClick={() => launch(true)}
          >
            <SkipForward size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Stop simulation"
            title="Stop"
            disabled={editing}
            onClick={() => {
              engine.current?.stop();
              refresh();
            }}
          >
            <Square size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset simulation"
            title="Reset simulation"
            onClick={clearEngine}
          >
            <RotateCcw size={16} />
          </button>
          <select
            aria-label="Simulation speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[0.25, 0.5, 1, 2, 4, 8].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
          <span className="sim-time">{(time / 1000).toFixed(2)} s</span>
        </div>
        <select
          aria-label="Load scenario"
          value=""
          onChange={(e) => {
            const s = scenarios[Number(e.target.value)];
            if (s) create(s.name, s.graph);
          }}
        >
          <option value="" disabled>
            Load scenario…
          </option>
          {scenarios.map((s, i) => (
            <option key={s.name} value={i}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="studio-body">
        <aside className="library">
          <h2>Components</h2>
          <p>Drag or click to add</p>
          {Object.entries(catalog).map(([key, [label]]) => {
            const kind = key as Kind,
              Icon = icons[kind];
            return (
              <button
                draggable={editing}
                disabled={!editing}
                key={kind}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/systemlab", kind);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => add(kind)}
              >
                <Icon size={17} />
                <span>{label}</span>
                <Plus size={13} />
              </button>
            );
          })}
        </aside>
        <section
          className="canvas"
          aria-label="Architecture editor"
          tabIndex={0}
        >
          <div className="canvas-meta" aria-hidden="true">
            <Activity size={13} /> Topology
            <span>
              {graph.nodes.length} nodes · {graph.edges.length} links
            </span>
          </div>
          <div className="canvas-tools">
            <button
              className="icon-button"
              title="Undo"
              aria-label="Undo"
              disabled={!editing || !past.current.length}
              onClick={() => restore("undo")}
            >
              <Undo2 size={16} />
            </button>
            <button
              className="icon-button"
              title="Redo"
              aria-label="Redo"
              disabled={!editing || !future.current.length}
              onClick={() => restore("redo")}
            >
              <Redo2 size={16} />
            </button>
            <button
              className="icon-button"
              title="Duplicate selection"
              aria-label="Duplicate selection"
              disabled={!editing || !selected.length}
              onClick={duplicate}
            >
              <Copy size={15} />
            </button>
            <button
              className="icon-button"
              title="Delete selection"
              aria-label="Delete selection"
              disabled={!editing || !(selected.length || selectedEdges.length)}
              onClick={erase}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView={initialFit.current}
            fitViewOptions={{ padding: 0.23 }}
            nodesDraggable={editing}
            nodesConnectable={editing}
            deleteKeyCode={null}
            onConnect={connect}
            onNodesChange={(changes) => {
              const dimensions = changes.flatMap((change) =>
                change.type === "dimensions" && change.dimensions
                  ? [[change.id, change.dimensions] as const]
                  : [],
              );
              // Controlled nodes must carry React Flow's measurements on subsequent updates.
              if (dimensions.length) {
                const liveIds = new Set(graph.nodes.map((node) => node.id));
                setMeasurements((previous) =>
                  Object.fromEntries(
                    [...Object.entries(previous), ...dimensions].filter(
                      ([id]) => liveIds.has(id),
                    ),
                  ),
                );
              }
              const selection = changes.filter(
                (change) => change.type === "select",
              );
              if (selection.length) {
                setSelected((previous) => updateSelection(previous, selection));
              }
              const positions = new Map<string, { x: number; y: number }>();
              let dragging = false;
              for (const c of changes) {
                if (c.type === "position" && c.position) {
                  positions.set(c.id, c.position);
                  dragging = dragging || Boolean(c.dragging);
                }
              }
              if (!editing || !positions.size) return;
              if (dragging) {
                setMoving((previous) => ({
                  ...previous,
                  ...Object.fromEntries(positions),
                }));
                return;
              }
              const nodes = graph.nodes.map((n) =>
                positions.has(n.id) ? { ...n, ...positions.get(n.id)! } : n,
              );
              if (
                nodes.some(
                  (n, i) =>
                    n.x !== graph.nodes[i].x || n.y !== graph.nodes[i].y,
                )
              )
                change({ ...graph, nodes });
              setMoving({});
            }}
            onEdgesChange={(changes) => {
              const selection = changes.filter(
                (change) => change.type === "select",
              );
              if (selection.length) {
                setSelectedEdges((previous) =>
                  updateSelection(previous, selection),
                );
              }
            }}
            onDragOver={(e) => {
              if (editing) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const kind = e.dataTransfer.getData("application/systemlab");
              if (editing && Object.hasOwn(catalog, kind))
                add(
                  kind as Kind,
                  flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                );
            }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.15}
            maxZoom={2.5}
          >
            <Background gap={19} size={1} color="var(--grid)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {!graph.nodes.length && (
            <div className="canvas-empty">
              <Activity size={26} />
              <strong>Build your architecture</strong>
              <span>Add a component or load a scenario.</span>
            </div>
          )}
        </section>
        <aside className="inspector">
          <h2>Inspector</h2>
          <label>
            Project name
            <input
              id="project-name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const next = name.trim() || active.name;
                setName(next);
                if (next !== active.name) update({ ...active, name: next });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
          <ConfigInput
            key={graph.seed}
            label="Simulation seed"
            field="seed"
            min={0}
            max={4294967295}
            value={graph.seed}
            disabled={!editing}
            report={report}
            commit={(value) => change({ ...graph, seed: value })}
          />
          {component ? (
            <>
              <hr />
              <h3>{catalog[component.kind][0]}</h3>
              <p>{catalog[component.kind][1]}</p>
              {editing && (
                <label>
                  Connect to
                  <select
                    aria-label="Connect to"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        change({
                          ...graph,
                          edges: [
                            ...graph.edges,
                            { source: component.id, target: e.target.value },
                          ],
                        });
                    }}
                  >
                    <option value="" disabled>
                      Choose a destination
                    </option>
                    {graph.nodes
                      .filter(
                        (node) =>
                          !connectionError(component, node) &&
                          !graph.edges.some(
                            (edge) =>
                              edge.source === component.id &&
                              edge.target === node.id,
                          ),
                      )
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {catalog[node.kind][0]}{" "}
                          {graph.nodes.indexOf(node) + 1}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {Object.entries(fields[component.kind]).map(
                ([key, [label, min, max]]) => (
                  <ConfigInput
                    key={component.id + key + component.config[key]}
                    label={label}
                    field={key}
                    min={min}
                    max={max}
                    value={component.config[key]}
                    disabled={!editing}
                    report={report}
                    commit={(value) =>
                      change({
                        ...graph,
                        nodes: graph.nodes.map((n) =>
                          n.id === component.id
                            ? { ...n, config: { ...n.config, [key]: value } }
                            : n,
                        ),
                      })
                    }
                  />
                ),
              )}
            </>
          ) : scenario ? (
            <>
              <hr />
              <h3>{scenario.name}</h3>
              <p>{scenario.description}</p>
              <p>{scenario.expected}</p>
            </>
          ) : (
            <p>Select a component to see its configuration.</p>
          )}
          {(issue || problems.length > 0) && (
            <p className="validation" role="status">
              {issue || problems[0]}
            </p>
          )}
        </aside>
      </div>
      <Analytics
        graph={graph}
        sim={engine.current}
        metrics={metrics}
        status={status}
        history={history}
      />
    </main>
  );
}
function ConfigInput({
  label,
  field,
  min,
  max,
  value,
  disabled,
  report,
  commit,
}: {
  label: string;
  field: string;
  min: number;
  max: number;
  value: number;
  disabled: boolean;
  report: (s: string) => void;
  commit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <label>
      {label}
      {field === "algorithm" ? (
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(e) => commit(Number(e.target.value))}
        >
          <option value="0">Round robin</option>
          <option value="1">Least connections</option>
        </select>
      ) : (
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = Number(draft);
            if (!draft || !Number.isInteger(next) || next < min || next > max) {
              setDraft(String(value));
              report(label + " must be between " + min + " and " + max + ".");
            } else if (next !== value) {
              setDraft(String(value));
              commit(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      )}
    </label>
  );
}
