import { NextRequest, NextResponse } from "next/server";

const REGISTRY_REPO = "TerminallyLazy/a0-marketplace";
const REGISTRY_FILE = "registry.json";

export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Plugin submissions are currently being set up. Please try again later or submit a PR directly.",
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { name, id, description, author, repo_url, plugin_path, tags, icon } =
    body;

  // Validate required fields
  if (!name || !id || !description || !author || !repo_url) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields." },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Get current registry.json (main branch)
    const fileRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/contents/${REGISTRY_FILE}`,
      { headers }
    );
    if (!fileRes.ok) throw new Error("Failed to read registry");
    const fileData = await fileRes.json();
    const currentContent = JSON.parse(
      Buffer.from(fileData.content, "base64").toString()
    );

    // Check for duplicate ID
    if (
      currentContent.plugins.some(
        (p: { id: string }) => p.id === id
      )
    ) {
      return NextResponse.json(
        { ok: false, error: `Plugin ID '${id}' already exists.` },
        { status: 409 }
      );
    }

    // 2. Get main branch SHA
    const mainRef = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/git/ref/heads/main`,
      { headers }
    );
    if (!mainRef.ok) throw new Error("Failed to get main branch ref");
    const mainData = await mainRef.json();
    const baseSha = mainData.object.sha;

    // 3. Create branch
    const branchName = `plugin/${id}`;
    const branchRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/git/refs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    );
    if (!branchRes.ok) {
      const branchErr = await branchRes.json();
      throw new Error(branchErr.message || "Failed to create branch");
    }

    // 4. Add plugin to registry
    const tagList = tags
      ? tags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];

    const newPlugin = {
      id,
      name,
      description,
      author,
      repo_url,
      plugin_path: plugin_path || ".",
      version: "1.0.0",
      featured: false,
      tags: tagList,
      icon: icon || "extension",
    };
    currentContent.plugins.push(newPlugin);

    const updatedContent = Buffer.from(
      JSON.stringify(currentContent, null, 2) + "\n"
    ).toString("base64");

    const updateRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/contents/${REGISTRY_FILE}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add plugin: ${name}`,
          content: updatedContent,
          sha: fileData.sha,
          branch: branchName,
        }),
      }
    );
    if (!updateRes.ok) throw new Error("Failed to update registry file");

    // 5. Create PR
    const prBody = [
      "## Plugin Submission",
      "",
      `**Plugin Name:** ${name}`,
      `**Plugin ID:** ${id}`,
      `**Repository URL:** ${repo_url}`,
      `**Plugin Path in Repo:** ${plugin_path || "."}`,
      "",
      "### Description",
      "",
      description,
      "",
      "### Tags",
      "",
      tagList.join(", ") || "None",
    ].join("\n");

    const prRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/pulls`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Add plugin: ${name}`,
          body: prBody,
          head: branchName,
          base: "main",
        }),
      }
    );
    if (!prRes.ok) throw new Error("Failed to create pull request");
    const prData = await prRes.json();

    return NextResponse.json({ ok: true, pr_url: prData.html_url });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Submission failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
