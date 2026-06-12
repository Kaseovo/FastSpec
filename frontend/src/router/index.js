import { createRouter, createWebHistory } from "vue-router";
import EditorView from "../views/EditorView.vue";
import PreviewView from "../views/PreviewView.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  { path: "/specs", component: EditorView, name: "editor" },
  { path: "/specs/:id", component: EditorView, name: "editor-id", props: true },
  {
    path: "/specs/:id/preview",
    component: PreviewView,
    name: "preview",
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    const landingUrl = import.meta.env.VITE_LANDING_URL || "";
    window.location.href = landingUrl ? landingUrl + "/" : "/";
    return false;
  }
  return true;
});

export function getRouter() {
  return router;
}

export default router;
