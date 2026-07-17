// Pure helpers extracted from FormEditor.vue's setup(). None of these read
// or write component state (refs, formData, confirm/toast) — they only
// operate on their arguments — so they were safe to relocate verbatim
// without any risk of changing behavior.

// Helper: normalize $ref properties on load for form editing
export const normalizeRefsForForm = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  if (obj.components && obj.components.schemas) {
    for (const schemaName of Object.keys(obj.components.schemas)) {
      const schema = obj.components.schemas[schemaName];
      if (schema.properties) {
        for (const propName of Object.keys(schema.properties)) {
          const prop = schema.properties[propName];
          if (prop.$ref && !prop.type) {
            prop.type = "$ref";
          }
          if (
            prop.type === "array" &&
            prop.items &&
            prop.items.$ref &&
            !prop.items.type
          ) {
            prop.items.type = "$ref";
          }
        }
      }
      if (
        schema.type === "array" &&
        schema.items &&
        schema.items.$ref &&
        !schema.items.type
      ) {
        schema.items.type = "$ref";
      }
    }
  }
  // Normalize param items: flat or oneOf → _itemSchemas
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.parameters) continue;
        for (const param of op.parameters) {
          if (param.schema && param.schema.type === "array") {
            const items = param.schema.items;
            const toItemSchema = (s) => {
              if (s.$ref) return { type: "object", $ref: s.$ref };
              const schema = { type: s.type || "string" };
              if (s.format !== undefined) schema.format = s.format;
              if (s.pattern !== undefined) schema.pattern = s.pattern;
              if (s.minLength !== undefined) schema.minLength = s.minLength;
              if (s.maxLength !== undefined) schema.maxLength = s.maxLength;
              if (s.minimum !== undefined) schema.minimum = s.minimum;
              if (s.maximum !== undefined) schema.maximum = s.maximum;
              if (s.multipleOf !== undefined) schema.multipleOf = s.multipleOf;
              if (s.exclusiveMinimum !== undefined)
                schema.exclusiveMinimum = s.exclusiveMinimum;
              if (s.exclusiveMaximum !== undefined)
                schema.exclusiveMaximum = s.exclusiveMaximum;
              return schema;
            };
            if (items && items.oneOf) {
              param.schema._itemSchemas = items.oneOf.map(toItemSchema);
            } else if (items) {
              param.schema._itemSchemas = [toItemSchema(items)];
            } else {
              param.schema._itemSchemas = [];
            }
          }
        }
      }
    }
  }
  // Normalize $ref props and array _itemSchemas in inline request body schemas
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.requestBody || !op.requestBody.content) continue;
        for (const ct of Object.values(op.requestBody.content)) {
          const schema = ct && ct.schema;
          if (!schema) continue;
          // Normalize $ref properties
          if (schema.properties) {
            for (const propName of Object.keys(schema.properties)) {
              const prop = schema.properties[propName];
              if (prop.$ref && !prop.type) prop.type = "$ref";
              if (
                prop.type === "array" &&
                prop.items &&
                prop.items.$ref &&
                !prop.items.type
              ) {
                prop.items.type = "$ref";
              }
            }
          }
          // Normalize array _itemSchemas
          if (schema.type === "array") {
            const items = schema.items;
            const toItemSchema = (s) => {
              if (s.$ref) return { type: "object", $ref: s.$ref };
              const out = { type: s.type || "string" };
              [
                "format",
                "pattern",
                "minLength",
                "maxLength",
                "minimum",
                "maximum",
                "multipleOf",
                "exclusiveMinimum",
                "exclusiveMaximum",
              ].forEach((k) => {
                if (s[k] !== undefined) out[k] = s[k];
              });
              return out;
            };
            if (items && items.oneOf) {
              schema._itemSchemas = items.oneOf.map(toItemSchema);
            } else if (items) {
              schema._itemSchemas = [toItemSchema(items)];
            } else {
              schema._itemSchemas = [];
            }
          }
        }
      }
    }
  }
  // Normalize $ref props and array _itemSchemas in inline response schemas
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.responses) continue;
        for (const resp of Object.values(op.responses)) {
          if (!resp || !resp.content) continue;
          for (const ct of Object.values(resp.content)) {
            const schema = ct && ct.schema;
            if (!schema) continue;
            if (schema.properties) {
              for (const propName of Object.keys(schema.properties)) {
                const prop = schema.properties[propName];
                if (prop.$ref && !prop.type) prop.type = "$ref";
                if (
                  prop.type === "array" &&
                  prop.items &&
                  prop.items.$ref &&
                  !prop.items.type
                ) {
                  prop.items.type = "$ref";
                }
              }
            }
            if (schema.type === "array") {
              const items = schema.items;
              const toItemSchema = (s) => {
                if (s.$ref) return { type: "object", $ref: s.$ref };
                const out = { type: s.type || "string" };
                [
                  "format",
                  "pattern",
                  "minLength",
                  "maxLength",
                  "minimum",
                  "maximum",
                  "multipleOf",
                  "exclusiveMinimum",
                  "exclusiveMaximum",
                ].forEach((k) => {
                  if (s[k] !== undefined) out[k] = s[k];
                });
                return out;
              };
              if (items && items.oneOf) {
                schema._itemSchemas = items.oneOf.map(toItemSchema);
              } else if (items) {
                schema._itemSchemas = [toItemSchema(items)];
              } else {
                schema._itemSchemas = [];
              }
            }
          }
        }
      }
    }
  }
  return obj;
};

// Helper: clean $ref properties on emit for valid OpenAPI output
export const cleanRefsForOutput = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  if (obj.components && obj.components.schemas) {
    for (const schemaName of Object.keys(obj.components.schemas)) {
      const schema = obj.components.schemas[schemaName];
      if (schema.properties) {
        for (const propName of Object.keys(schema.properties)) {
          const prop = schema.properties[propName];
          if (prop.type === "$ref") {
            const ref = prop.$ref || "";
            schema.properties[propName] = { $ref: ref };
          } else if (
            prop.type === "array" &&
            prop.items &&
            prop.items.type === "$ref"
          ) {
            const ref = prop.items.$ref || "";
            prop.items = { $ref: ref };
          }
        }
      }
      if (
        schema.type === "array" &&
        schema.items &&
        schema.items.type === "$ref"
      ) {
        const ref = schema.items.$ref || "";
        schema.items = { $ref: ref };
      }
    }
  }
  // Clean param items: _itemSchemas → flat or oneOf
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.parameters) continue;
        for (const param of op.parameters) {
          if (param.schema && param.schema.type === "array") {
            const schemas = param.schema._itemSchemas || [];
            delete param.schema._itemSchemas;
            const toOutput = (s) => {
              if (s.type === "object")
                return s.$ref ? { $ref: s.$ref } : { type: "object" };
              const out = { type: s.type };
              if (s.format) out.format = s.format;
              if (s.pattern) out.pattern = s.pattern;
              if (s.minLength != null) out.minLength = s.minLength;
              if (s.maxLength != null) out.maxLength = s.maxLength;
              if (s.minimum != null) out.minimum = s.minimum;
              if (s.maximum != null) out.maximum = s.maximum;
              if (s.multipleOf != null) out.multipleOf = s.multipleOf;
              if (s.exclusiveMinimum != null)
                out.exclusiveMinimum = s.exclusiveMinimum;
              if (s.exclusiveMaximum != null)
                out.exclusiveMaximum = s.exclusiveMaximum;
              return out;
            };
            if (schemas.length === 0) {
              // No item types chosen yet — omit items to avoid feeding 'string' back into the form via normalizeRefsForForm.
              // Swagger UI will still render the parameter; user must pick a type to get "Add item" working.
              delete param.schema.items;
            } else if (schemas.length === 1) {
              param.schema.items = toOutput(schemas[0]);
            } else {
              param.schema.items = { oneOf: schemas.map(toOutput) };
            }
          }
        }
      }
    }
  }
  // Clean $ref props and _itemSchemas in inline request body schemas
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.requestBody || !op.requestBody.content) continue;
        for (const ct of Object.values(op.requestBody.content)) {
          const schema = ct && ct.schema;
          if (!schema) continue;
          // Clean $ref properties
          if (schema.properties) {
            for (const propName of Object.keys(schema.properties)) {
              const prop = schema.properties[propName];
              if (prop.type === "$ref") {
                const ref = prop.$ref || "";
                schema.properties[propName] = { $ref: ref };
              } else if (
                prop.type === "array" &&
                prop.items &&
                prop.items.type === "$ref"
              ) {
                prop.items = { $ref: prop.items.$ref || "" };
              }
            }
          }
          // Clean array _itemSchemas
          if (schema.type === "array") {
            const schemas = schema._itemSchemas || [];
            delete schema._itemSchemas;
            const toOutput = (s) => {
              if (s.type === "object")
                return s.$ref ? { $ref: s.$ref } : { type: "object" };
              const out = { type: s.type };
              [
                "format",
                "pattern",
                "minLength",
                "maxLength",
                "minimum",
                "maximum",
                "multipleOf",
                "exclusiveMinimum",
                "exclusiveMaximum",
              ].forEach((k) => {
                if (s[k] != null) out[k] = s[k];
              });
              return out;
            };
            if (schemas.length === 0) {
              delete schema.items;
            } else if (schemas.length === 1) {
              schema.items = toOutput(schemas[0]);
            } else {
              schema.items = { oneOf: schemas.map(toOutput) };
            }
          }
        }
      }
    }
  }
  // Clean $ref props and _itemSchemas in inline response schemas
  if (obj.paths) {
    for (const path of Object.values(obj.paths)) {
      for (const op of Object.values(path)) {
        if (!op || !op.responses) continue;
        for (const resp of Object.values(op.responses)) {
          if (!resp || !resp.content) continue;
          for (const ct of Object.values(resp.content)) {
            const schema = ct && ct.schema;
            if (!schema) continue;
            // Clean $ref properties
            if (schema.properties) {
              for (const propName of Object.keys(schema.properties)) {
                const prop = schema.properties[propName];
                if (prop.type === "$ref") {
                  schema.properties[propName] = { $ref: prop.$ref || "" };
                } else if (
                  prop.type === "array" &&
                  prop.items &&
                  prop.items.type === "$ref"
                ) {
                  prop.items = { $ref: prop.items.$ref || "" };
                }
              }
            }
            // Clean array _itemSchemas
            if (schema.type === "array") {
              const schemas = schema._itemSchemas || [];
              delete schema._itemSchemas;
              const toOutput = (s) => {
                if (s.type === "object")
                  return s.$ref ? { $ref: s.$ref } : { type: "object" };
                const out = { type: s.type };
                [
                  "format",
                  "pattern",
                  "minLength",
                  "maxLength",
                  "minimum",
                  "maximum",
                  "multipleOf",
                  "exclusiveMinimum",
                  "exclusiveMaximum",
                ].forEach((k) => {
                  if (s[k] != null) out[k] = s[k];
                });
                return out;
              };
              if (schemas.length === 0) {
                delete schema.items;
              } else if (schemas.length === 1) {
                schema.items = toOutput(schemas[0]);
              } else {
                schema.items = { oneOf: schemas.map(toOutput) };
              }
            }
          }
        }
      }
    }
  }
  return obj;
};

export const extractPathParams = (path) => {
  const matches = path.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1));
};

export const isParamContentFilled = (param) => {
  if (!param) return false;
  return !!(
    param.description ||
    param.schema?.format ||
    param.schema?.example ||
    param.schema?.pattern ||
    param.schema?.enum?.length ||
    param.schema?.default !== undefined
  );
};

export const buildPathParam = (name) => ({
  name,
  in: "path",
  description: "",
  required: true,
  schema: { type: "string" },
});

/**
 * Syncs path parameters for a single method after a path template change.
 * - Adds param entries for newly introduced tokens.
 * - Removes entries for dropped tokens (calls onRemove for content-filled ones).
 * - Preserves existing param definitions for surviving tokens.
 * Returns a list of params-to-remove that have content (so caller can confirm).
 */
export const computePathParamDiff = (method, oldParamNames, newParamNames) => {
  const existing = method.parameters || [];
  const toAdd = newParamNames.filter(
    (n) =>
      !oldParamNames.includes(n) &&
      !existing.find((p) => p.in === "path" && p.name === n)
  );
  const toRemove = oldParamNames.filter((n) => !newParamNames.includes(n));
  const filledRemovals = toRemove
    .map((n) => existing.find((p) => p.in === "path" && p.name === n))
    .filter((p) => p && isParamContentFilled(p));
  return { toAdd, toRemove, filledRemovals };
};

export const getMethodSeverity = (method) => {
  const severityMap = {
    get: "info",
    post: "success",
    put: "warn",
    patch: "warn",
    delete: "danger",
    options: "secondary",
    head: "secondary",
  };
  return severityMap[method.toLowerCase()] || "secondary";
};

export const getMethodDescription = (method) => {
  const descriptions = {
    get: "Retrieve data",
    post: "Create new resource",
    put: "Update entire resource",
    patch: "Partial update",
    delete: "Remove resource",
    options: "Describe options",
    head: "Get headers only",
  };
  return descriptions[method.toLowerCase()] || "";
};

export const getStatusSeverity = (statusCode) => {
  const code = parseInt(statusCode);
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "info";
  if (code >= 400 && code < 500) return "warn";
  if (code >= 500) return "danger";
  return "secondary";
};

// ── HTTP Status Code data ────────────────────────────────────────────────

export const statusCodeCategories = [
  { value: "2xx", label: "2xx Success", description: "Request succeeded" },
  {
    value: "3xx",
    label: "3xx Redirection",
    description: "Further action needed",
  },
  {
    value: "4xx",
    label: "4xx Client Error",
    description: "Request has an issue",
  },
  {
    value: "5xx",
    label: "5xx Server Error",
    description: "Server failed to fulfill",
  },
];

export const allStatusCodes = {
  "2xx": [
    { code: 200, name: "OK", hint: "Standard success response" },
    { code: 201, name: "Created", hint: "Resource was created" },
    {
      code: 202,
      name: "Accepted",
      hint: "Request accepted, processing deferred",
    },
    { code: 204, name: "No Content", hint: "Success with no response body" },
    { code: 206, name: "Partial Content", hint: "Range request fulfilled" },
    {
      code: 207,
      name: "Multi-Status",
      hint: "Multiple status codes (WebDAV)",
    },
    {
      code: 208,
      name: "Already Reported",
      hint: "Already enumerated (WebDAV)",
    },
    { code: 226, name: "IM Used", hint: "Deferred GET fulfilled" },
  ],
  "3xx": [
    {
      code: 301,
      name: "Moved Permanently",
      hint: "Resource moved permanently",
    },
    { code: 302, name: "Found", hint: "Temporary redirect" },
    { code: 303, name: "See Other", hint: "Redirect with GET" },
    { code: 304, name: "Not Modified", hint: "Cache is still valid" },
    {
      code: 307,
      name: "Temporary Redirect",
      hint: "Temporary redirect, same method",
    },
    {
      code: 308,
      name: "Permanent Redirect",
      hint: "Permanent redirect, same method",
    },
  ],
  "4xx": [
    { code: 400, name: "Bad Request", hint: "Malformed request syntax" },
    { code: 401, name: "Unauthorized", hint: "Authentication required" },
    { code: 402, name: "Payment Required", hint: "Quota or billing error" },
    {
      code: 403,
      name: "Forbidden",
      hint: "Authenticated but not authorised",
    },
    { code: 404, name: "Not Found", hint: "Resource does not exist" },
    {
      code: 405,
      name: "Method Not Allowed",
      hint: "HTTP method not supported",
    },
    { code: 406, name: "Not Acceptable", hint: "No acceptable content type" },
    { code: 408, name: "Request Timeout", hint: "Client took too long" },
    { code: 409, name: "Conflict", hint: "State conflict (e.g. duplicate)" },
    { code: 410, name: "Gone", hint: "Resource deleted permanently" },
    {
      code: 411,
      name: "Length Required",
      hint: "Content-Length header missing",
    },
    {
      code: 412,
      name: "Precondition Failed",
      hint: "Conditional request failed",
    },
    { code: 413, name: "Content Too Large", hint: "Payload exceeds limit" },
    {
      code: 415,
      name: "Unsupported Media Type",
      hint: "Content-Type not supported",
    },
    { code: 416, name: "Range Not Satisfiable", hint: "Range header invalid" },
    { code: 422, name: "Unprocessable Entity", hint: "Validation failed" },
    { code: 423, name: "Locked", hint: "Resource is locked (WebDAV)" },
    { code: 424, name: "Failed Dependency", hint: "Depends on failed action" },
    { code: 425, name: "Too Early", hint: "Replay attack risk" },
    { code: 426, name: "Upgrade Required", hint: "Switch protocol required" },
    {
      code: 428,
      name: "Precondition Required",
      hint: "Conditional request required",
    },
    { code: 429, name: "Too Many Requests", hint: "Rate limit exceeded" },
    {
      code: 451,
      name: "Unavailable For Legal Reasons",
      hint: "Censored content",
    },
  ],
  "5xx": [
    { code: 500, name: "Internal Server Error", hint: "Generic server error" },
    { code: 501, name: "Not Implemented", hint: "Method not implemented" },
    {
      code: 502,
      name: "Bad Gateway",
      hint: "Upstream returned bad response",
    },
    { code: 503, name: "Service Unavailable", hint: "Server temporarily down" },
    { code: 504, name: "Gateway Timeout", hint: "Upstream timed out" },
    { code: 507, name: "Insufficient Storage", hint: "No storage left (WebDAV)" },
    { code: 508, name: "Loop Detected", hint: "Infinite loop detected" },
    {
      code: 511,
      name: "Network Authentication Required",
      hint: "Network auth needed",
    },
  ],
};

export const statusCodesForCategory = (cat) => allStatusCodes[cat] || [];

export const getStatusName = (code) => {
  for (const codes of Object.values(allStatusCodes)) {
    const found = codes.find((e) => String(e.code) === String(code));
    if (found) return found.name;
  }
  return "";
};

// ── Response content/schema editing ──────────────────────────────────────
// Pure functions operating only on a passed-in `response` object — the same
// shape whether it's an inline operation response
// (formData.paths[p][m].responses[code]) or a reusable one
// (formData.components.responses[name]), so both usePathsEditor and
// useReusableComponentsEditor share these instead of each reimplementing
// content-type/schema-reference switching logic.
export const getResponseContentType = (response) => {
  if (!response.content) return "";
  return Object.keys(response.content)[0] || "";
};

export const setResponseContentType = (response, contentType) => {
  if (!response.content) response.content = {};
  const oldContent = response.content;
  response.content = {};
  if (contentType) {
    response.content[contentType] = oldContent[Object.keys(oldContent)[0]] || {
      schema: { type: "object" },
    };
  }
};

export const getResponseSchemaType = (response) => {
  const contentType = getResponseContentType(response);
  if (!contentType || !response.content[contentType]?.schema) return "inline";
  const schema = response.content[contentType].schema;
  // Use hasOwnProperty so { $ref: "" } (empty ref) is still detected as reference
  return Object.prototype.hasOwnProperty.call(schema, "$ref")
    ? "reference"
    : "inline";
};

export const setResponseSchemaType = (response, type) => {
  const contentType = getResponseContentType(response);
  if (!contentType) return;
  if (!response.content[contentType]) response.content[contentType] = {};

  if (type === "reference") {
    response.content[contentType].schema = { $ref: "" };
  } else {
    response.content[contentType].schema = { type: "object", properties: {} };
  }
};

export const getResponseSchemaRef = (response) => {
  const contentType = getResponseContentType(response);
  if (!contentType) return "";
  return response.content[contentType]?.schema?.$ref || "";
};

export const setResponseSchemaRef = (response, ref) => {
  const contentType = getResponseContentType(response);
  if (!contentType) return;
  response.content[contentType].schema = { $ref: ref };
};

// Returns the live schema object for inline response (writable)
export const getResponseInlineSchema = (response) => {
  const contentType = getResponseContentType(response);
  if (!contentType) return {};
  if (!response.content) response.content = {};
  if (!response.content[contentType])
    response.content[contentType] = {
      schema: { type: "object", properties: {} },
    };
  if (!response.content[contentType].schema)
    response.content[contentType].schema = {
      type: "object",
      properties: {},
    };
  const schema = response.content[contentType].schema;
  // Treat any schema that has a $ref key (even empty string) as a reference schema
  if (Object.prototype.hasOwnProperty.call(schema, "$ref")) return {};
  return schema;
};

export const getResponseInlineSchemaType = (response) => {
  const schema = getResponseInlineSchema(response);
  if (!schema || !schema.type) return "object";
  return Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null") || "object"
    : schema.type;
};

export const setResponseInlineSchemaType = (response, type) => {
  const contentType = getResponseContentType(response);
  if (!contentType) return;
  if (!response.content) response.content = {};
  const newSchema = { type };
  if (type === "object") {
    newSchema.properties = {};
  } else if (type === "array") {
    newSchema._itemSchemas = [];
  }
  response.content[contentType] = { schema: newSchema };
};

export const addResponseProperty = (response) => {
  const schema = getResponseInlineSchema(response);
  if (!schema || schema.type !== "object") return;
  if (!schema.properties) schema.properties = {};
  let propName = "newProperty";
  let counter = 1;
  while (schema.properties[propName]) {
    propName = `newProperty${counter}`;
    counter++;
  }
  schema.properties[propName] = { type: "string", description: "" };
};

export const removeResponseProperty = (response, propName) => {
  const schema = getResponseInlineSchema(response);
  if (!schema || !schema.properties) return;
  delete schema.properties[propName];
  if (schema.required)
    schema.required = schema.required.filter((r) => r !== propName);
};

export const renameResponseProperty = (response, oldName, newName) => {
  if (oldName === newName || !newName) return;
  const schema = getResponseInlineSchema(response);
  if (!schema || !schema.properties || schema.properties[newName]) return;
  schema.properties[newName] = schema.properties[oldName];
  delete schema.properties[oldName];
  if (schema.required) {
    const idx = schema.required.indexOf(oldName);
    if (idx !== -1) schema.required[idx] = newName;
  }
};

export const toggleResponsePropertyRequired = (response, propName, isRequired) => {
  const schema = getResponseInlineSchema(response);
  if (!schema) return;
  if (!schema.required) schema.required = [];
  if (isRequired) {
    if (!schema.required.includes(propName)) schema.required.push(propName);
  } else {
    schema.required = schema.required.filter((r) => r !== propName);
  }
};
