import { importGraph, type Architecture } from "./model";
export interface Project {
  id: string;
  name: string;
  graph: Architecture;
}
export const key = "systemlab.projects.v1";
export function project(name: string, graph: Architecture): Project {
  return { id: crypto.randomUUID(), name, graph: structuredClone(graph) };
}
export function loadProjects(storage: Pick<Storage, "getItem">): Project[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 100)
    throw Error("Invalid saved project list.");
  const ids = new Set<string>();
  return data.map((p) => {
    if (
      typeof p?.id !== "string" ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 80 ||
      ids.has(p.id)
    )
      throw Error("Invalid saved project.");
    ids.add(p.id);
    return { id: p.id, name: p.name, graph: importGraph(p.graph) };
  });
}
export function saveProjects(
  storage: Pick<Storage, "setItem">,
  projects: Project[],
) {
  storage.setItem(key, JSON.stringify(projects));
}
export function parseArchitecture(text: string) {
  if (text.length > 1000000)
    throw Error("Architecture exceeds the import size limit.");
  return importGraph(JSON.parse(text));
}
export function serializeArchitecture(graph: Architecture) {
  return JSON.stringify(importGraph(graph), null, 2);
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
