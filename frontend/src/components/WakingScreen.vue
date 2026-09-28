<template>
  <div
    v-if="databaseStatus.waking"
    :class="['waking-screen', { 'waking-screen--overlay': overlay }]"
    role="status"
    aria-live="polite"
  >
    <div class="signed-out-card">
      <i class="pi pi-spin pi-spinner signed-out-icon" aria-hidden="true"></i>
      <h2>FastSpec is waking up</h2>
      <p>
        It sleeps when nobody has used it for a while. Waking up usually takes a
        minute or two, and this page carries on by itself.
      </p>
      <p v-if="databaseStatus.slow">
        This is taking longer than usual. You can keep this page open, or come
        back in a few minutes.
      </p>
    </div>
  </div>
</template>

<script>
import { databaseStatus } from "../api/databaseWake";

// Plain markup only (no PrimeVue components): it is also mounted on its own,
// before the app, while the database wakes up at startup (main.js).
export default {
  name: "WakingScreen",
  props: {
    // Cover the app while it's in use, rather than fill an empty page.
    overlay: { type: Boolean, default: false },
  },
  setup() {
    return { databaseStatus };
  },
};
</script>

<style scoped>
.waking-screen--overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  padding: 20px;
  background: rgb(245 247 250 / 0.92);
}

.waking-screen .signed-out-card p:last-child {
  margin-bottom: 0;
}
</style>
