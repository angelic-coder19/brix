"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  prompt(): void;
  cancel(): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = SCRIPT;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      loading = null;
      reject(new Error("Google sign-in script failed to load."));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

/** Forgets the One Tap auto-select choice so signing out sticks. */
export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect();
}

/**
 * Shows Google One Tap to signed-out visitors and signs them in to Firebase
 * with the returned Google ID token. Renders nothing.
 */
export default function GoogleOneTap({
  redirectTo,
  onSignedIn,
}: {
  redirectTo?: string;
  onSignedIn?: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const auth = getClientAuth();
    // The demo has no sign-in, so there is nothing for One Tap to do.
    if (!clientId || !auth || process.env.NEXT_PUBLIC_BRIX_DEMO_MODE === "true")
      return;
    let cancelled = false;
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      if (user || cancelled) return;
      void loadScript()
        .then(() => {
          const id = window.google?.accounts.id;
          if (!id || cancelled) return;
          id.initialize({
            client_id: clientId,
            context: "signin",
            auto_select: false,
            cancel_on_tap_outside: true,
            itp_support: true,
            use_fedcm_for_prompt: true,
            callback: async ({ credential }) => {
              try {
                const result = await signInWithCredential(
                  auth,
                  GoogleAuthProvider.credential(credential),
                );
                await fetch("/api/auth/profile", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await result.user.getIdToken()}`,
                  },
                  body: "{}",
                });
                onSignedIn?.();
                if (redirectTo) router.push(redirectTo);
              } catch {
                // The regular "Continue with Google" button still works.
              }
            },
          });
          id.prompt();
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      stop();
      window.google?.accounts.id.cancel();
    };
  }, [redirectTo, onSignedIn, router]);
  return null;
}
