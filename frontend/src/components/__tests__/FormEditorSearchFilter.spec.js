// Tests for the Paths/Components search + method-filter added to FormEditor.
// Same strategy as the other FormEditor tab spec files: mount the real
// component and drive it via `wrapper.vm.<fn>()`, asserting on the exposed
// computeds directly.

import { mount } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import FormEditor from "../FormEditor.vue";

global.ResizeObserver =
  global.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  };

vi.mock("primevue/useconfirm", () => ({
  useConfirm: () => ({
    require: (opts) => opts.accept && opts.accept(),
    close: () => {},
  }),
}));

function specWithPathsAndSchemas() {
  return {
    openapi: "3.0.0",
    info: { title: "Test API", version: "1.0.0" },
    servers: [],
    tags: [],
    paths: {
      "/users": {
        get: {
          summary: "List users",
          operationId: "listUsers",
          tags: ["Users"],
          responses: { 200: { description: "ok" } },
        },
        post: {
          summary: "Create user",
          operationId: "createUser",
          tags: ["Users"],
          responses: { 201: { description: "created" } },
        },
      },
      "/orders": {
        get: {
          summary: "List orders",
          operationId: "listOrders",
          tags: ["Orders"],
          responses: { 200: { description: "ok" } },
        },
      },
      "/orders/{id}": {
        delete: {
          summary: "Cancel an order",
          operationId: "cancelOrder",
          tags: ["Orders"],
          responses: { 204: { description: "no content" } },
        },
      },
    },
    components: {
      schemas: {
        User: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
        Order: { type: "object", properties: { id: { type: "string" }, total: { type: "number" } } },
        Address: { type: "object", properties: { street: { type: "string" }, userId: { type: "string" } } },
      },
    },
  };
}

const mountedWrappers = [];

afterEach(() => {
  while (mountedWrappers.length) {
    const w = mountedWrappers.pop();
    try {
      w.unmount();
    } catch {
      // ignore teardown errors from already-detached components
    }
  }
});

function mountFE(modelValue) {
  const wrapper = mount(FormEditor, {
    props: { modelValue: modelValue || specWithPathsAndSchemas() },
    global: {
      plugins: [PrimeVue, ConfirmationService, ToastService],
      directives: { tooltip: Tooltip },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe("FormEditor - Paths search/filter", () => {
  test("filteredPathsList matches all paths with an empty query", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.filteredPathsList.map((p) => p.path).sort()).toEqual(
      ["/orders", "/orders/{id}", "/users"].sort()
    );
  });

  test("search matches the path string itself", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "order";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredPathsList.map((p) => p.path).sort()).toEqual(
      ["/orders", "/orders/{id}"].sort()
    );
  });

  test("search matches operation summary", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "cancel";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredPathsList.map((p) => p.path)).toEqual(["/orders/{id}"]);
  });

  test("search matches operationId", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "createUser";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredPathsList.map((p) => p.path)).toEqual(["/users"]);
  });

  test("search matches operation tags", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "Users";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredPathsList.map((p) => p.path)).toEqual(["/users"]);
  });

  test("search is case-insensitive", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "ORDER";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredPathsList.length).toBe(2);
  });

  test("method filter narrows to paths with a matching method", () => {
    const wrapper = mountFE();
    wrapper.vm.togglePathMethodFilter("delete");
    expect(wrapper.vm.filteredPathsList.map((p) => p.path)).toEqual(["/orders/{id}"]);
  });

  test("method filter toggles off when clicked again", () => {
    const wrapper = mountFE();
    wrapper.vm.togglePathMethodFilter("get");
    wrapper.vm.togglePathMethodFilter("get");
    expect(wrapper.vm.pathMethodFilter).toEqual([]);
    expect(wrapper.vm.filteredPathsList.length).toBe(3);
  });

  test("multiple selected methods are OR'd together", () => {
    const wrapper = mountFE();
    wrapper.vm.togglePathMethodFilter("post");
    wrapper.vm.togglePathMethodFilter("delete");
    expect(wrapper.vm.filteredPathsList.map((p) => p.path).sort()).toEqual(
      ["/orders/{id}", "/users"].sort()
    );
  });

  test("search and method filter combine with AND semantics", async () => {
    const wrapper = mountFE();
    wrapper.vm.togglePathMethodFilter("get");
    wrapper.vm.pathSearchQuery = "order";
    await wrapper.vm.$nextTick();
    // /orders has a GET; /orders/{id} only has DELETE, so it's excluded even
    // though its path text also matches "order".
    expect(wrapper.vm.filteredPathsList.map((p) => p.path)).toEqual(["/orders"]);
  });

  test("hasActivePathFilter reflects query and method filter state", async () => {
    const wrapper = mountFE();
    expect(wrapper.vm.hasActivePathFilter).toBe(false);
    wrapper.vm.pathSearchQuery = "x";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.hasActivePathFilter).toBe(true);
    wrapper.vm.pathSearchQuery = "";
    wrapper.vm.togglePathMethodFilter("get");
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.hasActivePathFilter).toBe(true);
  });

  test("clearPathFilters resets both query and method filter", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "order";
    wrapper.vm.togglePathMethodFilter("get");
    await wrapper.vm.$nextTick();
    wrapper.vm.clearPathFilters();
    expect(wrapper.vm.pathSearchQuery).toBe("");
    expect(wrapper.vm.pathMethodFilter).toEqual([]);
    expect(wrapper.vm.filteredPathsList.length).toBe(3);
  });

  test("visiblePathSet contains exactly the filtered paths, for v-show-based hiding", async () => {
    const wrapper = mountFE();
    wrapper.vm.pathSearchQuery = "user";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.visiblePathSet).toEqual(new Set(["/users"]));
  });

  test("no query or method filter yields an empty pathMethodFilter and unfiltered results", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.pathMethodFilter).toEqual([]);
    expect(wrapper.vm.filteredPathsList.length).toBe(wrapper.vm.pathsList.length);
  });
});

describe("FormEditor - Components search", () => {
  test("filteredSchemasList matches all schemas with an empty query", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.filteredSchemasList.map((s) => s.name).sort()).toEqual(
      ["Address", "Order", "User"].sort()
    );
  });

  test("search matches the schema name", async () => {
    const wrapper = mountFE();
    wrapper.vm.schemaSearchQuery = "ord";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredSchemasList.map((s) => s.name)).toEqual(["Order"]);
  });

  test("search matches a property name even when the schema name doesn't match", async () => {
    const wrapper = mountFE();
    wrapper.vm.schemaSearchQuery = "userId";
    await wrapper.vm.$nextTick();
    // Address has a `userId` property but its own name doesn't contain "userId"
    expect(wrapper.vm.filteredSchemasList.map((s) => s.name)).toEqual(["Address"]);
  });

  test("search is case-insensitive", async () => {
    const wrapper = mountFE();
    wrapper.vm.schemaSearchQuery = "EMAIL";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredSchemasList.map((s) => s.name)).toEqual(["User"]);
  });

  test("hasActiveSchemaFilter reflects query state", async () => {
    const wrapper = mountFE();
    expect(wrapper.vm.hasActiveSchemaFilter).toBe(false);
    wrapper.vm.schemaSearchQuery = "x";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.hasActiveSchemaFilter).toBe(true);
  });

  test("clearSchemaFilter resets the query", async () => {
    const wrapper = mountFE();
    wrapper.vm.schemaSearchQuery = "ord";
    await wrapper.vm.$nextTick();
    wrapper.vm.clearSchemaFilter();
    expect(wrapper.vm.schemaSearchQuery).toBe("");
    expect(wrapper.vm.filteredSchemasList.length).toBe(3);
  });

  test("a query matching nothing yields an empty list, not an error", async () => {
    const wrapper = mountFE();
    wrapper.vm.schemaSearchQuery = "zzz-does-not-exist";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredSchemasList).toEqual([]);
  });
});
