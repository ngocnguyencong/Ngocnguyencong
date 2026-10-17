import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useRequiredMobileApp } from "../src/session/provider";
import type { ThemePalette } from "../src/theme/theme";
import { AppButton } from "../src/ui/screen";

import type { MobileAuthActionClient } from "../src/auth/actions";
import { createMobileAuthClient, mobileAuthApiUrl } from "../src/auth/client";
import { createMobileFeatureBoardActions } from "../src/feature-board/client";
import {
  FEATURE_REQUEST_STATUSES,
  FEATURE_STATUS_LABELS,
  toFeatureBoardPresentation,
  type FeatureBoardPresentation,
  type FeatureRequestStatus,
} from "../src/feature-board/presentation";

type AuthenticatedMobileAuthClient = MobileAuthActionClient &
  Pick<ReturnType<typeof createMobileAuthClient>, "getCookie" | "useSession">;

export default function FeedbackScreen() {
  const apiUrl = mobileAuthApiUrl;
  const authClient = useMemo(() => (apiUrl ? createMobileAuthClient(apiUrl) : null), []);

  if (!authClient || !apiUrl) {
    return <ScreenMessage message="Set EXPO_PUBLIC_API_URL before signing in." />;
  }

  return <FeedbackBoard apiUrl={apiUrl} authClient={authClient} />;
}

function FeedbackBoard({
  apiUrl,
  authClient,
}: {
  apiUrl: string;
  authClient: AuthenticatedMobileAuthClient;
}) {
  const styles = useFeedbackStyles();
  const { palette } = useRequiredMobileApp();
  const session = authClient.useSession();
  const board = useMemo(
    () => createMobileFeatureBoardActions({ apiUrl, getCookie: authClient.getCookie }),
    [apiUrl, authClient],
  );

  const [presentation, setPresentation] = useState<FeatureBoardPresentation | null>(null);
  const [filter, setFilter] = useState<FeatureRequestStatus | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (session.isPending || !session.data) {
      setPresentation(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    board
      .fetchBoard()
      .then((payload) => {
        if (!cancelled) {
          setPresentation(toFeatureBoardPresentation(payload));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "The board could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [board, session.data, session.isPending]);

  if (session.isPending) {
    return <ScreenMessage message="Restoring your secure session…" />;
  }

  if (!session.data) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>Feature board</Text>
          <Text style={styles.detail}>Sign in on the home screen to view and vote.</Text>
          <Link href="/" style={styles.link}>
            Back to account
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  const visibleRequests =
    presentation === null
      ? []
      : filter === "all"
        ? presentation.requests
        : presentation.requests.filter((request) => request.status === filter);

  async function toggleVote(requestId: string) {
    if (presentation === null) {
      return;
    }
    setPresentation((previous) =>
      previous === null
        ? previous
        : {
            ...previous,
            requests: previous.requests.map((request) =>
              request.id === requestId
                ? {
                    ...request,
                    voteCount: Math.max(0, request.voteCount + (request.voted ? -1 : 1)),
                    voted: !request.voted,
                  }
                : request,
            ),
          },
    );
    try {
      const result = await board.toggleVote(requestId);
      setPresentation((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              requests: previous.requests.map((request) =>
                request.id === requestId
                  ? { ...request, voteCount: result.voteCount, voted: result.voted }
                  : request,
              ),
            },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your vote could not be saved.");
      const fresh = await board.fetchBoard().catch(() => null);
      if (fresh !== null) {
        setPresentation(toFeatureBoardPresentation(fresh));
      }
    }
  }

  async function submitRequest() {
    setSubmitting(true);
    setMessage(null);
    try {
      await board.createRequest({ details, title });
      setTitle("");
      setDetails("");
      const fresh = await board.fetchBoard();
      setPresentation(toFeatureBoardPresentation(fresh));
      setMessage("Request submitted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your request could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Link href="/" style={styles.link}>
            ‹ Account
          </Link>
          <Text style={styles.title}>Feature board</Text>
        </View>
        <Text style={styles.detail}>
          Vote on what we build next. Members can submit and vote; maintainers triage status.
        </Text>

        {loading ? <Text style={styles.detail}>Loading requests…</Text> : null}
        {message !== null ? <Text style={styles.error}>{message}</Text> : null}

        {presentation !== null ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Chip
              label={`All (${presentation.totalCount})`}
              onPress={() => setFilter("all")}
              selected={filter === "all"}
            />
            {FEATURE_REQUEST_STATUSES.map((status) => (
              <Chip
                key={status}
                label={`${FEATURE_STATUS_LABELS[status]} (${presentation.statusCounts[status] ?? 0})`}
                onPress={() => setFilter(status)}
                selected={filter === status}
              />
            ))}
          </ScrollView>
        ) : null}

        {visibleRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestRow}>
              <Pressable
                accessibilityLabel={`${request.voted ? "Remove vote for" : "Vote for"} ${request.title}`}
                accessibilityRole="button"
                accessibilityState={{ selected: request.voted }}
                disabled={!presentation?.canWrite}
                onPress={() => void toggleVote(request.id)}
                style={({ pressed }) => [
                  styles.votePill,
                  request.voted ? styles.votePillActive : null,
                  pressed && styles.controlPressed,
                ]}
              >
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.voteCount,
                      request.voted ? styles.voteCountActive : null,
                      pressed && styles.voteCount,
                    ]}
                  >
                    {request.voteCount}
                  </Text>
                )}
              </Pressable>
              <View style={styles.requestBody}>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.badge}>{request.statusLabel}</Text>
                  {request.mine ? <Text style={styles.badge}>Yours</Text> : null}
                </View>
                {request.details.length > 0 ? (
                  <Text style={styles.detail}>{request.details}</Text>
                ) : null}
              </View>
            </View>
          </View>
        ))}

        {presentation !== null && visibleRequests.length === 0 ? (
          <Text style={styles.detail}>No requests in this view yet.</Text>
        ) : null}

        {presentation?.canWrite ? (
          <View style={styles.card}>
            <Text style={styles.subtitle}>Request a feature</Text>
            <TextInput
              accessibilityLabel="Feature title"
              maxLength={200}
              onChangeText={setTitle}
              placeholder="What should we build?"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={title}
            />
            <TextInput
              accessibilityLabel="Feature details"
              maxLength={5000}
              multiline
              onChangeText={setDetails}
              placeholder="Details (optional)"
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.detailsInput]}
              value={details}
            />
            <AppButton
              disabled={submitting || title.trim().length === 0}
              onPress={() => void submitRequest()}
              label="Submit request"
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const styles = useFeedbackStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed && styles.controlPressed,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.chipLabel,
            selected ? styles.chipLabelSelected : null,
            pressed && styles.chipLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function ScreenMessage({ message }: { message: string }) {
  const styles = useFeedbackStyles();
  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.detail}>{message}</Text>
    </SafeAreaView>
  );
}

function useFeedbackStyles() {
  const { palette } = useRequiredMobileApp();
  return useMemo(() => createFeedbackStyles(palette), [palette]);
}

function createFeedbackStyles(palette: ThemePalette) {
  return StyleSheet.create({
    badge: {
      backgroundColor: palette.status.info.soft,
      borderRadius: 6,
      color: palette.status.info.color,
      fontSize: 12,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeRow: { flexDirection: "row", gap: 6, marginTop: 4 },
    card: {
      backgroundColor: palette.canvasRaised,
      borderRadius: 16,
      gap: 8,
      padding: 24,
      width: "100%",
    },
    chip: {
      minHeight: 44,
      justifyContent: "center",
      backgroundColor: palette.canvasRaised,
      borderColor: palette.controlBorder,
      borderRadius: 999,
      borderWidth: 1,
      marginRight: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipLabel: { color: palette.ink, fontSize: 13 },
    controlPressed: { backgroundColor: palette.canvasRaised },
    chipLabelSelected: { color: palette.onSignal, fontWeight: "600" },
    chipRow: { flexGrow: 0, marginVertical: 12 },
    chipSelected: { backgroundColor: palette.signal, borderColor: palette.signal },
    detail: { color: palette.muted, fontSize: 14 },
    detailsInput: { minHeight: 80, textAlignVertical: "top" },
    error: { color: palette.status.danger.color, fontSize: 14, marginVertical: 8 },
    headerRow: { alignItems: "center", flexDirection: "row", gap: 12 },
    input: {
      backgroundColor: palette.canvasRaised,
      borderColor: palette.controlBorder,
      color: palette.ink,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 16,
      padding: 12,
    },
    link: { color: palette.telemetry, fontSize: 16, fontWeight: "600" },
    page: { backgroundColor: palette.canvas, flex: 1 },
    requestBody: { flex: 1, gap: 4 },
    requestCard: {
      backgroundColor: palette.canvasRaised,
      borderRadius: 12,
      marginBottom: 10,
      padding: 14,
      width: "100%",
    },
    requestRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
    requestTitle: { color: palette.ink, fontSize: 16, fontWeight: "600" },
    scroll: { gap: 4, padding: 16 },
    subtitle: { color: palette.ink, fontSize: 18, fontWeight: "600" },
    title: { color: palette.ink, fontSize: 24, fontWeight: "700" },
    voteCount: { color: palette.ink, fontSize: 14, fontWeight: "600" },
    voteCountActive: { color: palette.onSignal },
    votePill: {
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.telemetrySoft,
      borderRadius: 8,
      minWidth: 48,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    votePillActive: { backgroundColor: palette.signal },
  });
}
