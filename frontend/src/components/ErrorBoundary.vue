<template>
  <div>
    <div v-if="errored" class="error-boundary">
      <p>Something went wrong. Please try again.</p>
      <slot name="fallback" />
    </div>
    <div v-else>
      <slot />
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { useAlerts } from "../composables/useAlerts";

export default {
  name: "ErrorBoundary",
  setup() {
    const errored = ref(false);
    const errorObj = ref(null);
    const { showAlert } = useAlerts();

    function errorCaptured(err, instance, info) {
      errored.value = true;
      errorObj.value = { err, info };
      console.error("[ErrorBoundary] ", err, info);
      try {
        showAlert(err?.message || "Unexpected error", "error");
      } catch (e) {
        console.error("ErrorBoundary: failed to show alert", e);
      }
      // return false to stop propagation
      return false;
    }

    return { errored, errorObj, errorCaptured };
  },
};
</script>

<style scoped>
.error-boundary {
  padding: 1rem;
  border: 1px solid var(--pv-danger-500, #f44336);
  background: #fff4f4;
}
</style>
