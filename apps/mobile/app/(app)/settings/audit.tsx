import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { createMobileDeveloperActions, type AuditRow } from "../../../src/developers/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  Detail,
  EmptyState,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

export default function AuditScreen() {
  const { api } = useRequiredMobileApp();
  const dev = useMemo(() => createMobileDeveloperActions(api), [api]);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dev.audit
      .list()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "The audit log could not be loaded."),
      );
  }, [dev]);

  return (
    <Screen>
      <H1>Audit log</H1>
      {error ? <EmptyState detail={error} title="Something went wrong" /> : null}
      {rows === null && !error ? <Loading label="Loading audit log…" /> : null}
      {rows !== null && rows.length === 0 ? (
        <EmptyState detail="Workspace activity will appear here." title="No events yet" />
      ) : null}
      <SectionLabel>Recent activity</SectionLabel>
      {rows?.map((row) => (
        <ListRow key={row.id}>
          <View style={{ flex: 1 }}>
            <Title>{row.label}</Title>
            <Detail>
              {row.actorEmail ?? "system"}
              {row.targetType ? ` · ${row.targetType}` : ""} ·{" "}
              {new Date(row.createdAt).toLocaleString()}
            </Detail>
          </View>
        </ListRow>
      ))}
    </Screen>
  );
}
