/**
 * Generate markdown report from diff data
 */
export function generateMarkdownReport(diff) {
  let markdown = "# API Changes Overview\n\n";

  // Summary section
  const totalAdded =
    (diff.infoAdded?.length || 0) +
    (diff.added?.length || 0) +
    (diff.schemaAdded?.length || 0);
  const totalModified =
    (diff.infoModified?.length || 0) +
    (diff.modified?.length || 0) +
    (diff.schemaModified?.length || 0);
  const totalRemoved =
    (diff.infoRemoved?.length || 0) +
    (diff.removed?.length || 0) +
    (diff.schemaRemoved?.length || 0);

  markdown += "## 📊 Summary\n\n";
  markdown += `- ✅ **Added**: ${totalAdded}\n`;
  markdown += `- ✏️ **Modified**: ${totalModified}\n`;
  if (
    diff.schemaAdded?.length ||
    diff.schemaModified?.length ||
    diff.schemaRemoved?.length
  ) {
    markdown += `  - 🔄 **Component Schemas**: ${
      diff.schemaAdded?.length || 0
    } added, ${diff.schemaModified?.length || 0} modified, ${
      diff.schemaRemoved?.length || 0
    } removed\n`;
  }
  markdown += `- ❌ **Removed**: ${totalRemoved}\n\n`;

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
      markdown +=
        "```json\n" + JSON.stringify(item.schema, null, 2) + "\n```\n\n";
    });
  }

  // Modified Schemas Section
  if (diff.schemaModified?.length) {
    markdown += "## 🔄 Modified Schemas\n\n";
    diff.schemaModified.forEach((item) => {
      markdown += `### \`${item.name}\`\n\n`;

      if (item.typeChanged) {
        markdown += `**Type Changed:** \`${item.oldType}\` → \`${item.newType}\`\n\n`;
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
      markdown += `### \`${item.method}\` ${item.path}\n`;
      if (item.summary) {
        markdown += `${item.summary}\n`;
      }
      markdown += "\n";
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
        markdown += "<details>\n<summary>View detailed changes</summary>\n\n";

        for (const [field, detail] of Object.entries(item.details)) {
          const fieldName = field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
          markdown += `#### ${fieldName}\n\n`;

          if (
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

        markdown += "</details>\n\n";
      }
    });
  }

  // Removed endpoints
  if (diff.removed?.length) {
    markdown += "## ➖ Removed Endpoints\n\n";
    diff.removed.forEach((item) => {
      markdown += `### \`${item.method}\` ${item.path}\n`;
      if (item.summary) {
        markdown += `${item.summary}\n`;
      }
      markdown += "\n";
    });
  }

  return markdown;
}
