// Pure, stateless display helpers used by DiffDrawer and its child
// components. Extracted verbatim from DiffDrawer.vue's setup() so behavior
// is unchanged — these functions never read component/prop state, only
// their arguments.

export function getMethodSeverity(method) {
  const m = (method || "").toUpperCase();
  if (m === "GET") return "success";
  if (m === "POST") return "info";
  if (m === "PUT" || m === "PATCH") return "warn";
  if (m === "DELETE") return "danger";
  return "info";
}

export function getResponseSeverity(code) {
  const c = parseInt(code);
  if (c >= 200 && c < 300) return "success";
  if (c >= 300 && c < 400) return "warn";
  if (c >= 400 && c < 500) return "danger";
  if (c >= 500) return "danger";
  return "info";
}

export function getMethodColor(method) {
  const m = (method || "").toUpperCase();
  if (m === "GET") return "#10b981";
  if (m === "POST") return "#3b82f6";
  if (m === "PUT") return "#f59e0b";
  if (m === "PATCH") return "#eab308";
  if (m === "DELETE") return "#ef4444";
  return "#6b7280";
}

export function prettyJSON(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

export function truncate(str, n = 80) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

export function formatFieldName(f) {
  if (!f) return "";
  return String(f).replace(/\./g, " → ");
}

export function getComponentName(ref) {
  if (!ref) return "";
  return ref.split("/").pop();
}

export function cardKey(item, idx) {
  // Use multiple identifying fields and include changeType to avoid
  // Vue reusing DOM nodes between different lists (added vs modified).
  const name = item?.name || item?.key || item?.path || "";
  const method = item?.method || "";
  const type = item?.changeType || "";
  return `${name}-${method}-${type}-${idx}`;
}

export function getFormattedValue(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function getChangeSeverity(changeType) {
  if (changeType === "added") return "success";
  if (changeType === "modified") return "warn";
  if (changeType === "removed") return "danger";
  return "info";
}

export function getPropertyChangeType(item, propName) {
  if (item.changeType !== "modified") return null;
  if (item.propertiesAdded?.some((p) => p.name === propName)) return "+";
  if (item.propertiesRemoved?.some((p) => p.name === propName)) return "-";
  if (item.propertiesModified?.some((p) => p.name === propName)) return "~";
  return null;
}

export function getPropertyChangeClass(item, propName) {
  const change = getPropertyChangeType(item, propName);
  if (change === "+") return "prop-added";
  if (change === "-") return "prop-removed";
  if (change === "~") return "prop-modified";
  return "";
}
