"use client";

import type { AppLocale } from "@supastack/i18n";
import { useState, type FormEvent } from "react";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import {
  createContentEntryAction,
  deleteContentEntryAction,
  setContentEntryStatusAction,
  updateContentEntryAction,
  type ContentEntryRow,
} from "./content-actions";
import { CONTENT_ENTRY_TYPES } from "./content";

function formatDate(value: Date | string | null): string {
  if (value === null) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function WebContentPage({
  brand,
  entries,
  error,
  locale,
  writable,
}: Readonly<{
  brand?: ChromeBrand | undefined;
  entries: ContentEntryRow[];
  error?: string | undefined;
  locale?: AppLocale | undefined;
  writable: boolean;
}>) {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<ContentEntryRow | null>(null);

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    setPending(true);
    setFormMessage(null);
    try {
      const payload = {
        body: text("body"),
        excerpt: text("excerpt"),
        locale: text("locale"),
        requiredEntitlement: text("requiredEntitlement"),
        slug: text("slug"),
        title: text("title"),
        type: text("type"),
      };
      const result = editing
        ? await updateContentEntryAction({ ...payload, entryId: editing.id })
        : await createContentEntryAction(payload);
      if (result.ok) {
        setEditing(null);
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <WorkspaceShell active="Content" brand={brand} locale={locale}>
      <div className="auth-card">
        <div className="auth-heading">
          <h1>Content</h1>
          <p>
            Workspace-scoped CMS entries — posts, pages, or your own types. Publishing flips the
            status and stamps <code>publishedAt</code>; product pages read published entries through{" "}
            <code>listPublishedContentEntries</code>.
          </p>
        </div>

        {error !== undefined ? (
          <p role="status">{error}</p>
        ) : (
          <>
            {entries.length === 0 ? (
              <p>No entries yet.</p>
            ) : (
              <ul className="notification-list" aria-label="Content entries">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.title}</strong>{" "}
                    <span className="status-badge">{entry.status}</span>{" "}
                    <span className="status-badge">{entry.type}</span>
                    {entry.requiredEntitlement !== null ? (
                      <>
                        {" "}
                        <span className="status-badge">{entry.requiredEntitlement}</span>
                      </>
                    ) : null}
                    <br />
                    <span className="quiet-note">
                      /{entry.type}/{entry.slug}
                      {entry.locale !== null ? ` · ${entry.locale}` : ""} · updated{" "}
                      {formatDate(entry.updatedAt)}
                      {entry.publishedAt !== null
                        ? ` · published ${formatDate(entry.publishedAt)}`
                        : ""}
                    </span>
                    {entry.excerpt !== null ? (
                      <>
                        <br />
                        <span className="quiet-note">{entry.excerpt}</span>
                      </>
                    ) : null}
                    {writable ? (
                      <>
                        {" "}
                        <button
                          className="button button-secondary"
                          onClick={() => setEditing(entry)}
                          type="button"
                        >
                          Edit
                        </button>{" "}
                        {entry.status !== "published" ? (
                          <form action={setContentEntryStatusAction}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="status" value="published" />
                            <button className="button button-secondary" type="submit">
                              Publish
                            </button>
                          </form>
                        ) : (
                          <form action={setContentEntryStatusAction}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="status" value="draft" />
                            <button className="button button-secondary" type="submit">
                              Unpublish
                            </button>
                          </form>
                        )}{" "}
                        {entry.status !== "archived" ? (
                          <form action={setContentEntryStatusAction}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="status" value="archived" />
                            <button className="button button-secondary" type="submit">
                              Archive
                            </button>
                          </form>
                        ) : null}{" "}
                        <form action={deleteContentEntryAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <button className="button button-secondary" type="submit">
                            Delete
                          </button>
                        </form>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {writable ? (
              <form className="auth-form" onSubmit={(event) => void submitEntry(event)}>
                <h3>{editing === null ? "New entry" : `Editing “${editing.title}”`}</h3>
                <label htmlFor="content-type">Type</label>
                <input
                  defaultValue={editing?.type ?? "post"}
                  disabled={pending}
                  id="content-type"
                  list="content-type-options"
                  maxLength={64}
                  name="type"
                  required
                />
                <datalist id="content-type-options">
                  {CONTENT_ENTRY_TYPES.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                <label htmlFor="content-title">Title</label>
                <input
                  defaultValue={editing?.title ?? ""}
                  disabled={pending}
                  id="content-title"
                  maxLength={255}
                  name="title"
                  required
                />
                <label htmlFor="content-slug">Slug (blank derives from title)</label>
                <input
                  defaultValue={editing?.slug ?? ""}
                  disabled={pending}
                  id="content-slug"
                  maxLength={200}
                  name="slug"
                  placeholder="my-first-post"
                />
                <label htmlFor="content-locale">Locale (optional)</label>
                <input
                  defaultValue={editing?.locale ?? ""}
                  disabled={pending}
                  id="content-locale"
                  maxLength={35}
                  name="locale"
                  placeholder="en"
                />
                <label htmlFor="content-entitlement">
                  Required entitlement (blank = free for all readers)
                </label>
                <input
                  defaultValue={editing?.requiredEntitlement ?? ""}
                  disabled={pending}
                  id="content-entitlement"
                  list="content-entitlement-options"
                  maxLength={100}
                  name="requiredEntitlement"
                  placeholder="ai.reference-task"
                />
                <datalist id="content-entitlement-options">
                  <option value="ai.reference-task" />
                </datalist>
                <label htmlFor="content-excerpt">Excerpt</label>
                <input
                  defaultValue={editing?.excerpt ?? ""}
                  disabled={pending}
                  id="content-excerpt"
                  name="excerpt"
                />
                <label htmlFor="content-body">Body (Markdown)</label>
                <textarea
                  defaultValue={editing?.body ?? ""}
                  disabled={pending}
                  id="content-body"
                  key={editing?.id ?? "new"}
                  name="body"
                  rows={6}
                />
                <button className="button button-primary" disabled={pending} type="submit">
                  {editing === null ? "Create entry" : "Save changes"}
                </button>
                {editing !== null ? (
                  <button
                    className="button button-secondary"
                    onClick={() => setEditing(null)}
                    type="button"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </form>
            ) : null}
          </>
        )}

        {formMessage !== null ? <p role="alert">{formMessage}</p> : null}
      </div>
    </WorkspaceShell>
  );
}
