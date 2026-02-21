"use client";

import { useState, useCallback } from "react";

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

export default function SubmitPage() {
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

  const [autoId, setAutoId] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    pr_url?: string;
  } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

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

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) newErrors.name = "Plugin name is required.";
    if (!form.id.trim()) newErrors.id = "Plugin ID is required.";
    if (!form.description.trim())
      newErrors.description = "Description is required.";
    if (!form.author.trim())
      newErrors.author = "Author GitHub handle is required.";
    if (!form.repo_url.trim()) {
      newErrors.repo_url = "Repository URL is required.";
    } else if (!isValidGitHubUrl(form.repo_url)) {
      newErrors.repo_url = "Must be a valid GitHub repository URL.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setResult(null);

    try {
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
              <span className="material-symbols-outlined text-sm">publish</span>
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
                {result.pr_url && (
                  <a
                    href={result.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm underline"
                  >
                    View Pull Request
                    <span className="material-symbols-outlined text-sm">
                      open_in_new
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Repository URL */}
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

          {/* Plugin Path */}
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

          {/* Plugin Name */}
          <Field label="Plugin Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="My Awesome Plugin"
              className="form-input"
            />
          </Field>

          {/* Plugin ID */}
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

          {/* Description */}
          <Field label="Description" required error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Briefly describe what your plugin does..."
              rows={3}
              className="form-input resize-none"
            />
          </Field>

          {/* Author */}
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

          {/* Tags */}
          <Field label="Tags" hint="Comma-separated (e.g. code, web, database)">
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
              placeholder="code, web, database"
              className="form-input"
            />
          </Field>

          {/* Icon */}
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
                Submitting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">
                  publish
                </span>
                Submit Plugin
              </>
            )}
          </button>
        </form>
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
