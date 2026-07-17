<template>
  <div class="proto-switcher">
    <button class="proto-switcher__arrow" @click="cycle(-1)" aria-label="Previous variant">
      <i class="pi pi-chevron-left"></i>
    </button>
    <div class="proto-switcher__label">
      <span class="proto-switcher__badge">{{ label }}</span>
      {{ current }} — {{ currentName }}
    </div>
    <button class="proto-switcher__arrow" @click="cycle(1)" aria-label="Next variant">
      <i class="pi pi-chevron-right"></i>
    </button>
    <button class="proto-switcher__exit" @click="exit">Exit</button>
  </div>
</template>

<script>
// Shared floating switcher for design-direction prototypes. Dev-only; never
// rendered in a production build. Reused by both form-editor-prototype/
// (?variant=) and page-prototype/ (?pageVariant=) — pass `variants` and
// `queryParam` to point it at whichever one is active.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export default {
  name: "PrototypeSwitcher",
  props: {
    variants: {
      type: Array,
      required: true,
      // [{ key: 'rail', name: 'Icon Rail' }, ...]
    },
    queryParam: {
      type: String,
      default: "variant",
    },
    label: {
      type: String,
      default: "PROTOTYPE",
    },
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();

    const current = computed(() => route.query[props.queryParam] || props.variants[0].key);
    const currentIndex = computed(() =>
      Math.max(0, props.variants.findIndex((v) => v.key === current.value)),
    );
    const currentName = computed(() => props.variants[currentIndex.value].name);

    const goTo = (key) => {
      router
        .replace({ query: { ...route.query, [props.queryParam]: key } })
        .catch(() => {});
    };

    const cycle = (dir) => {
      const next = (currentIndex.value + dir + props.variants.length) % props.variants.length;
      goTo(props.variants[next].key);
    };

    const exit = () => {
      const query = { ...route.query };
      delete query[props.queryParam];
      router.replace({ query }).catch(() => {});
    };

    const onKeydown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKeydown);

    return { current, currentName, cycle, exit };
  },
};
</script>

<style scoped>
.proto-switcher {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #111827;
  color: #fff;
  border-radius: 999px;
  padding: 6px 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-family: "Space Grotesk", sans-serif;
  font-size: 13px;
}

.proto-switcher__arrow {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.proto-switcher__arrow:hover {
  background: rgba(255, 255, 255, 0.2);
}

.proto-switcher__label {
  padding: 0 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.proto-switcher__badge {
  background: #f59e0b;
  color: #1f2937;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
}

.proto-switcher__exit {
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  margin-left: 4px;
}

.proto-switcher__exit:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
