import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import UserProfile from "../UserProfile.vue";
import { useAuthStore } from "../../stores/auth";

let mock;

beforeEach(() => {
  setActivePinia(createPinia());
  mock = new MockAdapter(axios);
  mock.onGet("/api/version").reply(200, {
    version: "1.2.3",
    source_url: "https://git.example.com/fastspec",
  });
});

afterEach(() => mock.restore());

async function menuLabels(mode) {
  const auth = useAuthStore();
  auth.setAuthConfig({ mode, provider_name: null, login_url: null });
  auth.setAuth("t", { id: 1, email: "a@example.com", provider: "local" });
  const wrapper = mount(UserProfile, { global: { plugins: [PrimeVue] } });
  await flushPromises();
  return wrapper.vm.menuItems.filter((i) => i.label).map((i) => i.label);
}

test("links to the instance's source code (AGPL-3.0)", async () => {
  expect(await menuLabels("none")).toContain("Source code");
});

test("single-user mode has nothing to log out of", async () => {
  expect(await menuLabels("none")).not.toContain("Logout");
});

test("OIDC mode offers logout", async () => {
  expect(await menuLabels("oidc")).toEqual(["Source code", "Logout"]);
});
