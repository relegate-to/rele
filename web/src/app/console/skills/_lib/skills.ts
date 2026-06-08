// Types, API helper, and filter logic for the skills page.

export const INSTANCE_PROXY = "/api/instance";

export type SkillStatus = "ready" | "missing-deps" | "needs-config" | "disabled";
export type FilterTab = "all" | "ready" | "needs-setup";

export interface InstallEntry {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  enabled: boolean;
  status: SkillStatus;
  missingBins: string[];
  missingAnyBins: string[];
  missingEnv: string[];
  missingConfig: string[];
  pluginConfig: Record<string, unknown> | null;
  installEntries: InstallEntry[];
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${INSTANCE_PROXY}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs-setup", label: "Setup" },
];

export function hasAllDeps(s: Skill) {
  return (
    s.missingBins.length === 0 &&
    (s.missingAnyBins ?? []).length === 0 &&
    s.missingEnv.length === 0 &&
    s.missingConfig.length === 0
  );
}

export function isCompatible(s: Skill): boolean {
  return s.status !== "disabled";
}

export function isReady(s: Skill): boolean {
  return isCompatible(s) && s.status !== "missing-deps" && s.status !== "needs-config";
}

export function needsSetup(s: Skill): boolean {
  return isCompatible(s) && (s.status === "missing-deps" || s.status === "needs-config");
}

export function filterSkills(skills: Skill[], filter: FilterTab): Skill[] {
  const compatible = skills.filter(isCompatible);
  switch (filter) {
    case "ready":
      return compatible.filter(isReady);
    case "needs-setup":
      return compatible.filter(needsSetup);
    default:
      return compatible;
  }
}
