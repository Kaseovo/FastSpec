<template>
  <div v-if="!spec || Object.keys(spec).length === 0" class="p-4 text-gray-500">
    <p>No specification available for preview</p>
  </div>
  <div v-else ref="swaggerContainer" class="bg-white rounded-lg shadow-sm"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import SwaggerUI from 'swagger-ui-react'
import { createRoot } from 'react-dom/client'
import 'swagger-ui-react/swagger-ui.css'
import { createElement } from 'react'

interface Props {
  spec: Record<string, unknown>
}

const props = defineProps<Props>()

const swaggerContainer = ref<HTMLElement | null>(null)
let root: ReturnType<typeof createRoot> | null = null

const renderSwagger = () => {
  if (swaggerContainer.value && props.spec && Object.keys(props.spec).length > 0) {
    if (!root) {
      root = createRoot(swaggerContainer.value)
    }
    root.render(createElement(SwaggerUI, { spec: props.spec }))
  }
}

onMounted(() => {
  renderSwagger()
})

watch(
  () => props.spec,
  () => {
    renderSwagger()
  },
  { deep: true },
)
</script>
