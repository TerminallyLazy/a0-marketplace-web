"use client";

import { useState, useMemo } from "react";
import type { Plugin } from "@/lib/registry";
import PluginCard from "./PluginCard";

type Tab = "all" | "featured";

export default function FilterTabs({ plugins }: { plugins: Plugin[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = plugins;

    if (activeTab === "featured") {
      result = result.filter((p) => p.featured);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    return result;
  }, [plugins, activeTab, search]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Plugins", count: plugins.length },
    {
      key: "featured",
      label: "Featured",
      count: plugins.filter((p) => p.featured).length,
    },
  ];

  return (
    <div>
      {/* Search + Tabs bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-panel border border-border p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-dark text-text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Plugin grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">
            search_off
          </span>
          <p className="text-lg text-text-muted">No plugins found</p>
          <p className="text-sm text-text-muted mt-1">
            Try adjusting your search or filter.
          </p>
        </div>
      )}
    </div>
  );
}
