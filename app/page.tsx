import { fetchRegistry } from "@/lib/registry";
import FilterTabs from "@/components/FilterTabs";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export default async function BrowsePage() {
  let registry;
  try {
    registry = await fetchRegistry();
  } catch {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-danger mb-4">
          error
        </span>
        <h1 className="text-2xl font-bold text-text mb-2">
          Unable to Load Plugins
        </h1>
        <p className="text-text-muted">
          The plugin registry is temporarily unavailable. Please try again
          later.
        </p>
      </div>
    );
  }

  const plugins = registry.plugins;

  return (
    <div>
      {/* Hero section — matching agent-zero.ai hero style */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background like agent-zero.ai */}
        <div className="absolute inset-0 bg-gradient-to-b from-darker via-dark to-dark" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(13,110,253,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          {/* Section badge — agent-zero.ai uses these blue pill badges */}
          <div className="flex justify-center mb-6">
            <span className="badge-pill bg-primary/15 text-primary border border-primary/30">
              <span className="material-symbols-outlined text-sm">store</span>
              Plugin Marketplace
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-bright mb-6 leading-tight">
            Extend Agent Zero with{" "}
            <span className="text-primary">community plugins</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Discover and install plugins that add new tools, integrations,
            and capabilities to your AI agent framework.
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined text-primary text-lg">
                extension
              </span>
              <span>
                <strong className="text-text-bright">{plugins.length}</strong>{" "}
                plugins
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined text-warning text-lg">
                star
              </span>
              <span>
                <strong className="text-text-bright">
                  {plugins.filter((p) => p.featured).length}
                </strong>{" "}
                featured
              </span>
            </div>
            <a
              href="/submit"
              className="flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                add_circle
              </span>
              Submit yours
            </a>
          </div>
        </div>
      </section>

      {/* Plugin browser */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <FilterTabs plugins={plugins} />
      </section>
    </div>
  );
}
