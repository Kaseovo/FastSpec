<template>
  <div class="op-step-nav">
    <button
      v-for="(step, index) in steps"
      :key="step.key"
      type="button"
      class="op-step-nav__tab"
      :class="{ 'op-step-nav__tab--active': modelValue === step.key }"
      @click="$emit('update:modelValue', step.key)"
    >
      <span class="op-step-nav__index">{{ index + 1 }}</span>
      {{ step.label }}
      <span v-if="step.count" class="op-step-nav__count">{{ step.count }}</span>
    </button>
  </div>
</template>

<script>
// Free-jump step navigation for the operation editor: unlike AddPathDialog's
// linear create wizard (Back/Next only, one step "done" before the next
// unlocks), this lets you click straight to any step — editing an existing
// operation is usually "tweak one section", not "walk through all four in
// order" every time.
export default {
  name: "OperationStepNav",
  props: {
    steps: { type: Array, required: true }, // [{ key, label, count }]
    modelValue: { type: String, required: true },
  },
  emits: ["update:modelValue"],
};
</script>

<style scoped>
.op-step-nav {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 8px;
  margin-bottom: 20px;
}

.op-step-nav__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.op-step-nav__tab:hover {
  color: #374151;
  background: rgba(255, 255, 255, 0.6);
}

.op-step-nav__tab--active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.op-step-nav__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.op-step-nav__tab--active .op-step-nav__index {
  background: #3b82f6;
  color: #ffffff;
}

.op-step-nav__count {
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 1px 6px;
}

.op-step-nav__tab--active .op-step-nav__count {
  background: #eff6ff;
  color: #3b82f6;
}
</style>
