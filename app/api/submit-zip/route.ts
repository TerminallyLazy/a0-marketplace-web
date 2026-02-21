import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

const COMMUNITY_ORG = "a0-community-plugins";
const REGISTRY_REPO = "TerminallyLazy/a0-marketplace";
const REGISTRY_FILE = "registry.json";
const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10 MB

interface PluginJson {
  name?: string;
  description?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * POST /api/submit-zip
 *
 * Accepts a multipart form with:
 *   - file: .zip file containing the plugin
 *   - name, id, description, author, tags, icon: metadata fields
 *
 * Pipeline:
 *   1. Extract zip, find plugin.json (root or one level deep)
 *   2. Validate structure and size
 *   3. Create repo under a0-community-plugins org
 *   4. Push all files via Git Data API (blobs -> tree -> commit -> ref)
 *   5. Create registry PR on a0-marketplace repo
 */
export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Plugin submissions are currently being set up. Please try again later.",
      },
      { status: 503 }
    );
  }

  const ghHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  try {
    // ─── 1. Parse multipart form ────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "";
    const id = (formData.get("id") as string) || "";
    const description = (formData.get("description") as string) || "";
    const author = (formData.get("author") as string) || "";
    const tags = (formData.get("tags") as string) || "";
    const icon = (formData.get("icon") as string) || "extension";

    // Validate required fields
    if (!name || !id || !description || !author) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No zip file provided." },
        { status: 400 }
      );
    }

    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Zip file exceeds 10 MB limit." },
        { status: 400 }
      );
    }

    // ─── 2. Extract and validate zip ────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    let zip: JSZip;

    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid zip file. Could not extract contents." },
        { status: 400 }
      );
    }

    // Find plugin.json — at root or one directory level deep
    const { pluginJson, stripPrefix } = findPluginJson(zip);
    if (!pluginJson) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No plugin.json found. It must be at the zip root or inside a single top-level folder.",
        },
        { status: 400 }
      );
    }

    // Security: check for path traversal
    const fileEntries = Object.keys(zip.files);
    for (const path of fileEntries) {
      if (path.includes("..") || path.startsWith("/")) {
        return NextResponse.json(
          { ok: false, error: "Zip contains invalid file paths." },
          { status: 400 }
        );
      }
    }

    // Parse plugin.json content for enrichment
    let pluginMeta: PluginJson = {};
    try {
      const pluginJsonContent = await pluginJson.async("string");
      pluginMeta = JSON.parse(pluginJsonContent);
    } catch {
      return NextResponse.json(
        { ok: false, error: "plugin.json is not valid JSON." },
        { status: 400 }
      );
    }

    // ─── 3. Check for duplicate in registry ─────────────────
    const registryRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/contents/${REGISTRY_FILE}`,
      { headers: ghHeaders }
    );
    if (!registryRes.ok) throw new Error("Failed to read registry.");
    const registryData = await registryRes.json();
    const currentRegistry = JSON.parse(
      Buffer.from(registryData.content, "base64").toString()
    );

    if (
      currentRegistry.plugins.some((p: { id: string }) => p.id === id)
    ) {
      return NextResponse.json(
        { ok: false, error: `Plugin ID '${id}' already exists in the registry.` },
        { status: 409 }
      );
    }

    // ─── 4. Create repo under community org ─────────────────
    const repoName = id; // repo name = plugin ID
    const createRepoRes = await fetch(
      `https://api.github.com/orgs/${COMMUNITY_ORG}/repos`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          name: repoName,
          description: `${name} — Community plugin for Agent Zero`,
          private: false,
          auto_init: false, // we'll push our own initial commit
        }),
      }
    );

    if (!createRepoRes.ok) {
      const err = await createRepoRes.json();
      if (err.errors?.some((e: { message?: string }) => e.message?.includes("already exists"))) {
        return NextResponse.json(
          { ok: false, error: `Repository '${COMMUNITY_ORG}/${repoName}' already exists.` },
          { status: 409 }
        );
      }
      throw new Error(
        `Failed to create repository: ${err.message || JSON.stringify(err)}`
      );
    }

    const newRepo = await createRepoRes.json();
    const repoFullName = newRepo.full_name; // e.g. "a0-community-plugins/my-plugin"

    // ─── 5. Push files via Git Data API ─────────────────────
    // Build blobs for every file in the zip
    const treeItems: Array<{
      path: string;
      mode: string;
      type: string;
      sha: string;
    }> = [];

    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue; // skip directories

      // Strip the prefix folder if plugin.json was nested
      let repoPath = filePath;
      if (stripPrefix && filePath.startsWith(stripPrefix)) {
        repoPath = filePath.slice(stripPrefix.length);
      }
      if (!repoPath) continue; // skip empty paths

      // Create blob
      const content = await zipEntry.async("base64");
      const blobRes = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/blobs`,
        {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            content,
            encoding: "base64",
          }),
        }
      );

      if (!blobRes.ok) {
        throw new Error(`Failed to create blob for ${repoPath}`);
      }

      const blobData = await blobRes.json();
      treeItems.push({
        path: repoPath,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      });
    }

    if (treeItems.length === 0) {
      throw new Error("Zip file contained no files to push.");
    }

    // Create tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ tree: treeItems }),
      }
    );
    if (!treeRes.ok) throw new Error("Failed to create git tree.");
    const treeData = await treeRes.json();

    // Create commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Initial commit: ${name}`,
          tree: treeData.sha,
          parents: [], // orphan commit (new repo, no parents)
        }),
      }
    );
    if (!commitRes.ok) throw new Error("Failed to create git commit.");
    const commitData = await commitRes.json();

    // Create main branch ref
    const refRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          ref: "refs/heads/main",
          sha: commitData.sha,
        }),
      }
    );
    if (!refRes.ok) throw new Error("Failed to create main branch.");

    // ─── 6. Create registry PR ──────────────────────────────
    // Get main branch SHA of registry repo
    const mainRefRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/git/ref/heads/main`,
      { headers: ghHeaders }
    );
    if (!mainRefRes.ok) throw new Error("Failed to get registry main branch.");
    const mainRefData = await mainRefRes.json();
    const baseSha = mainRefData.object.sha;

    // Create branch
    const branchName = `plugin/${id}`;
    const branchRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/git/refs`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    );
    if (!branchRes.ok) {
      const branchErr = await branchRes.json();
      throw new Error(branchErr.message || "Failed to create registry branch.");
    }

    // Add plugin to registry
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
      repo_url: `https://github.com/${repoFullName}`,
      plugin_path: ".",
      version: pluginMeta.version || "1.0.0",
      featured: false,
      tags: tagList,
      icon: icon || "extension",
    };
    currentRegistry.plugins.push(newPlugin);

    const updatedContent = Buffer.from(
      JSON.stringify(currentRegistry, null, 2) + "\n"
    ).toString("base64");

    const updateRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/contents/${REGISTRY_FILE}`,
      {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Add community plugin: ${name}`,
          content: updatedContent,
          sha: registryData.sha,
          branch: branchName,
        }),
      }
    );
    if (!updateRes.ok) throw new Error("Failed to update registry file.");

    // Create PR
    const prBody = [
      "## Community Plugin Submission (Zip Upload)",
      "",
      `**Plugin Name:** ${name}`,
      `**Plugin ID:** ${id}`,
      `**Repository:** https://github.com/${repoFullName}`,
      `**Submitted by:** ${author}`,
      "",
      "### Description",
      "",
      description,
      "",
      "### Tags",
      "",
      tagList.join(", ") || "None",
      "",
      "---",
      "*This plugin was submitted via zip upload and automatically pushed to the community plugins organization.*",
    ].join("\n");

    const prRes = await fetch(
      `https://api.github.com/repos/${REGISTRY_REPO}/pulls`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          title: `Add community plugin: ${name}`,
          body: prBody,
          head: branchName,
          base: "main",
        }),
      }
    );
    if (!prRes.ok) throw new Error("Failed to create pull request.");
    const prData = await prRes.json();

    return NextResponse.json({
      ok: true,
      pr_url: prData.html_url,
      repo_url: `https://github.com/${repoFullName}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Submission failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * Locate plugin.json in a zip archive.
 *
 * Checks:
 *   1. Root level: "plugin.json"
 *   2. One level deep: "<folder>/plugin.json" (common when zipping a directory)
 *
 * Returns the JSZip entry and the prefix to strip from paths.
 */
function findPluginJson(zip: JSZip): {
  pluginJson: JSZip.JSZipObject | null;
  stripPrefix: string;
} {
  // Check root
  const rootEntry = zip.file("plugin.json");
  if (rootEntry) {
    return { pluginJson: rootEntry, stripPrefix: "" };
  }

  // Check one level deep (e.g. "my-plugin/plugin.json")
  const entries = Object.keys(zip.files);
  const topDirs = new Set<string>();

  for (const entry of entries) {
    const parts = entry.split("/");
    if (parts.length >= 2 && parts[0]) {
      topDirs.add(parts[0]);
    }
  }

  // If there's exactly one top-level directory, look for plugin.json inside it
  if (topDirs.size === 1) {
    const dirName = [...topDirs][0];
    const nestedEntry = zip.file(`${dirName}/plugin.json`);
    if (nestedEntry) {
      return { pluginJson: nestedEntry, stripPrefix: `${dirName}/` };
    }
  }

  return { pluginJson: null, stripPrefix: "" };
}
