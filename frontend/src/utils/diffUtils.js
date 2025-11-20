/**
 * Compare two OpenAPI specifications and return differences
 */
export function compareSpecs(original, current) {
  const diff = {
    info: null,
    added: [],
    modified: [],
    removed: [],
  };

  // Handle null/undefined cases
  if (!original || !current) {
    return diff;
  }

  // Compare info section
  if (original.info && current.info) {
    const infoChanges = {};
    const infoKeys = new Set([
      ...Object.keys(original.info || {}),
      ...Object.keys(current.info || {}),
    ]);

    for (const key of infoKeys) {
      const oldVal = original.info[key];
      const newVal = current.info[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        infoChanges[key] = {
          old: oldVal,
          new: newVal,
        };
      }
    }

    if (Object.keys(infoChanges).length > 0) {
      diff.info = infoChanges;
    }
  }

  // Compare paths
  const originalPaths = original.paths || {};
  const currentPaths = current.paths || {};

  const allPaths = new Set([
    ...Object.keys(originalPaths),
    ...Object.keys(currentPaths),
  ]);

  for (const path of allPaths) {
    const originalPath = originalPaths[path];
    const currentPath = currentPaths[path];

    if (!originalPath && currentPath) {
      // Added path
      for (const method of Object.keys(currentPath)) {
        if (method === "parameters" || method === "servers") continue;
        diff.added.push({
          path,
          method: method.toUpperCase(),
          summary: currentPath[method]?.summary || "",
        });
      }
    } else if (originalPath && !currentPath) {
      // Removed path
      for (const method of Object.keys(originalPath)) {
        if (method === "parameters" || method === "servers") continue;
        diff.removed.push({
          path,
          method: method.toUpperCase(),
          summary: originalPath[method]?.summary || "",
        });
      }
    } else if (originalPath && currentPath) {
      // Check for modifications
      const allMethods = new Set([
        ...Object.keys(originalPath),
        ...Object.keys(currentPath),
      ]);

      for (const method of allMethods) {
        if (method === "parameters" || method === "servers") continue;

        const originalMethod = originalPath[method];
        const currentMethod = currentPath[method];

        if (!originalMethod && currentMethod) {
          // Method added to existing path
          diff.added.push({
            path,
            method: method.toUpperCase(),
            summary: currentMethod?.summary || "",
          });
        } else if (originalMethod && !currentMethod) {
          // Method removed from existing path
          diff.removed.push({
            path,
            method: method.toUpperCase(),
            summary: originalMethod?.summary || "",
          });
        } else if (
          JSON.stringify(originalMethod) !== JSON.stringify(currentMethod)
        ) {
          // Method modified
          const changes = [];

          if (originalMethod?.summary !== currentMethod?.summary) {
            changes.push("Summary changed");
          }
          if (originalMethod?.description !== currentMethod?.description) {
            changes.push("Description changed");
          }
          if (
            JSON.stringify(originalMethod?.parameters) !==
            JSON.stringify(currentMethod?.parameters)
          ) {
            changes.push("Parameters changed");
          }
          if (
            JSON.stringify(originalMethod?.requestBody) !==
            JSON.stringify(currentMethod?.requestBody)
          ) {
            changes.push("Request body changed");
          }
          if (
            JSON.stringify(originalMethod?.responses) !==
            JSON.stringify(currentMethod?.responses)
          ) {
            changes.push("Responses changed");
          }

          if (changes.length > 0) {
            diff.modified.push({
              path,
              method: method.toUpperCase(),
              summary: currentMethod?.summary || "",
              changes,
            });
          }
        }
      }
    }
  }

  return diff;
}
