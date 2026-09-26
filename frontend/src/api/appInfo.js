import axios from "axios";
import { reactive } from "vue";

// Public facts about this FastSpec instance, from GET /api/version (the /api
// prefix is what the dev proxy, the front door and CloudFront all route).
export const appInfo = reactive({ version: null, sourceUrl: null });

let pending = null;

export function loadAppInfo() {
  pending ??= axios
    .get("/api/version")
    .then(({ data }) => {
      appInfo.version = data.version;
      appInfo.sourceUrl = data.source_url;
    })
    .catch((e) => {
      console.error("Could not load /api/version:", e);
      pending = null;
    });
  return pending;
}
