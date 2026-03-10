import { ref, computed } from "vue";
import { fetchOpenApi } from "../api/specs";
import { compareSpecs } from "../utils/diffUtils";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export function useSpecDiff() {
  const copyingFile = ref(false);
  const openapiFileRaw = ref("");
  const openapiBaseline = ref(null);
  const openapiFileDiff = ref({});

  const fetchOpenApiFile = async () => {
    try {
      const data = await fetchOpenApi();
      openapiFileRaw.value = JSON.stringify(data, null, 2);
      if (!openapiBaseline.value) {
        openapiBaseline.value = JSON.parse(JSON.stringify(data));
      }
      openapiFileDiff.value = compareSpecs(openapiBaseline.value || {}, data);
    } catch (err) {
      console.error("Failed fetching openapi.json", err);
      throw err;
    }
  };

  const openapiFileHasChanges = computed(() => {
    const d = openapiFileDiff.value || {};
    return (
      (d.infoAdded?.length || 0) +
        (d.infoModified?.length || 0) +
        (d.infoRemoved?.length || 0) +
        (d.added?.length || 0) +
        (d.modified?.length || 0) +
        (d.removed?.length || 0) +
        (d.schemaAdded?.length || 0) +
        (d.schemaModified?.length || 0) +
        (d.schemaRemoved?.length || 0) >
      0
    );
  });

  const formattedOpenapiFileDiff = computed(() => {
    try {
      return generateMarkdownReport(openapiFileDiff.value || {});
    } catch (e) {
      return JSON.stringify(openapiFileDiff.value || {}, null, 2);
    }
  });

  const copyOpenapiFileDiff = async () => {
    copyingFile.value = true;
    try {
      const md = formattedOpenapiFileDiff.value;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(md);
      } else {
        const t = document.createElement("textarea");
        t.value = md;
        t.style.position = "fixed";
        t.style.left = "-999999px";
        t.style.top = "-999999px";
        document.body.appendChild(t);
        t.focus();
        t.select();
        try {
          document.execCommand("copy");
        } finally {
          t.remove();
        }
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      copyingFile.value = false;
    }
  };

  return {
    copyingFile,
    openapiFileRaw,
    openapiBaseline,
    openapiFileDiff,
    fetchOpenApiFile,
    openapiFileHasChanges,
    formattedOpenapiFileDiff,
    copyOpenapiFileDiff,
  };
}
