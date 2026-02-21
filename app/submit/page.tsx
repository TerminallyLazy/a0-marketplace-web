"use client";

import { useState, useCallback, useRef } from "react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "github.com" && parsed.pathname.split("/").length >= 3
    );
  } catch {
    return false;
  }
}

type SubmitMode = "github" | "zip";

interface FormState {
  repo_url: string;
  plugin_path: string;
  name: string;
  id: string;
  description: string;
  author: string;
  tags: string;
  icon: string;
}

const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10 MB

export default function SubmitPage() {
  const [mode, setMode] = useState<SubmitMode>("github");
  const [form, setForm] = useState<FormState>({
    repo_url: "",
    plugin_path: ".",
    name: "",
    id: "",
    description: "",
    author: "",
    tags: "",
    icon: "extension",
  });

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [autoId, setAutoId] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    pr_url?: string;
    repo_url?: string;
  } | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState | "file", string>>
  >({});

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "name" && autoId) {
          next.id = slugify(value);
        }
        return next;
      });
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [autoId]
  );

  // ─── Zip file handling ──────────────────────────────────
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".zip")) {
      setErrors((prev) => ({ ...prev, file: "Only .zip files are accepted." }));
      return;
    }
    if (file.size > MAX_ZIP_SIZE) {
      setErrors((prev) => ({
        ...prev,
        file: "File exceeds 10 MB limit.",
      }));
      return;
    }
    setZipFile(file);
    setErrors((prev) => ({ ...prev, file: undefined }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // ─── Validation ─────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState | "file", string>> = {};

    if (!form.name.trim()) newErrors.name = "Plugin name is required.";
    if (!form.id.trim()) newErrors.id = "Plugin ID is required.";
    if (!form.description.trim())
      newErrors.description = "Description is required.";
    if (!form.author.trim())
      newErrors.author = "Author GitHub handle is required.";

    if (mode === "github") {
      if (!form.repo_url.trim()) {
        newErrors.repo_url = "Repository URL is required.";
      } else if (!isValidGitHubUrl(form.repo_url)) {
        newErrors.repo_url = "Must be a valid GitHub repository URL.";
      }
    } else {
      if (!zipFile) {
        newErrors.file = "Please upload a zip file containing your plugin.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setResult(null);

    try {
      if (mode === "github") {
        // Standard GitHub repo submission
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();

        if (data.ok) {
          setResult({
            ok: true,
            message: "Plugin submitted! A pull request has been created.",
            pr_url: data.pr_url,
          });
        } else {
          setResult({ ok: false, message: data.error || "Submission failed." });
        }
      } else {
        // Zip upload submission
        const formData = new FormData();
        formData.append("file", zipFile!);
        formData.append("name", form.name);
        formData.append("id", form.id);
        formData.append("description", form.description);
        formData.append("author", form.author);
        formData.append("tags", form.tags);
        formData.append("icon", form.icon);

        const res = await fetch("/api/submit-zip", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.ok) {
          setResult({
            ok: true,
            message:
              "Plugin submitted! A GitHub repository and pull request have been created.",
            pr_url: data.pr_url,
            repo_url: data.repo_url,
          });
        } else {
          setResult({ ok: false, message: data.error || "Submission failed." });
        }
      }
    } catch {
      setResult({
        ok: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-darker via-dark to-dark" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(13,110,253,0.06),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 text-center">
          <div className="flex justify-center mb-4">
            <span className="badge-pill bg-primary/15 text-primary border border-primary/30">
              <span className="material-symbols-outlined text-sm">
                publish
              </span>
              Submit a Plugin
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-bright mb-3">
            Share your plugin with the community
          </h1>
          <p className="text-text-muted max-w-xl mx-auto">
            Add your plugin to the Agent Zero Marketplace. A pull request will be
            created for review by the maintainers.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Result banner */}
        {result && (
          <div
            className={`mb-8 rounded-lg border p-4 ${
              result.ok
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5">
                {result.ok ? "check_circle" : "error"}
              </span>
              <div>
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {result.pr_url && (
                    <a
                      href={result.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                    >
                      View Pull Request
                      <span className="material-symbols-outlined text-sm">
                        open_in_new
                      </span>
                    </a>
                  )}
                  {result.repo_url && (
                    <a
                      href={result.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                    >
                      View Repository
                      <span className="material-symbols-outlined text-sm">
                        open_in_new
                      </span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mb-8">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("github")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                mode === "github"
                  ? "bg-primary text-white"
                  : "bg-darker text-text-muted hover:text-text"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                code
              </span>
              I have a GitHub repo
            </button>
            <button
              type="button"
              onClick={() => setMode("zip")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                mode === "zip"
                  ? "bg-primary text-white"
                  : "bg-darker text-text-muted hover:text-text"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                upload_file
              </span>
              Upload a zip file
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted text-center">
            {mode === "github"
              ? "Point us to your existing GitHub repository."
              : "We\u2019ll create a GitHub repository for you automatically."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ─── GitHub Mode Fields ─── */}
          {mode === "github" && (
            <>
              <Field
                label="Repository URL"
                required
                error={errors.repo_url}
                hint="The GitHub repository containing your plugin."
              >
                <input
                  type="url"
                  value={form.repo_url}
                  onChange={(e) => updateField("repo_url", e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="form-input"
                />
              </Field>

              <Field
                label="Plugin Path"
                hint='Subdirectory within the repo. Use "." for root.'
              >
                <input
                  type="text"
                  value={form.plugin_path}
                  onChange={(e) => updateField("plugin_path", e.target.value)}
                  placeholder="."
                  className="form-input"
                />
              </Field>
            </>
          )}

          {/* ─── Zip Mode Fields ─── */}
          {mode === "zip" && (
            <Field
              label="Plugin Zip File"
              required
              error={errors.file}
              hint="Upload a .zip file containing your plugin (max 10 MB). Must include a plugin.json."
            >
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : zipFile
                    ? "border-success/50 bg-success/5"
                    : "border-border hover:border-text-muted"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {zipFile ? (
                  <>
                    <span className="material-symbols-outlined text-3xl text-success">
                      check_circle
                    </span>
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-bright">
                        {zipFile.name}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {(zipFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZipFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-text-muted">
                      cloud_upload
                    </span>
                    <div className="text-center">
                      <p className="text-sm text-text">
                        <span className="text-primary font-medium">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        ZIP file up to 10 MB
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Field>
          )}

          {/* ─── Common Fields ─── */}
          <Field label="Plugin Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="My Awesome Plugin"
              className="form-input"
            />
          </Field>

          <Field
            label="Plugin ID"
            required
            error={errors.id}
            hint="Auto-generated from name. Edit to customize."
          >
            <input
              type="text"
              value={form.id}
              onChange={(e) => {
                setAutoId(false);
                updateField("id", e.target.value);
              }}
              placeholder="my-awesome-plugin"
              className="form-input font-mono"
            />
          </Field>

          <Field label="Description" required error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Briefly describe what your plugin does..."
              rows={3}
              className="form-input resize-none"
            />
          </Field>

          <Field
            label="Author GitHub Handle"
            required
            error={errors.author}
          >
            <input
              type="text"
              value={form.author}
              onChange={(e) => updateField("author", e.target.value)}
              placeholder="username"
              className="form-input"
            />
          </Field>

          <Field
            label="Tags"
            hint="Comma-separated (e.g. code, web, database)"
          >
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
              placeholder="code, web, database"
              className="form-input"
            />
          </Field>

          <Field
            label="Icon"
            hint={
              <span>
                A{" "}
                <a
                  href="https://fonts.google.com/icons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Material Symbols
                </a>{" "}
                icon name.
              </span>
            }
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={form.icon}
                onChange={(e) => updateField("icon", e.target.value)}
                placeholder="extension"
                className="form-input flex-1"
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <span className="material-symbols-outlined text-2xl">
                  {form.icon || "extension"}
                </span>
              </div>
            </div>
          </Field>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full !py-3"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">
                  progress_activity
                </span>
                {mode === "zip" ? "Uploading & Creating Repo..." : "Submitting..."}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">
                  {mode === "zip" ? "cloud_upload" : "publish"}
                </span>
                {mode === "zip" ? "Upload & Submit Plugin" : "Submit Plugin"}
              </>
            )}
          </button>
        </form>

        {/* Info box for zip mode */}
        {mode === "zip" && (
          <div className="mt-8 rounded-lg border border-border/50 bg-darker p-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary mt-0.5">
                info
              </span>
              <div className="text-sm text-text-muted space-y-2">
                <p className="font-medium text-text">
                  What happens when you upload a zip?
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Your zip is validated (must contain a{" "}
                    <code className="text-xs bg-panel px-1 py-0.5 rounded">
                      plugin.json
                    </code>
                    )
                  </li>
                  <li>
                    A public GitHub repository is created at{" "}
                    <code className="text-xs bg-panel px-1 py-0.5 rounded">
                      a0-community-plugins/your-plugin-id
                    </code>
                  </li>
                  <li>All files are pushed to the new repository</li>
                  <li>
                    A pull request is opened to add your plugin to the
                    marketplace registry
                  </li>
                </ol>
                <p>
                  After review and approval, your plugin will appear in the
                  marketplace!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Reusable field wrapper ---- */

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}
