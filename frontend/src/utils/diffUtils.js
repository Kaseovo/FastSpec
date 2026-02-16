/**
 * Deep compare two schemas and return detailed differences
 */
function compareSchemas(oldSchema, newSchema) {
  const changes = {
    propertiesAdded: [],
    propertiesRemoved: [],
    propertiesModified: [],
    typeChanged: false,
    oldType: null,
    newType: null,
    requiredChanged: false,
    requiredAdded: [],
    requiredRemoved: [],
    enumChanged: false,
    formatChanged: false,
    validationChanged: [],
  };

  if (!oldSchema && !newSchema) return null;
  if (!oldSchema || !newSchema) return { typeChanged: true };

  // Check for required field changes
  const oldRequired = oldSchema.required || [];
  const newRequired = newSchema.required || [];
  if (JSON.stringify(oldRequired) !== JSON.stringify(newRequired)) {
    changes.requiredChanged = true;
    changes.requiredAdded = newRequired.filter((r) => !oldRequired.includes(r));
    changes.requiredRemoved = oldRequired.filter(
      (r) => !newRequired.includes(r),
    );
  }

  // Check for enum changes
  if (JSON.stringify(oldSchema.enum) !== JSON.stringify(newSchema.enum)) {
    changes.enumChanged = true;
  }

  // Check for format changes
  if (oldSchema.format !== newSchema.format) {
    changes.formatChanged = true;
  }

  // Check for validation rule changes
  const validationFields = [
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "uniqueItems",
  ];
  for (const field of validationFields) {
    if (oldSchema[field] !== newSchema[field]) {
      changes.validationChanged.push({
        field,
        old: oldSchema[field],
        new: newSchema[field],
      });
    }
  }

  // Check if root type changed
  if (oldSchema.type !== newSchema.type) {
    changes.typeChanged = true;
    changes.oldType = oldSchema.type;
    changes.newType = newSchema.type;
  }

  // For object schemas, compare properties
  if (oldSchema.type === "object" && newSchema.type === "object") {
    const oldProps = oldSchema.properties || {};
    const newProps = newSchema.properties || {};
    const allKeys = new Set([
      ...Object.keys(oldProps),
      ...Object.keys(newProps),
    ]);

    for (const key of allKeys) {
      const oldProp = oldProps[key];
      const newProp = newProps[key];

      if (!oldProp && newProp) {
        changes.propertiesAdded.push({ name: key, schema: newProp });
      } else if (oldProp && !newProp) {
        changes.propertiesRemoved.push({ name: key, schema: oldProp });
      } else if (JSON.stringify(oldProp) !== JSON.stringify(newProp)) {
        changes.propertiesModified.push({
          name: key,
          old: oldProp,
          new: newProp,
        });
      }
    }
  }

  // For array schemas, compare items schema
  if (oldSchema.type === "array" && newSchema.type === "array") {
    const oldItems = oldSchema.items || {};
    const newItems = newSchema.items || {};

    if (oldItems.type === "object" && newItems.type === "object") {
      const oldProps = oldItems.properties || {};
      const newProps = newItems.properties || {};
      const allKeys = new Set([
        ...Object.keys(oldProps),
        ...Object.keys(newProps),
      ]);

      for (const key of allKeys) {
        const oldProp = oldProps[key];
        const newProp = newProps[key];

        if (!oldProp && newProp) {
          changes.propertiesAdded.push({ name: key, schema: newProp });
        } else if (oldProp && !newProp) {
          changes.propertiesRemoved.push({ name: key, schema: oldProp });
        } else if (JSON.stringify(oldProp) !== JSON.stringify(newProp)) {
          changes.propertiesModified.push({
            name: key,
            old: oldProp,
            new: newProp,
          });
        }
      }
    }
  }

  // Return null if no changes detected
  if (
    !changes.typeChanged &&
    !changes.requiredChanged &&
    !changes.enumChanged &&
    !changes.formatChanged &&
    changes.propertiesAdded.length === 0 &&
    changes.propertiesRemoved.length === 0 &&
    changes.propertiesModified.length === 0 &&
    changes.validationChanged.length === 0
  ) {
    return null;
  }

  return changes;
}

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
    schemaAdded: [],
    schemaModified: [],
    schemaRemoved: [],
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

  // Check OpenAPI root version (e.g. 3.0.0 -> 3.1.0)
  if (original.openapi !== current.openapi) {
    diff.infoModified.push({
      key: "openapi",
      old: original.openapi || "",
      new: current.openapi || "",
    });
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
      // Added path - capture all details
      for (const method of Object.keys(currentPath)) {
        if (method === "parameters" || method === "servers") continue;
        const endpoint = currentPath[method];
        diff.added.push({
          path,
          method: method.toUpperCase(),
          summary: endpoint?.summary || "",
          description: endpoint?.description || "",
          tags: endpoint?.tags || [],
          operationId: endpoint?.operationId || "",
          deprecated: endpoint?.deprecated || false,
          parameters: endpoint?.parameters || [],
          requestBody: endpoint?.requestBody || null,
          responses: endpoint?.responses || {},
          security: endpoint?.security || [],
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
          description: originalPath[method]?.description || "",
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
          // Method added to existing path - capture all details
          diff.added.push({
            path,
            method: method.toUpperCase(),
            summary: currentMethod?.summary || "",
            description: currentMethod?.description || "",
            tags: currentMethod?.tags || [],
            operationId: currentMethod?.operationId || "",
            deprecated: currentMethod?.deprecated || false,
            parameters: currentMethod?.parameters || [],
            requestBody: currentMethod?.requestBody || null,
            responses: currentMethod?.responses || {},
            security: currentMethod?.security || [],
          });
        } else if (originalMethod && !currentMethod) {
          // Method removed from existing path
          diff.removed.push({
            path,
            method: method.toUpperCase(),
            summary: originalMethod?.summary || "",
            description: originalMethod?.description || "",
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
            const oldParams = originalMethod?.parameters || [];
            const newParams = currentMethod?.parameters || [];

            const paramChanges = {
              added: [],
              removed: [],
              modified: [],
            };

            // Create maps for easier comparison
            const oldParamMap = new Map(
              oldParams.map((p) => [p.name + p.in, p]),
            );
            const newParamMap = new Map(
              newParams.map((p) => [p.name + p.in, p]),
            );

            // Find added and modified parameters
            for (const [key, newParam] of newParamMap) {
              const oldParam = oldParamMap.get(key);
              if (!oldParam) {
                paramChanges.added.push(newParam);
              } else if (
                JSON.stringify(oldParam) !== JSON.stringify(newParam)
              ) {
                paramChanges.modified.push({
                  name: newParam.name,
                  in: newParam.in,
                  old: oldParam,
                  new: newParam,
                });
              }
            }

            // Find removed parameters
            for (const [key, oldParam] of oldParamMap) {
              if (!newParamMap.has(key)) {
                paramChanges.removed.push(oldParam);
              }
            }

            if (
              paramChanges.added.length > 0 ||
              paramChanges.removed.length > 0 ||
              paramChanges.modified.length > 0
            ) {
              changes.push(
                `Parameters: ${paramChanges.added.length} added, ${paramChanges.modified.length} modified, ${paramChanges.removed.length} removed`,
              );
              details.parameters = paramChanges;
            }
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

  // Compare components.schemas section
  const originalSchemas = original.components?.schemas || {};
  const currentSchemas = current.components?.schemas || {};

  const allSchemaNames = new Set([
    ...Object.keys(originalSchemas),
    ...Object.keys(currentSchemas),
  ]);

  for (const schemaName of allSchemaNames) {
    const oldSchema = originalSchemas[schemaName];
    const newSchema = currentSchemas[schemaName];

    if (!oldSchema && newSchema) {
      // Schema added
      diff.schemaAdded.push({
        name: schemaName,
        schema: newSchema,
      });
    } else if (oldSchema && !newSchema) {
      // Schema removed
      diff.schemaRemoved.push({
        name: schemaName,
        schema: oldSchema,
      });
    } else if (JSON.stringify(oldSchema) !== JSON.stringify(newSchema)) {
      // Schema modified - get detailed changes
      const schemaChanges = compareSchemas(oldSchema, newSchema);
      if (schemaChanges) {
        diff.schemaModified.push({
          name: schemaName,
          ...schemaChanges,
        });
      }
    }
  }

  return diff;
}

/**
 * Adapter for backend compare payloads. Backend returns { base, compare, diff }
 * while some code may pass the raw diff object. This returns the diff object
 * in either case.
 */
export function adaptBackendDiff(payload) {
  if (!payload) return {};
  if (payload.diff) return payload.diff;
  return payload;
}
