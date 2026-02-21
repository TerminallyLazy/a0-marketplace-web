"use client";

import { useState } from "react";
import type { Plugin } from "@/lib/registry";

export default function PluginCard({ plugin }: { plugin: Plugin }) {
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div className="group relative rounded-xl border border-border bg-panel p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      {/* Featured badge */}
      {plugin.featured && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning border border-warning/30">
          <span className="material-symbols-outlined text-sm">star</span>
          Featured
        </div>
      )}

      {/* Icon + Header */}
      <div className="flex items-start gap-4 mb-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-2xl">
            {plugin.icon || "extension"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text truncate">{plugin.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-muted">v{plugin.version}</span>
            <span className="text-border">&#183;</span>
            <span className="text-xs text-text-muted">{plugin.author}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-muted line-clamp-2 mb-4 leading-relaxed">
        {plugin.description}
      </p>

      {/* Tags */}
      {plugin.tags && plugin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {plugin.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-dark px-2 py-0.5 text-xs text-text-muted border border-border/50"
            >
              {tag}
            </span>
          ))}
          {plugin.tags.length > 3 && (
            <span className="text-xs text-text-muted">
              +{plugin.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowInstall(!showInstall)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          How to Install
        </button>
        <a
          href={plugin.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-dark px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border/50 hover:border-border transition-colors"
        >
          <span className="material-symbols-outlined text-sm">code</span>
          Source
        </a>
      </div>

      {/* Install tooltip */}
      {showInstall && (
        <div className="mt-3 rounded-lg bg-dark border border-border p-3 text-sm">
          <p className="text-text-muted mb-1.5">
            Search for{" "}
            <span className="font-mono text-accent">{plugin.name}</span> in
            Agent Zero&apos;s built-in Marketplace tab, or install via CLI:
          </p>
          <code className="block rounded bg-panel px-3 py-2 text-xs text-text font-mono">
            a0 plugin install {plugin.id}
          </code>
        </div>
      )}
    </div>
  );
}
