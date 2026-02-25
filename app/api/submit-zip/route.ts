import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import yaml from "js-yaml";

const COMMUNITY_ORG = "a0-community-plugins";
const REGISTRY_REPO = "TerminallyLazy/a0-marketplace";
const REGISTRY_FILE = "registry.json";
const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Plugin validation types ────────────────────────────
// Mirrors Agent Zero's PluginMetadata Pydantic model from
// python/helpers/plugins.py — the runtime source of truth.

interface PluginYaml {
  name?: string;
  description?: string;
  version?: string;
  settings_sections?: string[];
  per_project_config?: boolean;
  per_agent_config?: boolean;
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Known Agent Zero plugin directories that indicate actual functionality
const KNOWN_PLUGIN_DIRS = [
  "api/",
  "webui/",
  "tools/",
  "prompts/",
  "extensions/",
  "helpers/",
  "agents/",
];

// File extensions that should never appear in a plugin
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".cmd",
  ".sh",
  ".msi",
  ".app",
  ".dmg",
  ".deb",
  ".rpm",
  ".pkg",
]);

// Suspiciously large individual files (5 MB)
const MAX_SINGLE_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Returns true for zip entries that are OS-generated junk and should be
 * ignored during plugin discovery, validation, and repo push.
 *
 * Covers:
 *  - macOS resource-fork metadata (`__MACOSX/` directory tree)
 *  - macOS Finder metadata (`.DS_Store`)
 *  - Windows thumbnail cache (`Thumbs.db`)
 */
function isJunkEntry(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, "/");
  if (normalized.startsWith("__MACOSX/") || normalized === "__MACOSX") return true;
  const basename = normalized.split("/").pop() || "";
  if (basename === ".DS_Store" || basename === "Thumbs.db") return true;
  return false;
}

/**
 * POST /api/submit-zip
 *
 * Accepts a multipart form with:
 *   - file: .zip file containing the plugin
 *   - name, id, description, author, tags, icon: metadata fields
 *
 * Pipeline:
 *   1. Extract zip, find plugin.yaml (root or one level deep)
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

    // Find plugin.yaml — at root or one directory level deep
    const { pluginYaml, stripPrefix } = findPluginYaml(zip);
    if (!pluginYaml) {
      const legacyPluginJson = findLegacyPluginJson(zip);
      const missingYamlMessage = legacyPluginJson
        ? `Found "${legacyPluginJson}" but this endpoint now requires "plugin.yaml". Rename/migrate plugin.json to plugin.yaml and try again.`
        : "No plugin.yaml found. It must be at the zip root or inside a single top-level folder.";

      return NextResponse.json(
        {
          ok: false,
          error: missingYamlMessage,
        },
        { status: 400 }
      );
    }

    // ─── 2b. Comprehensive validation ─────────────────────
    const validation = await validatePlugin(zip, pluginYaml, stripPrefix);

    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Plugin validation failed.",
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    
    // Parse plugin.yaml for metadata enrichment
    let pluginMeta: PluginYaml = {};
    try {
      const pluginYamlContent = await pluginYaml.async("string");
      pluginMeta = yaml.load(pluginYamlContent) as PluginYaml;
    } catch {
      // Shouldn't reach here — validatePlugin already checked YAML parsing
      return NextResponse.json(
        { ok: false, error: "plugin.yaml is not valid YAML." },
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
          auto_init: true, // seed repo so Git Data API works
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

    // Helper: delete the repo on failure so we don't leave empty shells
    const cleanupRepo = async () => {
      await fetch(`https://api.github.com/repos/${repoFullName}`, {
        method: "DELETE",
        headers: ghHeaders,
      }).catch(() => {}); // best-effort
    };

    try {
    // ─── 5. Push files via Git Data API ─────────────────────
    // Get the initial commit SHA (created by auto_init)
    const initRefRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/ref/heads/main`,
      { headers: ghHeaders }
    );
    if (!initRefRes.ok) {
      throw new Error("Failed to read initial commit from new repository.");
    }
    const initRefData = await initRefRes.json();
    const parentSha = initRefData.object.sha;

    // Build blobs for every file in the zip
    const treeItems: Array<{
      path: string;
      mode: string;
      type: string;
      sha: string;
    }> = [];

    for (const [filePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue; // skip directories
      if (isJunkEntry(filePath)) continue; // skip OS-generated junk

      // Strip the prefix folder if plugin.yaml was nested
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
        const blobErr = await blobRes.json().catch(() => ({}));
        throw new Error(
          `Failed to create blob for ${repoPath}: ${blobErr.message || blobRes.status}`
        );
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

    // Create commit (parent is the auto_init commit)
    const commitRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Initial commit: ${name}`,
          tree: treeData.sha,
          parents: [parentSha],
        }),
      }
    );
    if (!commitRes.ok) throw new Error("Failed to create git commit.");
    const commitData = await commitRes.json();

    // Update main branch ref to point to the new commit
    const refRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/main`,
      {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({
          sha: commitData.sha,
          force: true,
        }),
      }
    );
    if (!refRes.ok) throw new Error("Failed to update main branch.");

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
    const prBodyParts = [
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
    ];

    // Surface validation warnings in the PR for reviewers
    if (validation.warnings.length > 0) {
      prBodyParts.push(
        "",
        "### \u26a0\ufe0f Validation Warnings",
        "",
        ...validation.warnings.map((w) => `- ${w}`),
      );
    }

    prBodyParts.push(
      "",
      "---",
      "*This plugin was submitted via zip upload and automatically pushed to the community plugins organization.*",
    );

    const prBody = prBodyParts.join("\n");

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
      warnings: validation.warnings,
    });
    } catch (repoErr) {
      // Clean up the newly created repo so we don't leave empty shells
      await cleanupRepo();
      throw repoErr; // re-throw to the outer catch
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Submission failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * Validate the full plugin structure inside a zip archive.
 *
 * Checks (hard errors — block submission):
 *   - plugin.yaml is valid YAML
 *   - plugin.yaml has non-empty "name" and "description" fields
 *   - Field types match Agent Zero's PluginMetadata Pydantic model
 *   - No path traversal (.. or leading /)
 *   - No blocked file extensions (.exe, .dll, .so, etc.)
 *   - No individual file exceeds 5 MB
 *
 * Checks (soft warnings — included in PR):
 *   - version field is missing or not semver-like
 *   - No recognized plugin directories (api/, webui/, tools/, etc.)
 *   - settings_sections references but no webui/config.html
 */
async function validatePlugin(
  zip: JSZip,
  pluginYamlEntry: JSZip.JSZipObject,
  stripPrefix: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ─── 1. Parse plugin.yaml ──────────────────────────────
  let meta: PluginYaml;
  try {
    const raw = await pluginYamlEntry.async("string");
    const parsed = yaml.load(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        valid: false,
        errors: ["plugin.yaml must be a YAML mapping/object (not array or primitive)."],
        warnings,
      };
    }
    meta = parsed as PluginYaml;
  } catch {
    return { valid: false, errors: ["plugin.yaml is not valid YAML."], warnings };
  }

  // ─── 2. Required fields ────────────────────────────────
  if (!meta.name || typeof meta.name !== "string" || !meta.name.trim()) {
    errors.push(
      'plugin.yaml must have a non-empty "name" field (string). This is shown in the Agent Zero UI.'
    );
  }

  if (
    !meta.description ||
    typeof meta.description !== "string" ||
    !meta.description.trim()
  ) {
    errors.push(
      'plugin.yaml must have a non-empty "description" field (string).'
    );
  }

  // ─── 3. Field type validation ──────────────────────────
  if (meta.version !== undefined && typeof meta.version !== "string") {
    errors.push('"version" must be a string (e.g. "1.0.0").');
  }

  if (meta.settings_sections !== undefined) {
    if (!Array.isArray(meta.settings_sections)) {
      errors.push('"settings_sections" must be an array of strings.');
    } else if (
      meta.settings_sections.some((s: unknown) => typeof s !== "string")
    ) {
      errors.push('"settings_sections" must contain only strings.');
    }
  }

  if (
    meta.per_project_config !== undefined &&
    typeof meta.per_project_config !== "boolean"
  ) {
    errors.push('"per_project_config" must be a boolean (true/false).');
  }

  if (
    meta.per_agent_config !== undefined &&
    typeof meta.per_agent_config !== "boolean"
  ) {
    errors.push('"per_agent_config" must be a boolean (true/false).');
  }

  // ─── 4. Version format warning ─────────────────────────
  if (!meta.version || typeof meta.version !== "string" || !meta.version.trim()) {
    warnings.push(
      'No "version" field in plugin.yaml. Consider adding one (e.g. "1.0.0").'
    );
  } else if (!/^\d+\.\d+\.\d+/.test(meta.version)) {
    warnings.push(
      `Version "${meta.version}" doesn't follow semver format (e.g. "1.0.0"). Agent Zero will still load it, but semver is recommended.`
    );
  }

  // ─── 5. File-level security checks ────────────────────
  const allPaths = Object.keys(zip.files).filter((p) => !isJunkEntry(p));

  for (const filePath of allPaths) {
    // Path traversal
    if (filePath.includes("..") || filePath.startsWith("/")) {
      errors.push(
        `Invalid file path "${filePath}" — paths must not contain ".." or start with "/".`
      );
      continue;
    }

    // Normalize relative to plugin root
    let relPath = filePath;
    if (stripPrefix && filePath.startsWith(stripPrefix)) {
      relPath = filePath.slice(stripPrefix.length);
    }

    // Blocked extensions
    const ext = relPath.includes(".")
      ? "." + relPath.split(".").pop()!.toLowerCase()
      : "";
    if (BLOCKED_EXTENSIONS.has(ext)) {
      errors.push(
        `Blocked file type "${ext}" found: "${relPath}". Binary executables are not allowed in plugins.`
      );
    }

    // Individual file size
    const entry = zip.files[filePath];
    if (!entry.dir) {
      const buf = await entry.async("arraybuffer");
      if (buf.byteLength > MAX_SINGLE_FILE_SIZE) {
        const sizeMB = (buf.byteLength / (1024 * 1024)).toFixed(1);
        errors.push(
          `File "${relPath}" is ${sizeMB} MB — individual files must be under 5 MB.`
        );
      }
    }
  }

  // ─── 6. Structure warnings ─────────────────────────────
  // Check if any recognized plugin directories exist
  const relPaths = allPaths.map((p) =>
    stripPrefix && p.startsWith(stripPrefix) ? p.slice(stripPrefix.length) : p
  );

  const hasKnownDir = KNOWN_PLUGIN_DIRS.some((dir) =>
    relPaths.some((p) => p.startsWith(dir))
  );

  if (!hasKnownDir) {
    warnings.push(
      "No recognized plugin directories found (api/, webui/, tools/, prompts/, extensions/, helpers/, agents/). " +
        "This is allowed, but most plugins include at least one of these."
    );
  }

  // Check if settings_sections is set but no config.html exists
  if (
    Array.isArray(meta.settings_sections) &&
    meta.settings_sections.length > 0
  ) {
    const hasConfigHtml = relPaths.some((p) => p === "webui/config.html");
    if (!hasConfigHtml) {
      warnings.push(
        `plugin.yaml declares settings_sections [${meta.settings_sections.join(", ")}] but no "webui/config.html" was found. ` +
          "The settings tab will appear empty in Agent Zero."
      );
    }
  }

  // Check for config.default.json if settings are declared
  if (
    Array.isArray(meta.settings_sections) &&
    meta.settings_sections.length > 0
  ) {
    const hasDefaultConfig = relPaths.some((p) => p === "config.default.json");
    if (!hasDefaultConfig) {
      warnings.push(
        "Plugin has settings_sections but no config.default.json. " +
          "Consider adding default configuration values."
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Locate legacy plugin.json metadata to provide a clearer migration error.
 */
function findLegacyPluginJson(zip: JSZip): string | null {
  const entries = Object.keys(zip.files);
  for (const entry of entries) {
    if (isJunkEntry(entry)) continue;
    if (entry === "plugin.json" || entry.endsWith("/plugin.json")) {
      return entry;
    }
  }
  return null;
}

/**
 * Locate plugin.yaml in a zip archive.
 *
 * Checks:
 *   1. Root level: "plugin.yaml"
 *   2. One level deep: "<folder>/plugin.yaml" (common when zipping a directory)
 *
 * Returns the JSZip entry and the prefix to strip from paths.
 */
function findPluginYaml(zip: JSZip): {
  pluginYaml: JSZip.JSZipObject | null;
  stripPrefix: string;
} {
  // Check root
  const rootEntry = zip.file("plugin.yaml");
  if (rootEntry) {
    return { pluginYaml: rootEntry, stripPrefix: "" };
  }

  // Check one level deep (e.g. "my-plugin/plugin.yaml")
  const entries = Object.keys(zip.files);
  const topDirs = new Set<string>();

  for (const entry of entries) {
    if (isJunkEntry(entry)) continue;
    const parts = entry.split("/");
    if (parts.length >= 2 && parts[0]) {
      topDirs.add(parts[0]);
    }
  }

  // If there's exactly one top-level directory, look for plugin.yaml inside it
  if (topDirs.size === 1) {
    const dirName = [...topDirs][0];
    const nestedEntry = zip.file(`${dirName}/plugin.yaml`);
    if (nestedEntry) {
      return { pluginYaml: nestedEntry, stripPrefix: `${dirName}/` };
    }
  }

  return { pluginYaml: null, stripPrefix: "" };
}
