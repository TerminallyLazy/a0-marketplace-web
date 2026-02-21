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
        {/* Header — matches agent-zero.ai navbar style */}
        <header className="bg-darker border-b border-border/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo */}
              <a href="/" className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.agent-zero.ai/res/a0-fullDark.svg"
                  alt="Agent Zero"
                  className="h-8"
                />
                <span className="text-sm font-medium text-text-muted hidden sm:inline">
                  Marketplace
                </span>
              </a>

              {/* Navigation */}
              <nav className="flex items-center gap-6">
                <a
                  href="/"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  Browse
                </a>
                <a
                  href="/submit"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  Submit Plugin
                </a>
                <a
                  href="https://github.com/agent0ai/agent-zero"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors hidden sm:inline"
                >
                  GitHub
                </a>
                <a
                  href="https://agent-zero.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline !py-1.5 !px-4 !text-xs"
                >
                  agent-zero.ai
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer — matches agent-zero.ai footer style */}
        <footer className="bg-darker border-t border-border/50 mt-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Logo + copyright */}
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.agent-zero.ai/res/a0-fullDark.svg"
                  alt="Agent Zero"
                  className="h-6 opacity-60"
                />
                <span className="text-sm text-text-muted">
                  Plugin Marketplace
                </span>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/agent0ai/agent-zero"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://discord.gg/agent-zero"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  Discord
                </a>
                <a
                  href="https://agent-zero.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  Website
                </a>
                <a
                  href="https://agent-zero.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-muted hover:text-text-bright transition-colors"
                >
                  Docs
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
