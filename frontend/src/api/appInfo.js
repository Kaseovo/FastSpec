import axios from "axios";
import { reactive } from "vue";

// Public facts about this FastSpec instance, from GET /version.
export const appInfo = reactive({ version: null, sourceUrl: null });

let pending = null;

export function loadAppInfo() {
  pending ??= axios
    .get("/version")
    .then(({ data }) => {
      appInfo.version = data.version;
      appInfo.sourceUrl = data.source_url;
    })
    .catch((e) => {
      console.error("Could not load /version:", e);
      pending = null;
    });
  return pending;
}
