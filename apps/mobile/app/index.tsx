import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { Redirect } from "expo-router";

import type { MobileAuthResponse } from "../src/auth/actions";
import { useMobileApp, useRequiredMobileApp } from "../src/session/provider";
import { AppButton, AppInput, Card, Detail, ErrorText, H1 } from "../src/ui/screen";

export default function EntryScreen() {
  const app = useMobileApp();

  if (!app) {
    return (
      <SafeAreaView style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <Text>Set EXPO_PUBLIC_API_URL before signing in.</Text>
      </SafeAreaView>
    );
  }

  const { session, styles } = app;
  if (session.isPending) {
    return (
      <SafeAreaView style={[styles.page, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.detail}>Restoring your secure session…</Text>
      </SafeAreaView>
    );
  }

  if (session.data) {
    return <Redirect href="/home" />;
  }

  return <SignInScreen />;
}

function SignInScreen() {
  const { actions, palette, session, styles } = useRequiredMobileApp();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(action: () => Promise<MobileAuthResponse>, success: string) {
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await action();
      if (response.error) {
        setMessage(response.error.message ?? "Something went wrong.");
        return false;
      }
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete authentication.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Card>
          <H1>Sign in</H1>
          <AppInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            value={email}
          />
          {!otpSent ? (
            <AppButton
              disabled={submitting || email.trim() === ""}
              label="Email me a code"
              onPress={() => {
                void submit(
                  () => actions.requestEmailOtp(email),
                  "Check your email for a code.",
                ).then((ok) => {
                  if (ok) setOtpSent(true);
                });
              }}
            />
          ) : (
            <>
              <AppInput
                accessibilityLabel="Email code"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                onChangeText={setOtp}
                placeholder="123456"
                value={otp}
              />
              <AppButton
                disabled={submitting || otp.trim() === ""}
                label="Verify code"
                onPress={() => {
                  void submit(() => actions.verifyEmailOtp(email, otp), "Signed in.");
                }}
              />
            </>
          )}
          <AppButton
            disabled={submitting}
            label="Continue with Google"
            onPress={() => {
              void submit(actions.signInWithGoogle, "Signed in.");
            }}
            variant="outline"
          />
          <AppButton
            disabled={submitting}
            label="Continue with Apple"
            onPress={() => {
              void submit(actions.signInWithApple, "Signed in.");
            }}
            variant="outline"
          />
          {message ? <Detail>{message}</Detail> : null}
          {session.error ? <ErrorText>{session.error.message}</ErrorText> : null}
        </Card>
        <Text style={{ color: palette.muted, fontSize: 12, marginTop: 12, textAlign: "center" }}>
          Supastack
        </Text>
      </View>
    </SafeAreaView>
  );
}
