import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

import {
  createMobileContentActions,
  type ContentEntry,
  type ContentEntryStatus,
} from "../../src/content/client";
import { readCachedOrFetch } from "../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../src/session/provider";
import { OfflineNotice } from "../../src/ui/offline-notice";
import {
  AppButton,
  AppInput,
  Badge,
  Card,
  Detail,
  DestructiveButton,
  ErrorText,
  FieldLabel,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../src/ui/screen";

/** Cache-written payloads are self-validated — a light shape check drops corrupted entries. */
function parseContentList(value: unknown): { entries: ContentEntry[]; writable: boolean } {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { entries?: unknown }).entries)
  ) {
    return {
      entries: (value as { entries: ContentEntry[] }).entries,
      writable: (value as { writable?: unknown }).writable === true,
    };
  }
  throw new Error("The cached content list was invalid.");
}

interface EditFields {
  body: string;
  excerpt: string;
  locale: string;
  requiredEntitlement: string;
  slug: string;
  title: string;
  type: string;
}

export default function ContentScreen() {
  const { api, offlineCache, offlineScope, styles } = useRequiredMobileApp();
  const content = useMemo(() => createMobileContentActions(api), [api]);

  const [entries, setEntries] = useState<ContentEntry[] | null>(null);
  const [writable, setWritable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const editRequest = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await readCachedOrFetch(
        offlineCache,
        offlineScope,
        "content:list",
        () => content.list(),
        parseContentList,
      );
      setEntries(result.value.entries);
      setWritable(result.value.writable);
      setOfflineSavedAt(result.source === "cache" ? result.savedAt : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The content list could not be loaded.");
    }
  }, [content, offlineCache, offlineScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await fn();
        setMessage(ok);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "The action failed.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const setStatus = (entry: ContentEntry, status: ContentEntryStatus) =>
    void run(() => content.setStatus(entry.id, status), `Entry marked ${status}.`);

  const patchEdit = (key: keyof EditFields, value: string) =>
    setEditFields((fields) => (fields === null ? fields : { ...fields, [key]: value }));

  // PATCH is a full-form replace — the panel must prefill every field,
  // including the body the list payload deliberately omits, so expanding
  // the editor fetches the entry first (same stale-guard as the
  // deliveries panel in settings/developers.tsx).
  const toggleEdit = async (entryId: string) => {
    if (editingFor === entryId) {
      editRequest.current = null;
      setEditingFor(null);
      setEditFields(null);
      setEditError(null);
      return;
    }
    editRequest.current = entryId;
    setEditingFor(entryId);
    setEditFields(null);
    setEditError(null);
    try {
      const detail = await content.get(entryId);
      if (editRequest.current === entryId) {
        setEditFields({
          body: detail.body,
          excerpt: detail.excerpt ?? "",
          locale: detail.locale ?? "",
          requiredEntitlement: detail.requiredEntitlement ?? "",
          slug: detail.slug,
          title: detail.title,
          type: detail.type,
        });
      }
    } catch (err) {
      if (editRequest.current === entryId) {
        setEditError(err instanceof Error ? err.message : "The entry could not be loaded.");
      }
    }
  };

  const saveEdit = (entryId: string, fields: EditFields) =>
    void run(async () => {
      await content.update(entryId, fields);
      editRequest.current = null;
      setEditingFor(null);
      setEditFields(null);
    }, "Entry updated.");

  return (
    <Screen>
      <H1>Content</H1>
      <Detail>Workspace CMS entries — edit, publish, unpublish, archive, or delete.</Detail>
      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}

      {writable ? (
        <Card>
          <SectionLabel>New entry</SectionLabel>
          <FieldLabel>Type</FieldLabel>
          <AppInput autoCapitalize="none" onChangeText={setType} placeholder="post" value={type} />
          <FieldLabel>Title</FieldLabel>
          <AppInput onChangeText={setTitle} placeholder="My first entry" value={title} />
          <FieldLabel>Slug (blank derives from title)</FieldLabel>
          <AppInput
            autoCapitalize="none"
            onChangeText={setSlug}
            placeholder="my-first-entry"
            value={slug}
          />
          <AppButton
            disabled={busy || type.trim() === "" || title.trim() === ""}
            label="Create draft"
            onPress={() =>
              void run(async () => {
                await content.create({
                  slug: slug.trim(),
                  title: title.trim(),
                  type: type.trim(),
                });
                setSlug("");
                setTitle("");
              }, "Entry created as a draft.")
            }
          />
        </Card>
      ) : null}

      <Card>
        <SectionLabel>Entries</SectionLabel>
        {entries === null && error === null ? <Loading /> : null}
        {entries?.length === 0 ? <Detail>No entries yet.</Detail> : null}
        {entries?.map((entry) => (
          <ListRow key={entry.id}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Title numberOfLines={1}>{entry.title}</Title>
                  <Detail>
                    /{entry.type}/{entry.slug}
                    {entry.locale ? ` · ${entry.locale}` : ""} · updated{" "}
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </Detail>
                  {entry.requiredEntitlement ? (
                    <Detail>Requires {entry.requiredEntitlement}</Detail>
                  ) : null}
                </View>
                <Badge>{entry.status}</Badge>
              </View>
              {writable ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <AppButton
                    disabled={busy}
                    label={editingFor === entry.id ? "Close editor" : "Edit"}
                    onPress={() => void toggleEdit(entry.id)}
                    variant="outline"
                  />
                  {entry.status !== "published" ? (
                    <AppButton
                      disabled={busy}
                      label="Publish"
                      onPress={() => setStatus(entry, "published")}
                      variant="outline"
                    />
                  ) : (
                    <AppButton
                      disabled={busy}
                      label="Unpublish"
                      onPress={() => setStatus(entry, "draft")}
                      variant="outline"
                    />
                  )}
                  {entry.status !== "archived" ? (
                    <AppButton
                      disabled={busy}
                      label="Archive"
                      onPress={() => setStatus(entry, "archived")}
                      variant="outline"
                    />
                  ) : null}
                  <DestructiveButton
                    disabled={busy}
                    label="Delete"
                    onPress={() => void run(() => content.remove(entry.id), "Entry deleted.")}
                  />
                </View>
              ) : null}
              {editingFor === entry.id ? (
                <View style={{ gap: 4 }}>
                  {editFields === null && editError === null ? <Loading /> : null}
                  {editError !== null ? <ErrorText>{editError}</ErrorText> : null}
                  {editFields !== null ? (
                    <>
                      <FieldLabel>Type</FieldLabel>
                      <AppInput
                        autoCapitalize="none"
                        onChangeText={(v) => patchEdit("type", v)}
                        value={editFields.type}
                      />
                      <FieldLabel>Title</FieldLabel>
                      <AppInput
                        onChangeText={(v) => patchEdit("title", v)}
                        value={editFields.title}
                      />
                      <FieldLabel>Slug (blank derives from title)</FieldLabel>
                      <AppInput
                        autoCapitalize="none"
                        onChangeText={(v) => patchEdit("slug", v)}
                        value={editFields.slug}
                      />
                      <FieldLabel>Locale (optional)</FieldLabel>
                      <AppInput
                        autoCapitalize="none"
                        onChangeText={(v) => patchEdit("locale", v)}
                        value={editFields.locale}
                      />
                      <FieldLabel>Required entitlement (optional)</FieldLabel>
                      <AppInput
                        autoCapitalize="none"
                        onChangeText={(v) => patchEdit("requiredEntitlement", v)}
                        value={editFields.requiredEntitlement}
                      />
                      <FieldLabel>Excerpt</FieldLabel>
                      <AppInput
                        onChangeText={(v) => patchEdit("excerpt", v)}
                        value={editFields.excerpt}
                      />
                      <FieldLabel>Body (Markdown)</FieldLabel>
                      <AppInput
                        multiline
                        onChangeText={(v) => patchEdit("body", v)}
                        style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
                        value={editFields.body}
                      />
                      <AppButton
                        disabled={
                          busy || editFields.title.trim() === "" || editFields.type.trim() === ""
                        }
                        label="Save changes"
                        onPress={() => saveEdit(entry.id, editFields)}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          </ListRow>
        ))}
      </Card>

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
