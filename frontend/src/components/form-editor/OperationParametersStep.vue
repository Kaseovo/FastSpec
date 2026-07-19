<template>
                          <div class="operation-step">
                            <div class="section-header">
                              <h5>Parameters</h5>
                              <span v-if="currentMethodData.parameters?.length" class="section-header__count">{{ currentMethodData.parameters.length }}</span>
                              <Button
                                label="Add Parameter"
                                icon="pi pi-plus"
                                size="small"
                                @click="openAddParameterDialog"
                              />
                            </div>
                            <div class="operation-step__body">
                              <div
                                v-if="
                                  !currentMethodData.parameters ||
                                  currentMethodData.parameters.length === 0
                                "
                                class="empty-state-small"
                              >
                                <p>No parameters defined</p>
                              </div>

                              <div
                                v-for="(
                                  param, pIndex
                                ) in currentMethodData.parameters"
                                :key="pIndex"
                                :class="['param-item', { 'param-item--path': param.in === 'path' }]"
                              >
                                <div
                                  class="item-row-header"
                                  @click="openEditParameterDialog(pIndex)"
                                >
                                  <span
                                    class="item-row-name"
                                    :class="{ 'item-row-name--empty': isParameterRef(param) ? !param.$ref : !param.name }"
                                  >{{
                                    isParameterRef(param)
                                      ? (param.$ref ? param.$ref.split('/').pop() : 'No reusable parameter selected')
                                      : (param.name || 'Unnamed parameter')
                                  }}</span>
                                  <div class="item-row-badges">
                                    <Tag v-if="isParameterRef(param)" value="ref" severity="info" />
                                    <template v-else>
                                      <Tag :value="param.in" severity="secondary" />
                                      <span :class="['type-badge', 'type-badge--' + (Array.isArray(param.schema?.type) ? param.schema.type.find(t => t !== 'null') : param.schema?.type)]">
                                        {{ Array.isArray(param.schema?.type) ? param.schema.type.join(' | ') : param.schema?.type }}
                                      </span>
                                      <Tag v-if="param.required" value="required" severity="warn" />
                                    </template>
                                  </div>
                                  <i
                                    v-if="!isParameterRef(param) && (!param.name || isParameterDuplicate(currentMethodData.parameters, pIndex))"
                                    class="pi pi-exclamation-triangle item-row-error"
                                    v-tooltip.top="!param.name ? 'This parameter needs a name' : 'Duplicate parameter name'"
                                  ></i>
                                  <Button
                                    icon="pi pi-pencil"
                                    text
                                    rounded
                                    size="small"
                                    class="item-row-edit"
                                    @click.stop="openEditParameterDialog(pIndex)"
                                  />
                                  <Button
                                    v-if="param.in !== 'path'"
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    size="small"
                                    class="item-row-delete"
                                    @click.stop="
                                      removeParameter(
                                        selectedPath,
                                        selectedMethod,
                                        pIndex
                                      )
                                    "
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
</template>

<script>
import { computed } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import Tag from "primevue/tag";

// One step ("Parameters") of the operation editor — see
// OperationBasicInfoStep.vue's header comment for the shared contract
// (formData/api props, used both inline and inside AddPathDialog's wizard).
// Renders a read-only summary list; all editing happens in
// EditParameterDialog.vue (opened via api.openAddParameterDialog /
// api.openEditParameterDialog, both defined in usePathsEditor.js), which
// FormEditor.vue mounts once at the top level alongside the other dialogs.
export default {
  name: "OperationParametersStep",
  components: { Button, Tag },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    return {
      formData: computed(() => props.formData),
      ...props.api,
    };
  },
};
</script>
