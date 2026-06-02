import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import TokenManager from "./TokenManager.vue";
import * as authApi from "../api/auth";

vi.mock("../api/auth", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  updateApiKeyActions: vi.fn(),
  fetchAvailableActions: vi.fn(),
}));

const MCP_URL = "http://localhost:9000/mcp";

beforeAll(() => {
  vi.stubEnv("VITE_MCP_URL", MCP_URL);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// Stub import.meta.env.VITE_MCP_URL

function mountComponent() {
  return mount(TokenManager, {
    attachTo: document.body,
    global: {
      plugins: [PrimeVue, ToastService, createPinia()],
    },
  });
}

describe("TokenManager MCP URL field", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authApi.listApiKeys.mockResolvedValue([]);
    authApi.fetchAvailableActions.mockResolvedValue([]);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("MCP URL field is not visible before creation", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    // Open create dialog
    await wrapper.find("button.p-button-primary").trigger("click");
    await flushPromises();

    expect(document.body.textContent).not.toContain("MCP Server URL");
  });

  test("MCP URL field is visible after handleCreate resolves", async () => {
    authApi.createApiKey.mockResolvedValue({
      api_key: "test-api-key-value",
      id: "key-1",
      expires_at: new Date().toISOString(),
    });

    const wrapper = mountComponent();
    await flushPromises();

    // Open create dialog
    await wrapper.find("button.p-button-primary").trigger("click");
    await flushPromises();

    // Directly invoke handleCreate via vm
    await wrapper.vm.handleCreate();
    await flushPromises();

    expect(document.body.textContent).toContain("MCP Server URL");
    // URL is in an input value, not text content — check via vm
    expect(wrapper.vm.mcpUrl).toBe(MCP_URL);
  });

  test("clicking MCP URL copy button calls clipboard.writeText with VITE_MCP_URL", async () => {
    authApi.createApiKey.mockResolvedValue({
      api_key: "test-api-key-value",
      id: "key-1",
      expires_at: new Date().toISOString(),
    });

    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find("button.p-button-primary").trigger("click");
    await flushPromises();

    // Directly invoke handleCreate via vm
    await wrapper.vm.handleCreate();
    await flushPromises();

    // Find the copy button for the MCP URL section (teleported to body)
    const mcpSection = document.querySelector(".mcp-url-section");
    expect(mcpSection).not.toBeNull();
    const copyBtn = mcpSection.querySelector("button");
    await copyBtn.click();
    await flushPromises();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MCP_URL);
  });
});
