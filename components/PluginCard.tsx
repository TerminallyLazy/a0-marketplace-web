"use client";

import { useState } from "react";
import type { Plugin } from "@/lib/registry";

export default function PluginCard({ plugin }: { plugin: Plugin }) {
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div className="group relative rounded-lg border border-border/60 bg-darker p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      {/* Featured badge */}
      {plugin.featured && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning border border-warning/30">
          <span className="material-symbols-outlined text-sm">star</span>
          Featured
        </div>
      )}

      {/* Icon + Header */}
      <div className="flex items-start gap-4 mb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <span className="material-symbols-outlined text-xl">
            {plugin.icon || "extension"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-bright truncate">
            {plugin.name}
          </h3>
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
              className="rounded-md bg-dark px-2 py-0.5 text-xs text-text-muted border border-border/40"
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
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Install
        </button>
        <a
          href={plugin.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-bright border border-border/50 hover:border-border transition-colors"
        >
          <span className="material-symbols-outlined text-sm">code</span>
          Source
        </a>
      </div>

      {/* Install tooltip */}
      {showInstall && (
        <div className="mt-3 rounded-md bg-dark border border-border/50 p-3 text-sm">
          <p className="text-text-muted mb-2">
            Search for{" "}
            <span className="font-mono text-primary">{plugin.name}</span> in
            Agent Zero&apos;s built-in Marketplace, or install via CLI:
          </p>
          <code className="block rounded bg-darker px-3 py-2 text-xs text-text font-mono border border-border/30">
            a0 plugin install {plugin.id}
          </code>
        </div>
      )}
    </div>
  );
}
