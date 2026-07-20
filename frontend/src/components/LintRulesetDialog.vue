<template>
  <Dialog
    v-model:visible="visible"
    header="Custom Lint Rulesets"
    :modal="true"
    :closable="true"
    :style="{ width: '720px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <!-- ── Ruleset selector ──────────────────────────────────────── -->
    <div class="ruleset-selector-row">
      <Select
        v-model="selectedRulesetId"
        :options="rulesetOptions"
        option-label="label"
        option-value="value"
        placeholder="Select a ruleset…"
        class="ruleset-select"
        :disabled="creatingNew"
      />
      <Button
        icon="pi pi-plus"
        label="New"
        severity="secondary"
        text
        size="small"
        @click="startCreateRuleset"
      />
      <Button
        v-if="selectedRulesetId && !isSelectedDefault"
        icon="pi pi-star"
        label="Set default"
        severity="secondary"
        text
        size="small"
        @click="onSetDefault"
      />
      <span v-if="selectedRulesetId && isSelectedDefault" class="default-badge">
        <i class="pi pi-star-fill" /> Default
      </span>
    </div>

    <div v-if="creatingNew" class="new-ruleset-row">
      <InputText
        v-model="newRulesetName"
        placeholder="Ruleset name, e.g. Internal API"
        class="w-full"
        @keyup.enter="onCreateRuleset"
      />
      <Button label="Create" size="small" :loading="creating" @click="onCreateRuleset" />
      <Button label="Cancel" size="small" severity="secondary" text @click="creatingNew = false" />
    </div>

    <div v-else-if="!selectedRulesetId" class="rules-empty">
      <i class="pi pi-info-circle" />
      No rulesets yet. Click <strong>New</strong> to create one.
    </div>

    <template v-else>
      <div class="ruleset-name-row">
        <label>Ruleset name</label>
        <InputText v-model="rulesetName" class="w-full" />
      </div>

      <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="rules">Structured Rules</Tab>
        <Tab value="yaml">Raw YAML Override</Tab>
      </TabList>

      <TabPanels>
        <!-- ── Structured Rules tab ─────────────────────────────── -->
        <TabPanel value="rules">
          <div class="rules-tab">
            <p class="tab-hint">
              Build rules using the form. Each rule extends
              <code>spectral:oas</code> automatically.
            </p>

            <div v-if="structuredRules.length === 0" class="rules-empty">
              <i class="pi pi-info-circle" />
              No custom rules yet. Click <strong>Add Rule</strong> to get started.
            </div>

            <Accordion v-else :multiple="true" v-model:value="openPanels" class="rules-accordion">
              <AccordionPanel
                v-for="(rule, idx) in structuredRules"
                :key="idx"
                :value="String(idx)"
              >
                <AccordionHeader>
                  <div class="accordion-rule-header">
                    <span class="accordion-rule-name">{{ rule.name || "(unnamed rule)" }}</span>
                    <span class="accordion-rule-meta">
                      <span class="rule-severity-badge" :class="'sev-' + rule.severity">{{ rule.severity }}</span>
                      <span class="rule-fn-badge">{{ rule.then_function }}</span>
                    </span>
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      size="small"
                      aria-label="Remove rule"
                      class="accordion-delete-btn"
                      @click.stop="removeRule(idx)"
                    />
                  </div>
                </AccordionHeader>

                <AccordionContent>
                  <div class="rule-fields">
                    <div class="field">
                      <label>Rule name <span class="required">*</span></label>
                      <InputText
                        v-model="rule.name"
                        placeholder="e.g. operation-summary-required"
                        class="w-full"
                      />
                    </div>

                    <div class="field-row">
                      <div class="field field-severity">
                        <label>Severity <span class="required">*</span></label>
                        <Select
                          v-model="rule.severity"
                          :options="severityOptions"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                        />
                      </div>
                      <div class="field field-function">
                        <label class="label-with-help">
                          Function <span class="required">*</span>
                          <i
                            v-tooltip.top="functionTooltip(rule.then_function)"
                            class="pi pi-question-circle help-icon"
                          />
                        </label>
                        <Select
                          v-model="rule.then_function"
                          :options="functionOptions"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                        />
                      </div>
                    </div>

                    <!-- schema function warning -->
                    <Message v-if="rule.then_function === 'schema'" severity="warn" class="schema-warn-msg">
                      The <code>schema</code> function requires JSON Schema syntax and cannot be configured here.
                      Use the <strong>Raw YAML Override</strong> tab for full control.
                    </Message>

                    <div class="field">
                      <label>Given (JSONPath) <span class="required">*</span></label>
                      <!-- JSONPath preset dropdown -->
                      <Select
                        :model-value="givenPresetValue(rule.given)"
                        :options="givenPresets"
                        option-label="label"
                        option-value="value"
                        placeholder="Choose a preset…"
                        class="w-full given-preset-select"
                        @update:model-value="(v) => onGivenPreset(rule, v)"
                      />
                      <InputText
                        v-model="rule.given"
                        placeholder="e.g. $.paths[*][*]"
                        class="w-full given-input"
                        style="font-family: monospace"
                      />
                    </div>

                    <div class="field">
                      <label>Message <span class="optional">optional</span></label>
                      <InputText
                        v-model="rule.message"
                        placeholder="e.g. Operation must have a summary"
                        class="w-full"
                      />
                    </div>

                    <!-- Dynamic functionOptions for pattern -->
                    <template v-if="rule.then_function === 'pattern'">
                      <div class="field">
                        <label>Pattern (regex) <span class="required">*</span></label>
                        <InputText
                          v-model="rule.functionOptions.match"
                          placeholder="e.g. ^[a-z]+"
                          class="w-full"
                          style="font-family: monospace"
                        />
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for enumeration -->
                    <template v-if="rule.then_function === 'enumeration'">
                      <div class="field">
                        <label>Allowed values (comma-separated) <span class="required">*</span></label>
                        <InputText
                          :model-value="(rule.functionOptions.values || []).join(', ')"
                          @update:model-value="(v) => rule.functionOptions.values = v.split(',').map(s => s.trim()).filter(Boolean)"
                          placeholder="e.g. get, post, put"
                          class="w-full"
                        />
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for length -->
                    <template v-if="rule.then_function === 'length'">
                      <div class="field-row">
                        <div class="field">
                          <label>Min length</label>
                          <InputText
                            v-model.number="rule.functionOptions.min"
                            type="number"
                            placeholder="0"
                            class="w-full"
                          />
                        </div>
                        <div class="field">
                          <label>Max length</label>
                          <InputText
                            v-model.number="rule.functionOptions.max"
                            type="number"
                            placeholder="255"
                            class="w-full"
                          />
                        </div>
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for casing -->
                    <template v-if="rule.then_function === 'casing'">
                      <div class="field">
                        <label>Casing type <span class="required">*</span></label>
                        <Select
                          v-model="rule.functionOptions.type"
                          :options="casingOptions"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                        />
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for alphabetical -->
                    <template v-if="rule.then_function === 'alphabetical'">
                      <div class="field">
                        <label>Sort by key <span class="optional">optional</span></label>
                        <InputText
                          v-model="rule.functionOptions.keyedBy"
                          placeholder="e.g. name (for arrays of objects)"
                          class="w-full"
                        />
                      </div>
                    </template>

                    <!-- Per-rule preview against the currently open spec -->
                    <div class="rule-preview-row">
                      <Button
                        label="Test against current spec"
                        icon="pi pi-play"
                        severity="secondary"
                        size="small"
                        outlined
                        v-tooltip.top="specContent ? '' : 'Open a spec in the editor to test against it'"
                        :loading="previewLoadingIdx === idx"
                        :disabled="!canPreview(rule)"
                        @click="onPreviewRule(idx)"
                      />
                      <span
                        v-if="previewResults[idx]"
                        class="rule-preview-result"
                        :class="{ 'has-matches': previewResults[idx].count > 0, 'is-error': previewResults[idx].error }"
                      >
                        <template v-if="previewResults[idx].error">
                          <i class="pi pi-exclamation-triangle" /> {{ previewResults[idx].error }}
                        </template>
                        <template v-else>
                          <i :class="previewResults[idx].count > 0 ? 'pi pi-check-circle' : 'pi pi-circle'" />
                          {{ previewResults[idx].count }} match{{ previewResults[idx].count === 1 ? '' : 'es' }}
                        </template>
                      </span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionPanel>
            </Accordion>

            <Button
              label="Add Rule"
              icon="pi pi-plus"
              severity="secondary"
              class="add-rule-btn"
              :disabled="!canAddRule"
              @click="addRule"
            />
          </div>
        </TabPanel>

        <!-- ── Raw YAML tab ─────────────────────────────────────── -->
        <TabPanel value="yaml">
          <div class="yaml-tab">
            <div class="yaml-hint-row">
              <p class="tab-hint">
                Write a full <a href="https://docs.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets" target="_blank" rel="noopener">Spectral ruleset</a> in YAML.
                When present, this overrides the Structured Rules above.
                <code>extends: spectral:oas</code> is injected automatically if omitted.
              </p>
              <span class="spectral-version-badge">Spectral 6.16.0</span>
            </div>
            <div class="yaml-toolbar">
              <Button
                v-if="!rawYaml.trim()"
                label="Insert starter template"
                icon="pi pi-file-edit"
                severity="secondary"
                size="small"
                @click="insertStarterTemplate"
              />
            </div>
            <Textarea
              v-model="rawYaml"
              :rows="18"
              class="yaml-editor w-full"
              placeholder="extends: spectral:oas&#10;rules:&#10;  # Example: require a summary on every operation&#10;  operation-summary-required:&#10;    given: '$.paths[*][*]'&#10;    severity: warn&#10;    then:&#10;      function: truthy&#10;      field: summary&#10;    message: 'Operation must have a summary.'"
              spellcheck="false"
              autocomplete="off"
            />
            <Message v-if="yamlError" severity="error" class="yaml-error-msg">
              {{ yamlError }}
            </Message>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <Button
            v-if="selectedRulesetId"
            label="Delete ruleset"
            icon="pi pi-trash"
            severity="danger"
            text
            :loading="deleting"
            @click="onDelete"
          />
        </div>
        <div class="footer-right">
          <Button label="Cancel" severity="secondary" text @click="onCancel" />
          <Button
            v-if="selectedRulesetId"
            label="Save ruleset"
            icon="pi pi-check"
            :loading="saving"
            @click="onSave"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { computed, ref, watch } from "vue";
import { useConfirm } from "primevue/useconfirm";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanel from "primevue/tabpanel";
import TabPanels from "primevue/tabpanels";
import Tabs from "primevue/tabs";
import Textarea from "primevue/textarea";
import Accordion from "primevue/accordion";
import AccordionContent from "primevue/accordioncontent";
import AccordionHeader from "primevue/accordionheader";
import AccordionPanel from "primevue/accordionpanel";
import Tooltip from "primevue/tooltip";
import {
  createLintRuleset,
  deleteLintRuleset,
  getLintRuleset,
  listLintRulesets,
  previewLintRule,
  setDefaultLintRuleset,
  updateLintRuleset,
} from "../api/lint";

const SEVERITY_OPTIONS = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warn" },
  { label: "Info", value: "info" },
  { label: "Hint", value: "hint" },
  { label: "Off", value: "off" },
];

const FUNCTION_OPTIONS = [
  { label: "truthy — field must be present and truthy", value: "truthy" },
  { label: "falsy — field must be absent or falsy", value: "falsy" },
  { label: "pattern — field must match a regex", value: "pattern" },
  { label: "enumeration — field must be one of a set", value: "enumeration" },
  { label: "length — string/array length check", value: "length" },
  { label: "schema — field must match a JSON Schema", value: "schema" },
  { label: "casing — field must follow a casing convention", value: "casing" },
  { label: "alphabetical — array/object keys must be sorted", value: "alphabetical" },
  { label: "xor — exactly one of two fields must be present", value: "xor" },
  { label: "unreferencedReusableObject — flag unused components", value: "unreferencedReusableObject" },
];

const FUNCTION_TOOLTIPS = {
  truthy: "Passes if the selected field exists and is non-empty (non-null, non-zero, non-empty string or array).",
  falsy: "Passes if the selected field is absent, null, an empty string, 0, or false.",
  pattern: "Passes if the selected field value matches (or does not match) a regular expression you provide.",
  enumeration: "Passes if the selected field value is one of the allowed values you list.",
  length: "Passes if the length of the selected string or array is within the min/max bounds you set.",
  schema: "Passes if the selected value validates against an inline JSON Schema. Requires JSON Schema syntax — use Raw YAML Override for this function.",
  casing: "Passes if the selected field's string value follows the chosen casing convention (camelCase, kebab-case, etc.).",
  alphabetical: "Passes if the selected array/object's entries are sorted alphabetically.",
  xor: "Passes if exactly one of two named sibling fields is present (requires Raw YAML Override to list both field names).",
  unreferencedReusableObject: "Flags entries under the selected object (e.g. components.schemas) that nothing in the document references.",
};

const CASING_OPTIONS = [
  { label: "camelCase", value: "camel" },
  { label: "PascalCase", value: "pascal" },
  { label: "kebab-case", value: "kebab" },
  { label: "COBOL-CASE", value: "cobol" },
  { label: "snake_case", value: "snake" },
  { label: "MACRO_CASE", value: "macro" },
  { label: "flatcase", value: "flat" },
];

/** Common JSONPath presets for the given field. */
const GIVEN_PRESETS = [
  { label: "Every operation (GET, POST, …)", value: "$.paths[*][*]" },
  { label: "Every path string (/users, /orders, …)", value: "$.paths~" },
  { label: "Every response object", value: "$.paths[*][*].responses[*]" },
  { label: "Every component schema", value: "$.components.schemas[*]" },
  { label: "Info object", value: "$.info" },
  { label: "Custom (type below)…", value: "__custom__" },
];

/** Starter template inserted when Raw YAML tab is empty. */
const STARTER_TEMPLATE = `extends: spectral:oas
rules:
  # ── Override a default spectral:oas rule ──────────────────────
  # Silence the info-contact warning (remove '#' to activate)
  # info-contact: off

  # ── Custom rules ──────────────────────────────────────────────

  # Enforce kebab-case path segments (active)
  path-kebab-case:
    given: "$.paths~"
    severity: error
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z0-9-]+)+$"
    message: "Path must use kebab-case segments."

  # Require a summary on every operation (uncomment to activate)
  # operation-summary-required:
  #   given: "$.paths[*][*]"
  #   severity: warn
  #   then:
  #     function: truthy
  #     field: summary
  #   message: "Operation must have a summary."

  # Require operationId on every operation (uncomment to activate)
  # require-operation-id:
  #   given: "$.paths[*][*]"
  #   severity: error
  #   then:
  #     function: truthy
  #     field: operationId
  #   message: "Every operation must have an operationId."
`;

/** Return a fresh empty rule object. */
function emptyRule() {
  return {
    name: "",
    severity: "warn",
    given: "",
    message: "",
    then_function: "truthy",
    functionOptions: {},
  };
}

export default {
  name: "LintRulesetDialog",

  components: {
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionPanel,
    Button,
    Dialog,
    InputText,
    Message,
    Select,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Textarea,
  },

  directives: {
    tooltip: Tooltip,
  },

  props: {
    /** Controls dialog visibility — use v-model:open */
    open: {
      type: Boolean,
      default: false,
    },
    /**
     * Raw JSON text of the spec currently open in the editor. Used only for
     * the per-rule "test against current spec" preview — parsed lazily, so
     * an invalid/empty editor just disables the preview button.
     */
    specContent: {
      type: String,
      default: "",
    },
  },

  emits: ["update:open", "saved", "deleted"],

  setup(props, { emit }) {
    const confirm = useConfirm();
    const visible = ref(false);
    const activeTab = ref("rules");

    // Ruleset list + selection state
    const rulesets = ref([]);
    const selectedRulesetId = ref(null);
    const rulesetName = ref("");
    const creatingNew = ref(false);
    const newRulesetName = ref("");
    const creating = ref(false);

    // Structured rules state
    const structuredRules = ref([]);
    const openPanels = ref([]);
    // Raw YAML state
    const rawYaml = ref("");
    const yamlError = ref(null);

    // Loading/status flags
    const saving = ref(false);
    const deleting = ref(false);

    // Per-rule preview state, keyed by rule index
    const previewLoadingIdx = ref(null);
    const previewResults = ref({});

    const severityOptions = SEVERITY_OPTIONS;
    const functionOptions = FUNCTION_OPTIONS;
    const givenPresets = GIVEN_PRESETS;
    const casingOptions = CASING_OPTIONS;

    const rulesetOptions = computed(() =>
      rulesets.value.map((r) => ({
        label: r.is_default ? `${r.name} (default)` : r.name,
        value: r.id,
      })),
    );

    const isSelectedDefault = computed(() => {
      const r = rulesets.value.find((r) => r.id === selectedRulesetId.value);
      return r?.is_default ?? false;
    });

    // --- Sync visibility with the `open` prop ---
    watch(
      () => props.open,
      async (isOpen) => {
        visible.value = isOpen;
        if (isOpen) {
          creatingNew.value = false;
          previewResults.value = {};
          await loadRulesets();
        }
      },
    );

    // Keep parent in sync when Dialog closes via its own X button
    watch(visible, (v) => {
      if (!v) emit("update:open", false);
    });

    // Load a fresh ruleset whenever the selection changes
    watch(selectedRulesetId, async (id) => {
      previewResults.value = {};
      if (id) {
        await loadRuleset(id);
      } else {
        rulesetName.value = "";
        structuredRules.value = [];
        rawYaml.value = "";
      }
    });

    // --- Load the user's ruleset list, defaulting selection to their default ruleset ---
    async function loadRulesets() {
      try {
        rulesets.value = await listLintRulesets();
        const current = rulesets.value.find((r) => r.id === selectedRulesetId.value);
        if (current) return; // selection still valid, the watcher above already reloaded it
        const defaultRuleset = rulesets.value.find((r) => r.is_default);
        selectedRulesetId.value = defaultRuleset?.id ?? rulesets.value[0]?.id ?? null;
        if (!selectedRulesetId.value) {
          rulesetName.value = "";
          structuredRules.value = [];
          rawYaml.value = "";
        }
      } catch {
        rulesets.value = [];
      }
    }

    // --- Load one ruleset's full content from the API ---
    async function loadRuleset(id) {
      try {
        const data = await getLintRuleset(id);
        rulesetName.value = data.name;
        structuredRules.value = (data.rules || []).map((r) => ({
          ...r,
          message: r.message ?? "",
          functionOptions: r.then_function_options ?? {},
        }));
        rawYaml.value = data.raw_yaml ?? "";
      } catch {
        structuredRules.value = [];
        rawYaml.value = "";
      }
    }

    /**
     * Allow adding a new rule only when there are no rules yet, or the last
     * rule has its mandatory fields filled (name + given).
     */
    const canAddRule = computed(() => {
      if (structuredRules.value.length === 0) return true;
      const last = structuredRules.value[structuredRules.value.length - 1];
      return last.name.trim().length > 0 && last.given.trim().length > 0;
    });

    function addRule() {
      structuredRules.value.push(emptyRule());
      openPanels.value = [...openPanels.value, String(structuredRules.value.length - 1)];
    }

    function removeRule(idx) {
      const ruleName = structuredRules.value[idx]?.name || "this rule";
      confirm.require({
        message: `Remove "${ruleName}"?`,
        header: "Delete Rule",
        icon: "pi pi-exclamation-triangle",
        rejectLabel: "Cancel",
        acceptLabel: "Delete",
        acceptClass: "p-button-danger",
        accept: () => {
          structuredRules.value.splice(idx, 1);
        },
      });
    }

    /** Return tooltip text for the currently selected function. */
    function functionTooltip(fnValue) {
      return FUNCTION_TOOLTIPS[fnValue] ?? "";
    }

    /**
     * Match a given value back to a preset value, or return null if it's a
     * custom expression not in the preset list.
     */
    function givenPresetValue(givenValue) {
      if (!givenValue) return null;
      const match = GIVEN_PRESETS.find((p) => p.value === givenValue);
      return match ? match.value : "__custom__";
    }

    /**
     * When a preset is selected: if it's a real preset, populate the given
     * field; if it's "Custom", clear the field so the user can type.
     */
    function onGivenPreset(rule, presetValue) {
      if (presetValue === "__custom__") {
        rule.given = "";
      } else {
        rule.given = presetValue;
      }
    }

    /** Pre-fill the Raw YAML textarea with the starter template. */
    function insertStarterTemplate() {
      rawYaml.value = STARTER_TEMPLATE;
    }

    function buildRulesPayload() {
      return structuredRules.value
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          severity: r.severity,
          given: r.given.trim(),
          message: r.message.trim() || null,
          then_function: r.then_function,
          then_function_options:
            Object.keys(r.functionOptions).length > 0 ? r.functionOptions : null,
        }));
    }

    function startCreateRuleset() {
      creatingNew.value = true;
      newRulesetName.value = "";
    }

    async function onCreateRuleset() {
      const name = newRulesetName.value.trim();
      if (!name) return;
      creating.value = true;
      try {
        const created = await createLintRuleset({ name });
        rulesets.value = await listLintRulesets();
        creatingNew.value = false;
        selectedRulesetId.value = created.id;
        emit("saved");
      } catch (err) {
        yamlError.value = err.response?.data?.detail ?? "Failed to create ruleset.";
      } finally {
        creating.value = false;
      }
    }

    async function onSetDefault() {
      if (!selectedRulesetId.value) return;
      try {
        await setDefaultLintRuleset(selectedRulesetId.value);
        rulesets.value = await listLintRulesets();
      } catch {
        // Non-critical — the badge just won't update
      }
    }

    async function onSave() {
      if (!selectedRulesetId.value) return;
      yamlError.value = null;
      saving.value = true;

      const payload = {
        name: rulesetName.value.trim() || undefined,
        rules: buildRulesPayload(),
        raw_yaml: rawYaml.value.trim() || null,
      };

      try {
        await updateLintRuleset(selectedRulesetId.value, payload);
        rulesets.value = await listLintRulesets();
        emit("saved");
        visible.value = false;
      } catch (err) {
        if (err.response?.status === 400) {
          yamlError.value = err.response.data?.detail ?? "Invalid YAML syntax.";
          activeTab.value = "yaml";
        } else if (err.response?.status === 409) {
          yamlError.value = err.response.data?.detail ?? "A ruleset with that name already exists.";
        } else {
          yamlError.value = "Failed to save ruleset. Please try again.";
        }
      } finally {
        saving.value = false;
      }
    }

    function onDelete() {
      if (!selectedRulesetId.value) return;
      const ruleset = rulesets.value.find((r) => r.id === selectedRulesetId.value);
      confirm.require({
        message: `Delete the "${ruleset?.name ?? "this"}" ruleset? This cannot be undone.`,
        header: "Delete Ruleset",
        icon: "pi pi-exclamation-triangle",
        rejectLabel: "Cancel",
        acceptLabel: "Delete",
        acceptClass: "p-button-danger",
        accept: async () => {
          deleting.value = true;
          try {
            await deleteLintRuleset(selectedRulesetId.value);
            selectedRulesetId.value = null;
            rulesets.value = await listLintRulesets();
            const defaultRuleset = rulesets.value.find((r) => r.is_default);
            selectedRulesetId.value = defaultRuleset?.id ?? rulesets.value[0]?.id ?? null;
            emit("deleted");
          } catch (err) {
            yamlError.value =
              err.response?.data?.detail ?? "Failed to delete ruleset (it may be in use).";
          } finally {
            deleting.value = false;
          }
        },
      });
    }

    function onCancel() {
      visible.value = false;
    }

    function onHide() {
      yamlError.value = null;
    }

    /** A rule can be tested once it has a name + given path and a spec is open. */
    function canPreview(rule) {
      return Boolean(props.specContent) && rule.name.trim() && rule.given.trim();
    }

    async function onPreviewRule(idx) {
      const rule = structuredRules.value[idx];
      let specJson;
      try {
        specJson = JSON.parse(props.specContent);
      } catch {
        previewResults.value = {
          ...previewResults.value,
          [idx]: { error: "Editor content isn't valid JSON." },
        };
        return;
      }

      previewLoadingIdx.value = idx;
      try {
        const result = await previewLintRule(specJson, {
          name: rule.name.trim(),
          severity: rule.severity,
          given: rule.given.trim(),
          message: rule.message.trim() || null,
          then_function: rule.then_function,
          then_function_options:
            Object.keys(rule.functionOptions).length > 0 ? rule.functionOptions : null,
        });
        previewResults.value = {
          ...previewResults.value,
          [idx]: { count: result.results.length },
        };
      } catch (err) {
        previewResults.value = {
          ...previewResults.value,
          [idx]: { error: err.response?.data?.detail ?? "Preview failed." },
        };
      } finally {
        previewLoadingIdx.value = null;
      }
    }

    return {
      visible,
      activeTab,
      rulesets,
      rulesetOptions,
      selectedRulesetId,
      rulesetName,
      isSelectedDefault,
      creatingNew,
      newRulesetName,
      creating,
      structuredRules,
      openPanels,
      rawYaml,
      yamlError,
      saving,
      deleting,
      previewLoadingIdx,
      previewResults,
      severityOptions,
      functionOptions,
      givenPresets,
      casingOptions,
      canAddRule,
      addRule,
      removeRule,
      functionTooltip,
      givenPresetValue,
      onGivenPreset,
      insertStarterTemplate,
      startCreateRuleset,
      onCreateRuleset,
      onSetDefault,
      onSave,
      onDelete,
      onCancel,
      onHide,
      canPreview,
      onPreviewRule,
    };
  },
};
</script>

<style scoped>
/* ── Tab content wrappers ──────────────────────────────────── */
.rules-tab,
.yaml-tab {
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6c757d);
  margin: 0;
  line-height: 1.5;
}

.tab-hint a {
  color: var(--p-primary-color, #6366f1);
}

/* ── Field label badges ────────────────────────────────────── */
.required {
  color: #ef4444;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
  margin-left: 2px;
  vertical-align: middle;
}

.optional {
  font-size: 0.72rem;
  font-weight: 400;
  font-style: italic;
  color: var(--p-text-muted-color, #6c757d);
  margin-left: 4px;
}

/* ── Ruleset selector ──────────────────────────────────────── */
.ruleset-selector-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--p-surface-border, #e2e8f0);
}

.ruleset-select {
  flex: 1;
  min-width: 0;
}

.default-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #f59e0b;
  white-space: nowrap;
}

.new-ruleset-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 12px;
}

.ruleset-name-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.ruleset-name-row label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #6c757d);
}

/* ── Per-rule preview ──────────────────────────────────────── */
.rule-preview-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px dashed var(--p-surface-border, #e2e8f0);
}

.rule-preview-result {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #6c757d);
}

.rule-preview-result.has-matches {
  color: #22c55e;
}

.rule-preview-result.is-error {
  color: #ef4444;
}

/* ── Empty state ───────────────────────────────────────────── */
.rules-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: var(--p-surface-section, #f8f9fa);
  font-size: 0.875rem;
  color: var(--p-text-muted-color, #6c757d);
}

/* ── Rules accordion ───────────────────────────────────────── */
.rules-accordion {
  width: 100%;
}

.accordion-rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.accordion-rule-name {
  font-weight: 600;
  font-size: 0.875rem;
  font-family: monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accordion-rule-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.accordion-delete-btn {
  flex-shrink: 0;
  margin-left: 4px;
}

.rule-severity-badge,
.rule-fn-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.rule-fn-badge {
  background: var(--p-surface-section, #f1f5f9);
  color: var(--p-text-muted-color, #6c757d);
}

.rule-severity-badge.sev-error   { background: #fee2e2; color: #ef4444; }
.rule-severity-badge.sev-warn    { background: #ffedd5; color: #f97316; }
.rule-severity-badge.sev-info    { background: #dcfce7; color: #22c55e; }
.rule-severity-badge.sev-hint    { background: #f3e8ff; color: #a855f7; }
.rule-severity-badge.sev-off     { background: var(--p-surface-section, #f1f5f9); color: var(--p-text-muted-color, #6c757d); }

.rule-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #6c757d);
}

.optional {
  font-weight: 400;
  font-style: italic;
}

.field-row {
  display: flex;
  gap: 12px;
}

.field-row > .field {
  flex: 1 1 0;
  min-width: 0;
}

/* Severity takes 1 part, Function takes 2 parts */
.field-row > .field-severity {
  flex: 1 1 0;
}

.field-row > .field-function {
  flex: 2 1 0;
}

.w-full {
  width: 100%;
}

.add-rule-btn {
  align-self: flex-start;
}

/* ── Function label with help icon ─────────────────────────── */
.label-with-help {
  display: flex;
  align-items: center;
  gap: 5px;
}

.help-icon {
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #9ca3af);
  cursor: help;
}

.help-icon:hover {
  color: var(--p-primary-color, #6366f1);
}

/* ── schema warning message ────────────────────────────────── */
.schema-warn-msg {
  font-size: 0.82rem;
}

/* ── Given field: preset + manual input stacked ────────────── */
.given-preset-select {
  margin-bottom: 4px;
}

.given-input {
  font-family: "Fira Code", "Cascadia Code", "Consolas", monospace !important;
  font-size: 0.83rem;
}

/* ── Raw YAML tab ──────────────────────────────────────────── */
.yaml-hint-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  justify-content: space-between;
}

.spectral-version-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  background: var(--p-surface-section, #f1f5f9);
  color: var(--p-text-muted-color, #6c757d);
  border: 1px solid var(--p-surface-border, #e2e8f0);
  white-space: nowrap;
  align-self: center;
}

.yaml-toolbar {
  display: flex;
  gap: 8px;
  min-height: 28px;
}

.yaml-editor {
  font-family: "Fira Code", "Cascadia Code", "Consolas", monospace;
  font-size: 0.85rem;
  resize: vertical;
  min-height: 200px;
}

.yaml-error-msg {
  margin-top: 4px;
}

/* ── Dialog footer ─────────────────────────────────────────── */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.footer-left {
  display: flex;
  gap: 8px;
}
</style>
