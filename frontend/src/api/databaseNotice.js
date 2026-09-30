import { reactive } from "vue";

// The hosted version's free database plan can run out for the month, or fill
// up (backend/database.py, describe_database_error). Every screen would show
// its own generic error; instead, the first response that says so puts one
// notice at the top of the app (AppLayout.vue).
export const DATABASE_LIMIT_CODES = ["database_quota_exceeded", "database_storage_full"];

export const databaseNotice = reactive({ code: null, message: null });

/** Record a database-limit error from an API response; ignore anything else. */
export function noteDatabaseLimit(error) {
  const data = error?.response?.data;
  if (DATABASE_LIMIT_CODES.includes(data?.code)) {
    databaseNotice.code = data.code;
    databaseNotice.message = data.detail;
  }
}
