<template>
  <div ref="swaggerContainer" class="swagger-ui-wrapper"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
// @ts-ignore - swagger-ui-dist doesn't have perfect types
import SwaggerUIBundle from 'swagger-ui-dist/swagger-ui-bundle.js'
import 'swagger-ui-dist/swagger-ui.css'

const props = defineProps<{
  spec: Record<string, unknown>
}>()

const swaggerContainer = ref<HTMLDivElement | null>(null)
let swaggerUI: any = null

onMounted(() => {
  renderSwagger()
})

watch(
  () => props.spec,
  () => {
    renderSwagger()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  // Cleanup if needed
  if (swaggerContainer.value) {
    swaggerContainer.value.innerHTML = ''
  }
})

const renderSwagger = () => {
  if (!swaggerContainer.value || !props.spec) return

  try {
    swaggerUI = SwaggerUIBundle({
      spec: props.spec,
      dom_id: '#' + (swaggerContainer.value.id || generateId()),
      domNode: swaggerContainer.value,
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    })
  } catch (error) {
    console.error('Error rendering Swagger UI:', error)
  }
}

const generateId = () => {
  const id = 'swagger-ui-' + Math.random().toString(36).substr(2, 9)
  if (swaggerContainer.value) {
    swaggerContainer.value.id = id
  }
  return id
}
</script>

<style>
.swagger-ui-wrapper {
  padding: 1.5rem;
  max-height: 800px;
  overflow-y: auto;
}

/* Customize swagger UI styles */
.swagger-ui .topbar {
  display: none;
}

.swagger-ui .info {
  margin: 20px 0;
}

.swagger-ui .scheme-container {
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
}
</style>
