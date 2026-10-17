"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile widget. Render inside a <form> and the widget injects
 * the `cf-turnstile-response` hidden input automatically; pass `onToken` when
 * the caller submits via fetch instead (auth client calls). Tokens are
 * single-use — call `ref.current?.reset()` after each submission to mint a
 * fresh one.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "auto" | "light" | "dark";
}

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: TurnstileRenderOptions): string;
      remove(widgetId: string): void;
      reset(widgetId?: string): void;
    };
  }
}

export interface CaptchaWidgetHandle {
  /** Clears the consumed token and re-arms the widget for the next submit. */
  reset(): void;
}

export interface CaptchaWidgetProps {
  siteKey: string;
  onToken?: (token: string | null) => void;
  theme?: "auto" | "light" | "dark";
}

function ensureTurnstileScript(): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>('script[data-captcha="turnstile"]');
  if (existing) {
    return existing;
  }
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.dataset.captcha = "turnstile";
  document.head.append(script);
  return script;
}

export const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ onToken, siteKey, theme = "auto" }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset() {
        onTokenRef.current?.(null);
        if (widgetIdRef.current !== null) {
          window.turnstile?.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const render = () => {
        if (widgetIdRef.current !== null || !window.turnstile || !container.isConnected) {
          return;
        }
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          theme,
          callback: (token) => onTokenRef.current?.(token),
          "expired-callback": () => onTokenRef.current?.(null),
          "error-callback": () => onTokenRef.current?.(null),
        });
      };

      const script = window.turnstile ? null : ensureTurnstileScript();
      let poll: ReturnType<typeof setInterval> | undefined;
      if (window.turnstile) {
        render();
      } else {
        script?.addEventListener("load", render);
        // Safety net for cached/instant loads that miss the listener.
        poll = setInterval(() => {
          if (window.turnstile) {
            clearInterval(poll);
            poll = undefined;
            render();
          }
        }, 100);
      }

      return () => {
        script?.removeEventListener("load", render);
        if (poll) {
          clearInterval(poll);
        }
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, theme]);

    return <div ref={containerRef} />;
  },
);
