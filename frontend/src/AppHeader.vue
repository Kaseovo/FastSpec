<template>
  <div class="header">
    <h1>🧩 FastSpec</h1>
    <p>Create, edit, and validate OpenAPI specifications</p>
    <p v-if="version" class="version">v{{ version }}</p>
  </div>
</template>

<script>
export default {
  name: "AppHeader",
  data() {
    return {
      version: null,
    };
  },
  async created() {
    // Try backend first
    try {
      const res = await fetch("/api/version");
      if (res.ok) {
        const data = await res.json();
        this.version = data.version;
        return;
      }
    } catch {}
    // Fallback to env file
    try {
      const env = await fetch("/specs/env.version");
      if (env.ok) {
        const txt = await env.text();
        const m = txt.match(/REACT_APP_VERSION=(.+)/);
        if (m) this.version = m[1];
      }
    } catch {}
  },
};
</script>

<style scoped>
.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.header p {
  color: #6b7280;
  font-size: 1.1rem;
}
.version {
  color: #888;
  font-size: 1rem;
  margin-top: 4px;
}
</style>
