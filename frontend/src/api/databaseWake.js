import axios from "axios";
import { reactive } from "vue";

// The hosted version's database sleeps when nobody uses it. The backend
// starts it again as soon as a request finds it asleep, and answers 503 with
// code "database_starting" until it's up (backend/database_wake.py). The app
// then shows a "waking up" screen instead of errors, polls readiness, and
// carries on by itself — nobody needs to know about any of this.

export const READY_URL = "/api/health/ready";
export const POLL_INTERVAL_MS = 5000;
// Starting the database usually takes one to three minutes.
export const SLOW_AFTER_MS = 4 * 60 * 1000;

/** Drives the waking-up screen (WakingScreen.vue). */
export const databaseStatus = reactive({ waking: false, slow: false });

let pending = null;

export function isDatabaseStarting(error) {
  return error?.response?.status === 503 && error.response.data?.code === "database_starting";
}

/**
 * Resolve once the database is up, showing the waking-up screen while it
 * starts. Also resolves when readiness can't be determined (server down, an
 * older backend…): the app's own error handling takes it from there.
 * Concurrent callers share one wait.
 */
export function waitForDatabase() {
  pending ??= poll().finally(() => {
    pending = null;
    databaseStatus.waking = false;
    databaseStatus.slow = false;
  });
  return pending;
}

async function poll() {
  const startedAt = Date.now();
  for (;;) {
    try {
      await axios.get(READY_URL);
      return;
    } catch (error) {
      if (!isDatabaseStarting(error)) return;
    }
    databaseStatus.waking = true;
    databaseStatus.slow = Date.now() - startedAt >= SLOW_AFTER_MS;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
