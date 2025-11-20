/**
 * Compare two OpenAPI specifications and return differences
 */
export function compareSpecs(original, current) {
  const diff = {
    infoAdded: [],
    infoModified: [],
    infoRemoved: [],
    added: [],
    modified: [],
    removed: [],
  };

  // Handle null/undefined cases
  if (!original || !current) {
    return diff;
  }

  // Compare info section
  if (original.info || current.info) {
    const originalInfo = original.info || {};
    const currentInfo = current.info || {};

    const infoKeys = new Set([
      ...Object.keys(originalInfo),
      ...Object.keys(currentInfo),
    ]);

    for (const key of infoKeys) {
      const oldVal = originalInfo[key];
      const newVal = currentInfo[key];

      // Check if value exists and is not empty
      const hasOld = oldVal !== undefined && oldVal !== null && oldVal !== "";
      const hasNew = newVal !== undefined && newVal !== null && newVal !== "";

      if (!hasOld && hasNew) {
        // Added
        diff.infoAdded.push({ key, value: newVal });
      } else if (hasOld && !hasNew) {
        // Removed
        diff.infoRemoved.push({ key, value: oldVal });
      } else if (
        hasOld &&
        hasNew &&
        JSON.stringify(oldVal) !== JSON.stringify(newVal)
      ) {
        // Modified
        diff.infoModified.push({ key, old: oldVal, new: newVal });
      }
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
          // Method modified - collect detailed changes
          const changes = [];
          const details = {};

          if (originalMethod?.summary !== currentMethod?.summary) {
            changes.push("Summary changed");
            details.summary = {
              old: originalMethod?.summary || "",
              new: currentMethod?.summary || "",
            };
          }
          if (originalMethod?.description !== currentMethod?.description) {
            changes.push("Description changed");
            details.description = {
              old: originalMethod?.description || "",
              new: currentMethod?.description || "",
            };
          }
          if (originalMethod?.operationId !== currentMethod?.operationId) {
            changes.push("Operation ID changed");
            details.operationId = {
              old: originalMethod?.operationId || "",
              new: currentMethod?.operationId || "",
            };
          }
          if (
            JSON.stringify(originalMethod?.tags) !==
            JSON.stringify(currentMethod?.tags)
          ) {
            changes.push("Tags changed");
            details.tags = {
              old: originalMethod?.tags || [],
              new: currentMethod?.tags || [],
            };
          }
          if (originalMethod?.deprecated !== currentMethod?.deprecated) {
            changes.push("Deprecation status changed");
            details.deprecated = {
              old: originalMethod?.deprecated || false,
              new: currentMethod?.deprecated || false,
            };
          }
          if (
            JSON.stringify(originalMethod?.parameters) !==
            JSON.stringify(currentMethod?.parameters)
          ) {
            changes.push("Parameters changed");
            details.parameters = {
              old: originalMethod?.parameters || [],
              new: currentMethod?.parameters || [],
            };
          }
          if (
            JSON.stringify(originalMethod?.requestBody) !==
            JSON.stringify(currentMethod?.requestBody)
          ) {
            changes.push("Request body changed");
            details.requestBody = {
              old: originalMethod?.requestBody || null,
              new: currentMethod?.requestBody || null,
            };
          }
          if (
            JSON.stringify(originalMethod?.responses) !==
            JSON.stringify(currentMethod?.responses)
          ) {
            changes.push("Responses changed");

            // Detailed response comparison by status code
            const oldResponses = originalMethod?.responses || {};
            const newResponses = currentMethod?.responses || {};
            const allStatusCodes = new Set([
              ...Object.keys(oldResponses),
              ...Object.keys(newResponses),
            ]);

            const responseChanges = {
              added: [],
              modified: [],
              removed: [],
            };

            for (const statusCode of allStatusCodes) {
              const oldResponse = oldResponses[statusCode];
              const newResponse = newResponses[statusCode];

              if (!oldResponse && newResponse) {
                responseChanges.added.push({
                  statusCode,
                  response: newResponse,
                });
              } else if (oldResponse && !newResponse) {
                responseChanges.removed.push({
                  statusCode,
                  response: oldResponse,
                });
              } else if (
                JSON.stringify(oldResponse) !== JSON.stringify(newResponse)
              ) {
                responseChanges.modified.push({
                  statusCode,
                  old: oldResponse,
                  new: newResponse,
                });
              }
            }

            details.responses = responseChanges;
          }
          if (
            JSON.stringify(originalMethod?.security) !==
            JSON.stringify(currentMethod?.security)
          ) {
            changes.push("Security requirements changed");
            details.security = {
              old: originalMethod?.security || [],
              new: currentMethod?.security || [],
            };
          }

          if (changes.length > 0) {
            diff.modified.push({
              path,
              method: method.toUpperCase(),
              summary: currentMethod?.summary || "",
              changes,
              details,
            });
          }
        }
      }
    }
  }

  return diff;
}
