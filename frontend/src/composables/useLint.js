import { ref } from "vue";
import { lintSpec, lintSpecById } from "../api/specs";

export function useLint({ specContentRef, currentSpecRef } = {}) {
  const lintResults = ref(null);
  const lintLoading = ref(false);
  const lintError = ref(null);

  const runLint = async () => {
    lintLoading.value = true;
    lintError.value = null;
    try {
      let specJson;
      try {
        specJson = JSON.parse(specContentRef.value);
      } catch {
        lintError.value = "Cannot lint: the editor contains invalid JSON.";
        return;
      }

      if (
        currentSpecRef?.value?.id &&
        currentSpecRef.value?.version &&
        currentSpecRef.value.id !== "__unsaved"
      ) {
        lintResults.value = await lintSpecById(
          currentSpecRef.value.id,
          currentSpecRef.value.version,
        );
      } else {
        lintResults.value = await lintSpec(specJson);
      }
    } catch (err) {
      lintError.value =
        err.response?.data?.detail ?? err.message ?? "Lint failed";
    } finally {
      lintLoading.value = false;
    }
  };

  return { lintResults, lintLoading, lintError, runLint };
}
