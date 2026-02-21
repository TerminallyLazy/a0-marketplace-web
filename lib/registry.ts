const REGISTRY_URL =
  "https://raw.githubusercontent.com/TerminallyLazy/a0-marketplace/main/registry.json";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  repo_url: string;
  plugin_path: string;
  version: string;
  featured?: boolean;
  tags?: string[];
  icon?: string;
  min_agent_zero_version?: string;
}

export interface Registry {
  version: number;
  plugins: Plugin[];
}

export async function fetchRegistry(): Promise<Registry> {
  const res = await fetch(REGISTRY_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch registry");
  return res.json();
}
