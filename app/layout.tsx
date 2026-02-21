import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Zero Plugin Marketplace",
  description:
    "Browse, discover, and install plugins for Agent Zero — the open-source AI agent framework.",
  keywords: [
    "agent zero",
    "plugins",
    "marketplace",
    "AI agent",
    "open source",
  ],
  openGraph: {
    title: "Agent Zero Plugin Marketplace",
    description:
      "Browse, discover, and install plugins for Agent Zero.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        {/* Header */}
        <header className="border-b border-border bg-panel">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <a href="/" className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl">
                  smart_toy
                </span>
                <span className="text-xl font-semibold text-text">
                  Agent Zero Marketplace
                </span>
              </a>
              <nav className="flex items-center gap-6">
                <a
                  href="/"
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Browse
                </a>
                <a
                  href="/submit"
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Submit Plugin
                </a>
                <a
                  href="https://agent-zero.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-accent transition-colors"
                >
                  agent-zero.ai
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-border bg-panel mt-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-text-muted">
                Agent Zero Plugin Marketplace
              </p>
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/TerminallyLazy/a0-marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://agent-zero.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Agent Zero
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
