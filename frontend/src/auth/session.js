import axios from "axios";
import { useAuthStore } from "../stores/auth";

// Where the backend sends the browser after OIDC sign-in, with
// #token=… or #error=… in the fragment (see backend/routers/auth.py).
export const SIGN_IN_CALLBACK_PATH = "/specs/auth/callback";

let pendingLocalSession = null;

/**
 * Run once before the app mounts: finish an OIDC redirect if we're on the
 * callback URL, learn how this instance signs in, and in single-user mode
 * make sure there is a session.
 */
export async function bootstrapSession() {
  const auth = useAuthStore();
  await completeSignInRedirect(auth);

  try {
    const { data } = await axios.get("/auth/config");
    auth.setAuthConfig(data);
  } catch (e) {
    console.error("Could not load /auth/config:", e);
    auth.setServerUnreachable(true);
    return;
  }

  if (auth.authMode === "none" && !auth.isAuthenticated) {
    try {
      await startLocalSession();
    } catch (e) {
      console.error("Could not start local session:", e);
      auth.setServerUnreachable(true);
    }
  }
}

async function completeSignInRedirect(auth) {
  if (!window.location.pathname.startsWith(SIGN_IN_CALLBACK_PATH)) return;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  // Get the token out of the address bar and history right away.
  window.history.replaceState(null, "", "/specs/");

  const error = params.get("error");
  const token = params.get("token");
  if (error) {
    auth.setOauthError(error);
    return;
  }
  if (!token) return;

  try {
    const { data: user } = await axios.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    auth.setAuth(token, user);
  } catch (e) {
    console.error("Sign-in callback failed:", e);
    auth.setOauthError("Could not complete sign-in, please try again.");
  }
}

/** Single-user mode: get a session for the implicit local user. */
export function startLocalSession() {
  pendingLocalSession ??= axios
    .post("/auth/local/session")
    .then(({ data }) => {
      useAuthStore().setAuth(data.access_token, data.user);
    })
    .finally(() => {
      pendingLocalSession = null;
    });
  return pendingLocalSession;
}

/** OIDC mode: full-page redirect to the identity provider. */
export function signIn() {
  const auth = useAuthStore();
  window.location.href = auth.loginUrl || "/auth/oidc/login";
}

/**
 * The session is gone (expired, revoked, signed out). The hosted version
 * sends people back to its landing site; self-hosted instances just render
 * the app's own sign-in screen, which AppLayout shows whenever there is no
 * session.
 */
export function handleSignedOut() {
  const landingUrl = import.meta.env.VITE_LANDING_URL;
  if (landingUrl) {
    window.location.href = landingUrl + "/";
  }
}
