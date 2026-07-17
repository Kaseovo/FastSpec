import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// Lazy-loaded: EditorView pulls in FormEditor + EditorPanel (Monaco), by far
// the heaviest part of the app. Splitting these means /specs/:id/preview
// (which only needs PreviewPanel) doesn't have to download the editor at
// all, and the editor route itself gets a dedicated chunk cached separately
// from the rest of the app shell.
const EditorView = () => import("../views/EditorView.vue");
const PreviewView = () => import("../views/PreviewView.vue");

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
