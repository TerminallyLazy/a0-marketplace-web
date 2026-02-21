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
      {/* Hero section */}
      <section className="border-b border-border bg-panel/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4">
            Plugin Marketplace
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Discover and install plugins that extend Agent Zero with new tools,
            integrations, and capabilities.
          </p>
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined text-primary">
                extension
              </span>
              <span>
                <strong className="text-text">{plugins.length}</strong> plugins
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined text-warning">
                star
              </span>
              <span>
                <strong className="text-text">
                  {plugins.filter((p) => p.featured).length}
                </strong>{" "}
                featured
              </span>
            </div>
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
