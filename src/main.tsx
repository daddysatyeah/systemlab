import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Docs, Header, Landing } from "./landing";
import { scenarios } from "./scenarios";
import { blank, type Architecture } from "./model";
import { loadProjects, project, saveProjects } from "./projects";

const Studio = lazy(() =>
  import("./studio").then((module) => ({ default: module.Studio })),
);

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="wrap docs">
        <h1>SystemLab hit an error.</h1>
        <p>Reload to recover your last saved project.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload SystemLab
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function initialize() {
  try {
    const saved = loadProjects(window.localStorage);
    const active = window.localStorage.getItem("systemlab.active");
    return {
      projects: saved.length
        ? saved
        : [project(scenarios[2].name, scenarios[2].graph)],
      active,
      error: "",
    };
  } catch {
    return {
      projects: [project(scenarios[2].name, scenarios[2].graph)],
      active: null,
      error:
        "Saved workspace could not be restored. Export your work as JSON before closing this tab.",
    };
  }
}
function App() {
  const [initial] = useState(initialize);
  const [projects, setProjects] = useState(initial.projects);
  const [activeId, setActive] = useState(
    initial.projects.find((p) => p.id === initial.active)?.id ??
      initial.projects[0].id,
  );
  const [route, setRoute] = useState(location.hash.slice(1) || "home");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("systemlab.theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(initial.error);
  const notice = useCallback((s: string) => setMessage(s), []);
  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "home");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (route === "scenarios" || route === "capabilities")
      requestAnimationFrame(() =>
        document.getElementById(route)?.scrollIntoView(),
      );
    else window.scrollTo(0, 0);
  }, [route]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("systemlab.theme", theme);
    } catch {
      /* The active theme still works in memory. */
    }
  }, [theme]);
  useEffect(() => {
    if (initial.error) return;
    try {
      saveProjects(localStorage, projects);
      localStorage.setItem("systemlab.active", activeId);
      setStorageError("");
    } catch {
      setStorageError(
        "Automatic saving failed. Export the current project to keep your changes.",
      );
    }
  }, [projects, activeId, initial.error]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  const active = projects.find((p) => p.id === activeId) ?? projects[0];
  function create(name: string, graph: Architecture) {
    if (projects.length >= 100) {
      notice("The browser workspace supports up to 100 projects.");
      return;
    }
    const next = project(name, graph);
    setProjects((previous) => [...previous, next]);
    setActive(next.id);
    location.hash = "studio";
  }
  function remove() {
    if (!window.confirm("Delete " + active.name + "? This cannot be undone."))
      return;
    const remaining = projects.filter((p) => p.id !== active.id);
    if (!remaining.length) remaining.push(project("Untitled project", blank()));
    setProjects(remaining);
    setActive(remaining[0].id);
  }
  return (
    <>
      <Header
        theme={theme}
        toggle={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      {storageError && (
        <div className="storage-warning" role="alert">
          {storageError}
        </div>
      )}
      {route === "studio" ? (
        <Suspense
          fallback={
            <main className="wrap docs" role="status">
              Loading Studio…
            </main>
          }
        >
          <Studio
            key={active.id}
            projects={projects}
            active={active}
            update={(p) =>
              setProjects((previous) =>
                previous.map((item) => (item.id === p.id ? p : item)),
              )
            }
            select={setActive}
            create={create}
            remove={remove}
            notice={notice}
          />
        </Suspense>
      ) : route === "docs" ? (
        <Docs />
      ) : (
        <Landing
          launch={(i) => create(scenarios[i].name, scenarios[i].graph)}
        />
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
