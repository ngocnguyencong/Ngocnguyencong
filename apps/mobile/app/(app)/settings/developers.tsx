import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  API_KEY_SCOPES,
  createMobileDeveloperActions,
  formatApiKeyMeta,
  formatDeliveryMeta,
  parseApiKeyExpiryDays,
  scheduleToggleInput,
  WEBHOOK_EVENT_TYPES,
  type ApiKeyRow,
  type ScheduleRow,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
} from "../../../src/developers/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
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
} from "../../../src/ui/screen";

type Pane = "keys" | "webhooks" | "schedules";

export default function DevelopersScreen() {
  const { api, styles } = useRequiredMobileApp();
  const dev = useMemo(() => createMobileDeveloperActions(api), [api]);

  const [pane, setPane] = useState<Pane>("keys");
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [endpoints, setEndpoints] = useState<WebhookEndpointRow[] | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["read"]);
  const [keyExpiry, setKeyExpiry] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [cron, setCron] = useState("");
  const [jobType, setJobType] = useState("");
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[] | null>(null);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const deliveriesRequest = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, w, s] = await Promise.all([
        dev.apiKeys.list().catch(() => null),
        dev.webhooks.list().catch(() => null),
        dev.schedules.list().catch(() => null),
      ]);
      if (k) setKeys(k);
      if (w) {
        setEndpoints(w);
        // Collapse the delivery panel when its endpoint went away.
        setDeliveriesFor((current) =>
          current !== null && w.every((endpoint) => endpoint.id !== current) ? null : current,
        );
      }
      if (s) setSchedules(s);
      if (!k && !w && !s) setError("Developer settings could not be loaded.");
      else setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Developer settings could not be loaded.");
    }
  }, [dev]);

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

  const toggleIn = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const toggleDeliveries = async (endpointId: string) => {
    if (deliveriesFor === endpointId) {
      deliveriesRequest.current = null;
      setDeliveriesFor(null);
      setDeliveries(null);
      setDeliveriesError(null);
      return;
    }
    deliveriesRequest.current = endpointId;
    setDeliveriesFor(endpointId);
    setDeliveries(null);
    setDeliveriesError(null);
    try {
      const rows = await dev.webhooks.deliveries(endpointId);
      // A quick second tap on another endpoint must not leak the earlier
      // response into the newly expanded panel.
      if (deliveriesRequest.current === endpointId) setDeliveries(rows);
    } catch (err) {
      if (deliveriesRequest.current === endpointId) {
        setDeliveriesError(
          err instanceof Error ? err.message : "The delivery history could not be loaded.",
        );
      }
    }
  };

  return (
    <Screen>
      <H1>Developers</H1>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["keys", "webhooks", "schedules"] as const).map((p) => (
          <AppButton
            key={p}
            label={{ keys: "API keys", schedules: "Schedules", webhooks: "Webhooks" }[p]}
            onPress={() => setPane(p)}
            variant={pane === p ? "primary" : "outline"}
          />
        ))}
      </View>

      {pane === "keys" ? (
        <>
          <Card>
            <SectionLabel>Create API key</SectionLabel>
            <FieldLabel>Name</FieldLabel>
            <AppInput
              maxLength={100}
              onChangeText={setKeyName}
              placeholder="CI pipeline"
              value={keyName}
            />
            <FieldLabel>Scopes</FieldLabel>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {API_KEY_SCOPES.map((scope) => (
                <AppButton
                  key={scope}
                  label={scope}
                  onPress={() => toggleIn(keyScopes, scope, setKeyScopes)}
                  variant={keyScopes.includes(scope) ? "primary" : "outline"}
                />
              ))}
            </View>
            <FieldLabel>Expires in days (0 = never)</FieldLabel>
            <AppInput
              keyboardType="number-pad"
              onChangeText={setKeyExpiry}
              placeholder="0"
              value={keyExpiry}
            />
            <AppButton
              disabled={busy || keyName.trim() === ""}
              label="Create key"
              onPress={() =>
                void run(async () => {
                  const created = await dev.apiKeys.create({
                    expiresInDays: parseApiKeyExpiryDays(keyExpiry),
                    name: keyName.trim(),
                    scopes: keyScopes,
                  });
                  setNewKey(created.plaintext);
                  setKeyName("");
                  setKeyExpiry("");
                  setKeyScopes(["read"]);
                }, "API key created.")
              }
            />
            {newKey ? (
              <Card style={{ borderColor: "#d55f2a" }}>
                <FieldLabel>Copy this key now — it will never be shown again</FieldLabel>
                <Text selectable style={styles.title}>
                  {newKey}
                </Text>
              </Card>
            ) : null}
          </Card>
          <Card>
            <SectionLabel>Keys</SectionLabel>
            {keys === null ? <Loading /> : null}
            {keys?.length === 0 ? <Detail>No API keys yet.</Detail> : null}
            {keys?.map((key) => (
              <ListRow key={key.id}>
                <View style={{ flex: 1 }}>
                  <Title>{key.name}</Title>
                  <Detail>{formatApiKeyMeta(key)}</Detail>
                </View>
                {key.status === "active" ? (
                  <DestructiveButton
                    disabled={busy}
                    label="Revoke"
                    onPress={() => void run(() => dev.apiKeys.revoke(key.id), "Key revoked.")}
                  />
                ) : (
                  <Badge>{key.status}</Badge>
                )}
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}

      {pane === "webhooks" ? (
        <>
          <Card>
            <SectionLabel>New endpoint</SectionLabel>
            <FieldLabel>URL (https)</FieldLabel>
            <AppInput
              autoCapitalize="none"
              onChangeText={setHookUrl}
              placeholder="https://example.com/hooks/supastack"
              value={hookUrl}
            />
            <FieldLabel>Events</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {WEBHOOK_EVENT_TYPES.map((event) => (
                <Pressable
                  accessibilityRole="button"
                  key={event}
                  onPress={() => toggleIn(hookEvents, event, setHookEvents)}
                >
                  <Badge>{`${hookEvents.includes(event) ? "✓ " : ""}${event}`}</Badge>
                </Pressable>
              ))}
            </View>
            <AppButton
              disabled={busy || hookUrl.trim() === "" || hookEvents.length === 0}
              label="Create endpoint"
              onPress={() =>
                void run(async () => {
                  const created = await dev.webhooks.create({
                    events: hookEvents,
                    url: hookUrl.trim(),
                  });
                  setNewSecret(created.secret);
                  setHookUrl("");
                  setHookEvents([]);
                }, "Endpoint created.")
              }
            />
            {newSecret ? (
              <Card style={{ borderColor: "#d55f2a" }}>
                <FieldLabel>Copy this signing secret now — it will never be shown again</FieldLabel>
                <Text selectable style={styles.title}>
                  {newSecret}
                </Text>
              </Card>
            ) : null}
          </Card>
          <Card>
            <SectionLabel>Endpoints</SectionLabel>
            {endpoints === null ? <Loading /> : null}
            {endpoints?.length === 0 ? <Detail>No webhook endpoints.</Detail> : null}
            {endpoints?.map((endpoint) => (
              <ListRow key={endpoint.id}>
                <View style={{ flex: 1 }}>
                  <Title numberOfLines={1}>{endpoint.url}</Title>
                  <Detail>{endpoint.events.join(", ")}</Detail>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <AppButton
                    disabled={busy}
                    label={deliveriesFor === endpoint.id ? "Hide deliveries" : "Deliveries"}
                    onPress={() => void toggleDeliveries(endpoint.id)}
                    variant="outline"
                  />
                  <AppButton
                    disabled={busy}
                    label="Ping"
                    onPress={() => void run(() => dev.webhooks.ping(endpoint.id), "Ping sent.")}
                    variant="outline"
                  />
                  <DestructiveButton
                    disabled={busy}
                    label="Delete"
                    onPress={() =>
                      void run(() => dev.webhooks.remove(endpoint.id), "Endpoint deleted.")
                    }
                  />
                </View>
                {deliveriesFor === endpoint.id ? (
                  <View style={{ gap: 4, paddingLeft: 8 }}>
                    {deliveries === null && deliveriesError === null ? <Loading /> : null}
                    {deliveriesError !== null ? <ErrorText>{deliveriesError}</ErrorText> : null}
                    {deliveries !== null && deliveries.length === 0 ? (
                      <Detail>No deliveries yet.</Detail>
                    ) : null}
                    {deliveries?.map((delivery) => (
                      <ListRow key={delivery.id}>
                        <View style={{ flex: 1 }}>
                          <Title>{delivery.eventType}</Title>
                          <Detail>
                            {formatDeliveryMeta(delivery)} ·{" "}
                            {new Date(delivery.createdAt).toLocaleString()}
                          </Detail>
                          {delivery.lastError ? <Detail>{delivery.lastError}</Detail> : null}
                        </View>
                        <Badge>{delivery.status}</Badge>
                      </ListRow>
                    ))}
                  </View>
                ) : null}
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}

      {pane === "schedules" ? (
        <>
          <Card>
            <SectionLabel>Schedule a job</SectionLabel>
            <FieldLabel>Job type</FieldLabel>
            <AppInput onChangeText={setJobType} placeholder="email.digest" value={jobType} />
            <FieldLabel>Cron</FieldLabel>
            <AppInput
              autoCapitalize="none"
              onChangeText={setCron}
              placeholder="0 9 * * 1"
              value={cron}
            />
            <AppButton
              disabled={busy || cron.trim() === "" || jobType.trim() === ""}
              label="Save schedule"
              onPress={() =>
                void run(async () => {
                  await dev.schedules.upsert({ cron: cron.trim(), type: jobType.trim() });
                  setCron("");
                  setJobType("");
                }, "Schedule saved.")
              }
            />
          </Card>
          <Card>
            <SectionLabel>Schedules</SectionLabel>
            {schedules === null ? <Loading /> : null}
            {schedules?.length === 0 ? <Detail>No schedules.</Detail> : null}
            {schedules?.map((schedule) => (
              <ListRow key={schedule.id}>
                <View style={{ flex: 1 }}>
                  <Title>{schedule.type}</Title>
                  <Detail>
                    {schedule.cron}
                    {schedule.nextRunAt
                      ? ` · next ${new Date(schedule.nextRunAt).toLocaleString()}`
                      : ""}
                  </Detail>
                </View>
                {!schedule.enabled ? <Badge>paused</Badge> : null}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <AppButton
                    disabled={busy}
                    label={schedule.enabled ? "Pause" : "Resume"}
                    onPress={() =>
                      void run(
                        () => dev.schedules.upsert(scheduleToggleInput(schedule)),
                        schedule.enabled ? "Schedule paused." : "Schedule resumed.",
                      )
                    }
                    variant="outline"
                  />
                  <DestructiveButton
                    disabled={busy}
                    label="Remove"
                    onPress={() =>
                      void run(() => dev.schedules.remove(schedule.id), "Schedule removed.")
                    }
                  />
                </View>
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
