<template>
  <header class="app-header">
    <div class="header-left">
      <a href="/" class="logo-link">
        <img src="/logo.svg" alt="FastSpec" class="logo" />
      </a>
      <span v-if="version" class="version-badge">v{{ version }}</span>
    </div>
    <div class="header-center">
      <p class="tagline">Create, edit, and validate OpenAPI specifications</p>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const version = ref(null)

onMounted(async () => {
  try {
    const res = await fetch('/api/version')
    if (res.ok) {
      const data = await res.json()
      version.value = data.version
      return
    }
  } catch {}
  try {
    const env = await fetch('/specs/env.version')
    if (env.ok) {
      const txt = await env.text()
      const m = txt.match(/REACT_APP_VERSION=(.+)/)
      if (m) version.value = m[1]
    }
  } catch {}
})
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #ffffff;
  border-bottom: 1px solid var(--fs-border, #e5e7eb);
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-link {
  display: flex;
  align-items: center;
}

.logo {
  height: 28px;
  width: auto;
}

.version-badge {
  font-size: 0.75rem;
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.header-center {
  flex: 1;
  text-align: center;
}

.tagline {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}
</style>
