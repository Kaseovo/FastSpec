import { ref } from "vue";
import { createSpec, updateSpecVersion, createSpecVersion } from "../api/specs";

export function useSpecSave({
  isAuthenticatedRef,
  specContentRef,
  currentSpecRef,
  initialSpecRef,
  showAlert,
} = {}) {
  const showSaveDialog = ref(false);
  const saving = ref(false);

  const openSaveDialog = () => {
    if (!isAuthenticatedRef?.value) {
      showAlert?.("Please sign in to save your specifications", "warn");
      return false;
    }
    showSaveDialog.value = true;
    return true;
  };

  const saveSpec = async (payloadOrName) => {
    if (!isAuthenticatedRef?.value) {
      showAlert?.("Authentication required to save specifications", "error");
      return;
    }
    saving.value = true;
    try {
      const spec_json = JSON.parse(specContentRef.value);
      // Simplified: if no currentSpecRef, create, otherwise update
      if (!currentSpecRef.value || currentSpecRef.value.id === "__unsaved") {
        const name =
          typeof payloadOrName === "string"
            ? payloadOrName
            : payloadOrName?.name;
        const providedVersionChoice = payloadOrName?.versionChoice;
        const version =
          providedVersionChoice?.version || spec_json.info?.version || "1.0.0";
        const created = await createSpec({ name, version, spec_json });
        currentSpecRef.value = created;
        initialSpecRef.value = JSON.parse(JSON.stringify(spec_json));
        showAlert?.("Spec created successfully!", "success");
      } else {
        // Use updateSpecVersion to update the stored version content instead of the spec-level PUT
        console.log("Payload for saveSpec:", payloadOrName);
        console.log(
          "Payload versionChoice (camelCase):",
          payloadOrName?.versionChoice,
        );
        const name =
          typeof payloadOrName === "string"
            ? payloadOrName
            : payloadOrName?.name || currentSpecRef.value?.name;
        const providedVersionChoice = payloadOrName?.versionChoice;
        const version =
          providedVersionChoice?.version ||
          spec_json.info?.version ||
          currentSpecRef.value?.version ||
          "1.0.0";
        // Payload for version update: include full content and optional meta (use meta to carry spec name)
        let updatedVersion;
        const versionPayload = { version, content: spec_json, meta: { name } };
        if (providedVersionChoice?.action === "create") {
          // Create a new version entry on the server
          updatedVersion = await createSpecVersion(
            currentSpecRef.value.id,
            versionPayload,
          );
        } else {
          // Update existing version
          updatedVersion = await updateSpecVersion(
            currentSpecRef.value.id,
            version,
            versionPayload,
          );
        }
        // Reflect changes onto the current spec object in-place
        currentSpecRef.value.version = updatedVersion.version;
        currentSpecRef.value.name = name;
        // Optionally update cached content
        currentSpecRef.value.spec_json = updatedVersion.content;
        initialSpecRef.value = JSON.parse(JSON.stringify(spec_json));
        showAlert?.("Spec updated successfully!", "success");
      }
      showSaveDialog.value = false;
    } catch (err) {
      console.error(err);
      showAlert?.(err.response?.data?.detail || err.message, "error");
    } finally {
      saving.value = false;
    }
  };

  return { showSaveDialog, openSaveDialog, saveSpec, saving };
}
