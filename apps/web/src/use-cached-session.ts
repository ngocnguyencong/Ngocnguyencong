"use client";
import { useEffect, useMemo, useState } from "react";
import { createWebAuthClient, type WebAuthBrowserClient } from "./web-auth-client";

type Session = ReturnType<WebAuthBrowserClient["useSession"]>["data"];
let browserClient: WebAuthBrowserClient | undefined;
let confirmed: Session | undefined;

/** Undefined means unresolved; null is a confirmed guest. Cache lives only in this browser document. */
export function useCachedSession(): Session | undefined {
  const client = useMemo(() => {
    if (typeof window === "undefined") return createWebAuthClient("");
    return (browserClient ??= createWebAuthClient(""));
  }, []);
  const session = client.useSession();
  const [previous, setPrevious] = useState<Session | undefined>(() => confirmed);
  const resolved = !session.isPending && !session.error;
  useEffect(() => {
    if (resolved) {
      confirmed = session.data;
      setPrevious((value) =>
        value?.user.id === session.data?.user.id &&
        value?.user.email === session.data?.user.email &&
        value?.user.name === session.data?.user.name &&
        (value === null) === (session.data === null)
          ? value
          : session.data,
      );
    }
  }, [resolved, session.data]);
  return resolved ? session.data : previous;
}
