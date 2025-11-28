/**
 * Generate markdown report from diff data
 * @param {Object} diff - The diff object containing changes
 */
export function generateMarkdownReport(diff) {
  let markdown = "# API Changes Report\n\n";
  markdown += `> Generated on ${new Date().toLocaleString()}\n\n`;

  // Detect breaking changes
  const breakingChanges = [];
  if (diff.removed?.length) {
    breakingChanges.push(`${diff.removed.length} endpoint(s) removed`);
  }
  if (diff.schemaRemoved?.length) {
    breakingChanges.push(`${diff.schemaRemoved.length} schema(s) removed`);
  }

  // Check for required field additions in schemas
  const requiredFieldsAdded =
    diff.schemaModified?.filter((s) => s.requiredAdded?.length > 0).length || 0;
  if (requiredFieldsAdded > 0) {
    breakingChanges.push(
      `${requiredFieldsAdded} schema(s) with new required fields`
    );
  }

  if (breakingChanges.length > 0) {
    markdown += "## ⚠️ BREAKING CHANGES\n\n";
    markdown +=
      "**Action Required:** The following changes may break existing API clients:\n\n";
    breakingChanges.forEach((change) => {
      markdown += `- 🚨 ${change}\n`;
    });
    markdown += "\n";
  }

  markdown += "---\n\n";

  // Info changes
  if (diff.infoAdded?.length) {
    markdown += "## ➕ Added Information\n\n";
    diff.infoAdded.forEach((item) => {
      markdown += `- **${item.key}**: \`${item.value}\`\n`;
    });
    markdown += "\n";
  }

  if (diff.infoModified?.length) {
    markdown += "## ✏️ Modified Information\n\n";
    diff.infoModified.forEach((item) => {
      markdown += `### ${item.key}\n`;
      markdown += `- Before: \`${item.old}\`\n`;
      markdown += `- After: \`${item.new}\`\n\n`;
    });
  }

  if (diff.infoRemoved?.length) {
    markdown += "## ➖ Removed Information\n\n";
    diff.infoRemoved.forEach((item) => {
      markdown += `- **${item.key}**: \`${item.value}\`\n`;
    });
    markdown += "\n";
  }

  // Added Schemas
  if (diff.schemaAdded?.length) {
    markdown += "## ➕ Added Schemas\n\n";
    diff.schemaAdded.forEach((item) => {
      markdown += `### \`${item.name}\`\n\n`;
      if (item.schema.type) {
        markdown += `**Type:** \`${item.schema.type}\`\n\n`;
      }

      markdown += "<details>\n<summary>View OpenAPI Schema</summary>\n\n";
      markdown +=
        "```json\n" + JSON.stringify(item.schema, null, 2) + "\n```\n";
      markdown += "</details>\n\n";
    });
  }

  // Modified Schemas Section
  if (diff.schemaModified?.length) {
    markdown += "## 🔄 Modified Schemas\n\n";
    diff.schemaModified.forEach((item) => {
      markdown += `### \`${item.name}\`\n\n`;

      // Action items
      const actions = [];
      if (item.typeChanged) actions.push("Update type handling in client code");
      if (item.requiredAdded?.length)
        actions.push(
          `Add ${item.requiredAdded.length} required field(s) to requests`
        );
      if (item.requiredRemoved?.length)
        actions.push(
          `${item.requiredRemoved.length} field(s) are now optional`
        );
      if (item.propertiesAdded?.length)
        actions.push(
          `Handle ${item.propertiesAdded.length} new property/properties`
        );
      if (item.propertiesRemoved?.length)
        actions.push(
          `Remove references to ${item.propertiesRemoved.length} deleted property/properties`
        );

      if (actions.length > 0) {
        markdown += "**Action Required:**\n";
        actions.forEach((action) => {
          markdown += `- [ ] ${action}\n`;
        });
        markdown += "\n";
      }

      if (item.typeChanged) {
        markdown += `⚠️ **Type Changed:** \`${item.oldType}\` → \`${item.newType}\`\n\n`;
      }

      if (item.requiredChanged) {
        markdown += "**Required Fields Changed:**\n";
        if (item.requiredAdded?.length) {
          markdown += "- 🚨 **Now Required:** ";
          markdown += item.requiredAdded.map((f) => `\`${f}\``).join(", ");
          markdown += " (Breaking change)\n";
        }
        if (item.requiredRemoved?.length) {
          markdown += "- ✅ **Now Optional:** ";
          markdown += item.requiredRemoved.map((f) => `\`${f}\``).join(", ");
          markdown += "\n";
        }
        markdown += "\n";
      }

      if (item.enumChanged) {
        markdown += "⚠️ **Enum Values Changed** - Review allowed values\n\n";
      }

      if (item.formatChanged) {
        markdown += "⚠️ **Format Changed** - Update validation logic\n\n";
      }

      if (item.validationChanged?.length) {
        markdown += "**Validation Rules Changed:**\n";
        item.validationChanged.forEach((validation) => {
          markdown += `- \`${validation.field}\`: `;
          markdown += `\`${validation.old ?? "none"}\` → \`${
            validation.new ?? "none"
          }\`\n`;
        });
        markdown += "\n";
      }

      if (item.propertiesAdded?.length) {
        markdown += "**Properties Added:**\n";
        item.propertiesAdded.forEach((prop) => {
          markdown += `- \`${prop.name}\` (${prop.schema.type})\n`;
        });
        markdown += "\n";
      }

      if (item.propertiesRemoved?.length) {
        markdown += "**Properties Removed:**\n";
        item.propertiesRemoved.forEach((prop) => {
          markdown += `- \`${prop.name}\` (${prop.schema.type})\n`;
        });
        markdown += "\n";
      }

      if (item.propertiesModified?.length) {
        markdown += "**Properties Modified:**\n";
        item.propertiesModified.forEach((prop) => {
          markdown += `- \`${prop.name}\`:\n`;
          markdown +=
            "  - Before:\n```json\n" +
            JSON.stringify(prop.old, null, 2) +
            "\n```\n";
          markdown +=
            "  - After:\n```json\n" +
            JSON.stringify(prop.new, null, 2) +
            "\n```\n";
        });
        markdown += "\n";
      }

      markdown += "---\n\n";
    });
  }

  // Removed Schemas
  if (diff.schemaRemoved?.length) {
    markdown += "## ➖ Removed Schemas\n\n";
    diff.schemaRemoved.forEach((item) => {
      markdown += `### \`${item.name}\`\n\n`;
      if (item.schema.type) {
        markdown += `**Type:** \`${item.schema.type}\`\n\n`;
      }
      markdown +=
        "```json\n" + JSON.stringify(item.schema, null, 2) + "\n```\n\n";
    });
  }

  // Added endpoints
  if (diff.added?.length) {
    markdown += "## ➕ Added Endpoints\n\n";
    diff.added.forEach((item) => {
      markdown += `### \`${item.method.toUpperCase()}\` ${item.path}\n\n`;

      if (item.summary) {
        markdown += `**Summary:** ${item.summary}\n\n`;
      }

      if (item.description) {
        markdown += `**Description:** ${item.description}\n\n`;
      }

      if (item.operationId) {
        markdown += `**Operation ID:** \`${item.operationId}\`\n\n`;
      }

      if (item.deprecated) {
        markdown += `⚠️ **Status:** DEPRECATED\n\n`;
      }

      if (item.tags?.length) {
        markdown += `**Tags:** ${item.tags
          .map((t) => `\`${t}\``)
          .join(", ")}\n\n`;
      }

      // Parameters
      if (item.parameters?.length) {
        markdown += "**Parameters:**\n\n";
        markdown +=
          "| Name | Location | Type | Required | Validation | Description |\n";
        markdown +=
          "|------|----------|------|----------|------------|-------------|\n";
        item.parameters.forEach((param) => {
          const paramName = `\`${param.name}\``;
          const paramIn = param.in;
          const paramType = param.schema?.type || "any";
          const paramFormat = param.schema?.format
            ? ` (${param.schema.format})`
            : "";
          const paramRequired = param.required ? "**Yes**" : "No";

          // Collect validation rules
          const validations = [];
          if (param.schema?.minimum !== undefined)
            validations.push(`min: ${param.schema.minimum}`);
          if (param.schema?.maximum !== undefined)
            validations.push(`max: ${param.schema.maximum}`);
          if (param.schema?.minLength !== undefined)
            validations.push(`minLen: ${param.schema.minLength}`);
          if (param.schema?.maxLength !== undefined)
            validations.push(`maxLen: ${param.schema.maxLength}`);
          if (param.schema?.pattern)
            validations.push(`pattern: ${param.schema.pattern}`);
          if (param.schema?.enum)
            validations.push(`enum: [${param.schema.enum.join(", ")}]`);
          const validation =
            validations.length > 0 ? validations.join("<br>") : "-";

          const paramDesc = param.description || "-";
          markdown += `| ${paramName} | ${paramIn} | \`${paramType}${paramFormat}\` | ${paramRequired} | ${validation} | ${paramDesc} |\n`;
        });
        markdown += "\n";
      }

      // Request Body
      if (item.requestBody) {
        markdown += "**Request Body:**\n\n";
        if (item.requestBody.required) {
          markdown += "✅ **Required**\n\n";
        }
        if (item.requestBody.description) {
          markdown += `${item.requestBody.description}\n\n`;
        }
        markdown +=
          "```json\n" + JSON.stringify(item.requestBody, null, 2) + "\n```\n\n";
      }

      // Responses
      if (item.responses && Object.keys(item.responses).length > 0) {
        markdown += "**Responses:**\n\n";
        for (const [statusCode, response] of Object.entries(item.responses)) {
          markdown += `- **${statusCode}**: ${
            response.description || "(no description)"
          }\n`;
          if (response.content) {
            const jsonLines = JSON.stringify(response.content, null, 2).split(
              "\n"
            );
            markdown += "  ```json\n";
            jsonLines.forEach((line) => {
              markdown += `  ${line}\n`;
            });
            markdown += "  ```\n";
          }
        }
        markdown += "\n";
      }

      // Security
      if (item.security?.length) {
        markdown += "**Security:**\n\n";
        markdown +=
          "```json\n" + JSON.stringify(item.security, null, 2) + "\n```\n\n";
      }

      markdown += "---\n\n";
    });
  }

  // Modified endpoints
  if (diff.modified?.length) {
    markdown += "## ✏️ Modified Endpoints\n\n";
    diff.modified.forEach((item) => {
      markdown += `### \`${item.method}\` ${item.path}\n\n`;
      markdown += "**Changes:**\n";
      item.changes.forEach((change) => {
        markdown += `- ${change}\n`;
      });
      markdown += "\n";

      // Detailed changes
      if (item.details) {
        markdown += "### 📝 Detailed Changes\n\n";

        for (const [field, detail] of Object.entries(item.details)) {
          const fieldName = field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
          markdown += `#### ${fieldName}\n\n`;

          if (field === "parameters") {
            // Enhanced parameter change display
            if (detail.added?.length) {
              markdown += "**✅ Added Parameters:**\n\n";
              detail.added.forEach((param) => {
                markdown += `- \`${param.name}\` (${param.in})\n`;
                markdown += `  - **Type:** \`${param.schema?.type || "any"}\`${
                  param.schema?.format ? ` (${param.schema.format})` : ""
                }\n`;
                if (param.required) markdown += "  - **Required:** Yes ⚠️\n";
                if (param.description)
                  markdown += `  - **Description:** ${param.description}\n`;
                markdown += "\n";
              });
            }

            if (detail.modified?.length) {
              markdown += "**📝 Modified Parameters:**\n\n";
              detail.modified.forEach((param) => {
                markdown += `- \`${param.name}\` (${param.in})\n`;
                markdown += "  - **Before:**\n";
                if (param.old.description)
                  markdown += `    - Description: ${param.old.description}\n`;
                markdown += `    - Required: ${
                  param.old.required ? "Yes" : "No"
                }\n`;
                if (param.old.schema)
                  markdown += `    - Type: \`${
                    param.old.schema.type || "any"
                  }\`${
                    param.old.schema.format
                      ? ` (${param.old.schema.format})`
                      : ""
                  }\n`;
                markdown += "  - **After:**\n";
                if (param.new.description)
                  markdown += `    - Description: ${param.new.description}\n`;
                markdown += `    - Required: ${
                  param.new.required ? "Yes ⚠️" : "No"
                }\n`;
                if (param.new.schema)
                  markdown += `    - Type: \`${
                    param.new.schema.type || "any"
                  }\`${
                    param.new.schema.format
                      ? ` (${param.new.schema.format})`
                      : ""
                  }\n`;
                markdown += "\n";
              });
            }

            if (detail.removed?.length) {
              markdown += "**❌ Removed Parameters:**\n\n";
              detail.removed.forEach((param) => {
                markdown += `- \`${param.name}\` (${param.in})\n`;
                if (param.required) markdown += "  - Was required ⚠️\n";
                if (param.description) markdown += `  - ${param.description}\n`;
                markdown += "\n";
              });
            }
          } else if (
            typeof detail.old === "string" &&
            typeof detail.new === "string"
          ) {
            markdown += `- **Before**: \`${detail.old || "(empty)"}\`\n`;
            markdown += `- **After**: \`${detail.new || "(empty)"}\`\n\n`;
          } else if (
            typeof detail.old === "boolean" &&
            typeof detail.new === "boolean"
          ) {
            markdown += `- **Before**: ${
              detail.old ? "✅ Deprecated" : "❌ Active"
            }\n`;
            markdown += `- **After**: ${
              detail.new ? "✅ Deprecated" : "❌ Active"
            }\n\n`;
          } else if (field === "tags") {
            markdown += `- **Before**: ${
              detail.old?.length
                ? detail.old.map((t) => `\`${t}\``).join(", ")
                : "(none)"
            }\n`;
            markdown += `- **After**: ${
              detail.new?.length
                ? detail.new.map((t) => `\`${t}\``).join(", ")
                : "(none)"
            }\n\n`;
          } else if (field === "responses") {
            if (detail.added?.length) {
              markdown += "**Added Responses:**\n";
              detail.added.forEach((resp) => {
                markdown += `- \`${resp.statusCode}\`: ${
                  resp.response.description || "(no description)"
                }\n`;
              });
              markdown += "\n";
            }
            if (detail.modified?.length) {
              markdown += "**Modified Responses:**\n";
              detail.modified.forEach((resp) => {
                markdown += `- \`${resp.statusCode}\`:\n`;
                markdown +=
                  "  - Before:\n```json\n" +
                  JSON.stringify(resp.old, null, 2) +
                  "\n```\n";
                markdown +=
                  "  - After:\n```json\n" +
                  JSON.stringify(resp.new, null, 2) +
                  "\n```\n";
              });
              markdown += "\n";
            }
            if (detail.removed?.length) {
              markdown += "**Removed Responses:**\n";
              detail.removed.forEach((resp) => {
                markdown += `- \`${resp.statusCode}\`: ${
                  resp.response.description || "(no description)"
                }\n`;
              });
              markdown += "\n";
            }
          } else {
            markdown +=
              "**Before:**\n```json\n" +
              JSON.stringify(detail.old, null, 2) +
              "\n```\n\n";
            markdown +=
              "**After:**\n```json\n" +
              JSON.stringify(detail.new, null, 2) +
              "\n```\n\n";
          }
        }

        markdown += "---\n\n";
      }
    });
  }

  // Removed endpoints
  if (diff.removed?.length) {
    markdown += "## ❌ Removed Endpoints\n\n";
    markdown +=
      "**⚠️ Breaking Change:** These endpoints have been removed. Update client code to remove calls.\n\n";
    diff.removed.forEach((item) => {
      markdown += `### \`${item.method}\` ${item.path}\n`;
      if (item.summary) {
        markdown += `**Was:** ${item.summary}\n`;
      }
      if (item.description) {
        markdown += `${item.description}\n`;
      }
      markdown +=
        "\n**Action:** Remove all client code that calls this endpoint.\n";
      markdown += "\n";
    });
  }

  return markdown;
}
