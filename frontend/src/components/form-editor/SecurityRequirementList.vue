<template>
  <div class="security-requirement-list">
    <p class="security-requirement-hint">{{ hint }}</p>

    <div v-if="schemes.length === 0" class="empty-state-small">
      <p>Define a security scheme first to build requirements.</p>
    </div>

    <div v-else>
      <div v-if="modelValue.length === 0" class="empty-state-small">
        <p>{{ emptyLabel }}</p>
      </div>

      <div
        v-for="(requirement, index) in modelValue"
        :key="index"
        class="security-requirement-row"
      >
        <div class="security-requirement-row__schemes">
          <div
            v-for="scheme in schemes"
            :key="scheme.name"
            class="security-requirement-row__scheme"
          >
            <Checkbox
              :inputId="`sec-req-${index}-${scheme.name}`"
              :binary="true"
              :modelValue="scheme.name in requirement"
              @update:modelValue="toggleScheme(index, scheme)"
            />
            <label :for="`sec-req-${index}-${scheme.name}`">{{ scheme.name }}</label>
            <MultiSelect
              v-if="scheme.name in requirement && scheme.scopes.length > 0"
              :modelValue="requirement[scheme.name]"
              @update:modelValue="setScopes(index, scheme.name, $event)"
              :options="scheme.scopes"
              placeholder="Scopes"
              class="security-requirement-row__scopes"
            />
          </div>
        </div>
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          size="small"
          @click="removeRequirement(index)"
        />
      </div>

      <Button
        label="Add Requirement (OR)"
        icon="pi pi-plus"
        size="small"
        text
        @click="addRequirement"
      />
    </div>
  </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Checkbox from "primevue/checkbox";
import MultiSelect from "primevue/multiselect";
import Button from "primevue/button";

// Editor for an OpenAPI `security` requirement array:
// [{ SchemeA: [], SchemeB: ["read", "write"] }, ...]
// Each array element ("row") is an AND-group of schemes; multiple rows are
// alternatives (OR). Shared between the global Security tab and each
// operation's per-endpoint override — both just bind `modelValue` to the
// relevant `security` array and pass the same available scheme list.
export default {
  name: "SecurityRequirementList",
  components: { Checkbox, MultiSelect, Button },
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    schemes: {
      type: Array,
      required: true,
    },
    hint: {
      type: String,
      default:
        "Each row lists schemes that must ALL be satisfied together (AND). Multiple rows are alternatives (OR) — any one row satisfies the requirement.",
    },
    emptyLabel: {
      type: String,
      default: "No requirements defined.",
    },
  },
  emits: ["update:modelValue"],
  methods: {
    addRequirement() {
      this.$emit("update:modelValue", [...this.modelValue, {}]);
    },
    removeRequirement(index) {
      const next = [...this.modelValue];
      next.splice(index, 1);
      this.$emit("update:modelValue", next);
    },
    toggleScheme(index, scheme) {
      const next = this.modelValue.map((r) => ({ ...r }));
      const requirement = next[index];
      if (scheme.name in requirement) {
        delete requirement[scheme.name];
      } else {
        requirement[scheme.name] = [];
      }
      this.$emit("update:modelValue", next);
    },
    setScopes(index, schemeName, scopes) {
      const next = this.modelValue.map((r) => ({ ...r }));
      next[index][schemeName] = scopes;
      this.$emit("update:modelValue", next);
    },
  },
};
</script>

<style scoped>
.security-requirement-hint {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 12px;
}

.security-requirement-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.security-requirement-row__schemes {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  flex: 1;
}

.security-requirement-row__scheme {
  display: flex;
  align-items: center;
  gap: 6px;
}

.security-requirement-row__scopes {
  min-width: 180px;
}
</style>
