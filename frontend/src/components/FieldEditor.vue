<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center mb-4">
      <h4 class="font-semibold text-gray-800 text-lg flex items-center gap-2">
        <i class="pi pi-list text-blue-500"></i>
        {{ title }}
      </h4>
      <Button
        :label="showAddField ? 'Cancel' : 'Add Field'"
        :icon="showAddField ? 'pi pi-times' : 'pi pi-plus'"
        size="small"
        :severity="showAddField ? 'secondary' : 'success'"
        @click="showAddField = !showAddField"
      />
    </div>

    <Card v-if="showAddField" class="border-2 border-blue-200 shadow-sm">
      <template #content>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Field Name <span class="text-red-500">*</span>
            </label>
            <InputText v-model="newField.name" placeholder="fieldName" class="w-full" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Select v-model="newField.type" :options="fieldTypes" class="w-full" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <InputText v-model="newField.description" placeholder="Field description" class="w-full" />
          </div>

          <div class="flex items-center">
            <Checkbox v-model="newField.required" inputId="new-field-required" :binary="true" />
            <label for="new-field-required" class="ml-2 text-sm text-gray-700"> Required field </label>
          </div>

          <Button label="Add Field" icon="pi pi-check" @click="handleAddField" class="w-full" severity="success" />
        </div>
      </template>
    </Card>

    <div v-if="Object.keys(fields).length === 0 && !showAddField" class="text-center py-8">
      <i class="pi pi-inbox text-4xl text-gray-300 block mb-2"></i>
      <p class="text-gray-500 text-sm">
        No fields defined. Click "Add Field" to create one.
      </p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="[fieldName, field] in Object.entries(fields)"
        :key="fieldName"
        class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900">{{ fieldName }}</span>
              <Tag v-if="field.required" value="Required" severity="danger" />
              <Tag :value="field.type" />
            </div>
            <p v-if="field.description" class="text-sm text-gray-600 mt-1">
              {{ field.description }}
            </p>
            <div
              v-if="Object.keys(field.constraints || {}).length > 0"
              class="mt-1 text-xs text-gray-500"
            >
              Constraints:
              {{
                Object.entries(field.constraints || {})
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')
              }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              :label="expandedField === fieldName ? 'Collapse' : 'Edit'"
              text
              size="small"
              @click="expandedField = expandedField === fieldName ? null : fieldName"
            />
            <Button
              label="Delete"
              text
              severity="danger"
              size="small"
              @click="handleDeleteField(fieldName)"
            />
          </div>
        </div>

        <div
          v-if="expandedField === fieldName"
          class="mt-4 space-y-3 pt-3 border-t border-gray-200"
        >
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <InputText
              :model-value="field.description"
              @update:model-value="handleUpdateField(fieldName, { description: $event })"
              placeholder="Field description"
              class="w-full"
            />
          </div>

          <div class="flex items-center">
            <Checkbox
              :model-value="field.required"
              @update:model-value="handleUpdateField(fieldName, { required: $event })"
              :input-id="`required-${fieldName}`"
              :binary="true"
            />
            <label :for="`required-${fieldName}`" class="ml-2 text-sm text-gray-700">
              Required field
            </label>
          </div>

          <FieldConstraints
            :field-name="fieldName"
            :field="field"
            @update="handleConstraintChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import FieldConstraints from './FieldConstraints.vue'

export interface FieldConstraints {
  maxLength?: number
  minLength?: number
  pattern?: string
  maximum?: number
  minimum?: number
  maxItems?: number
  minItems?: number
}

export interface Field {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string
  constraints?: FieldConstraints
  items?: { type: string }
  properties?: Record<string, Field>
}

interface Props {
  fields: Record<string, Field>
  title?: string
}

interface Emits {
  (e: 'update', fields: Record<string, Field>): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Fields',
})

const emit = defineEmits<Emits>()

const toast = useToast()
const confirm = useConfirm()

const fieldTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object']

const expandedField = ref<string | null>(null)
const showAddField = ref(false)
const newField = ref<Field>({
  name: '',
  type: 'string',
  required: false,
  description: '',
  constraints: {},
})

const handleAddField = () => {
  if (!newField.value.name) {
    toast.add({
      severity: 'warn',
      summary: 'Warning',
      detail: 'Field name is required',
      life: 3000,
    })
    return
  }
  if (props.fields[newField.value.name]) {
    toast.add({
      severity: 'warn',
      summary: 'Warning',
      detail: 'Field with this name already exists',
      life: 3000,
    })
    return
  }

  const updatedFields = {
    ...props.fields,
    [newField.value.name]: { ...newField.value },
  }
  emit('update', updatedFields)
  newField.value = {
    name: '',
    type: 'string',
    required: false,
    description: '',
    constraints: {},
  }
  showAddField.value = false
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: 'Field added successfully',
    life: 3000,
  })
}

const handleDeleteField = (fieldName: string) => {
  confirm.require({
    message: `Are you sure you want to delete field "${fieldName}"?`,
    header: 'Confirm Deletion',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => {
      const updatedFields = { ...props.fields }
      delete updatedFields[fieldName]
      emit('update', updatedFields)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Field deleted successfully',
        life: 3000,
      })
    },
  })
}

const handleUpdateField = (fieldName: string, updates: Partial<Field>) => {
  const updatedFields: Record<string, Field> = {
    ...props.fields,
    [fieldName]: { ...props.fields[fieldName], ...updates } as Field,
  }
  emit('update', updatedFields)
}

const handleConstraintChange = (fieldName: string, constraint: string, value: string | number) => {
  const field = props.fields[fieldName]
  if (!field) return

  const constraints = { ...field.constraints }

  if (value === '' || value === null || value === undefined) {
    delete (constraints as Record<string, unknown>)[constraint]
  } else {
    ;(constraints as Record<string, string | number>)[constraint] = value
  }

  handleUpdateField(fieldName, { constraints })
}
</script>
