import axios from "axios";
import { useAuthStore } from "../stores/auth";
import { handleSignedOut, startLocalSession } from "../auth/session";
import { isDatabaseStarting, waitForDatabase } from "./databaseWake";

/**
 * Axios instance for authenticated backend calls.
 *
 * Attaches the session token. When the database turns out to be asleep, waits
 * for it to wake up (the app shows its waking-up screen meanwhile) and retries
 * the request once — it failed before touching any data. On 401:
 * - single-user mode (AUTH_MODE=none): quietly starts a new local session and
 *   retries the request once — there is nothing for the user to sign in to;
 * - OIDC mode: drops the session so the app shows its sign-in screen.
 */
export function createApiClient(baseURL) {
  const client = axios.create({ baseURL });

  client.interceptors.request.use((config) => {
    const auth = useAuthStore();
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (isDatabaseStarting(error) && !error.config?._wokeDatabase) {
        await waitForDatabase();
        return client({ ...error.config, _wokeDatabase: true });
      }
      if (error.response?.status !== 401) throw error;
      const auth = useAuthStore();
      auth.clearAuth();
      if (auth.authMode === "none" && !error.config?._retried) {
        await startLocalSession();
        return client({ ...error.config, _retried: true });
      }
      handleSignedOut();
      throw error;
    },
  );

  return client;
}
