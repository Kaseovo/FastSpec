// Tests for inline validation added to the Paths tab: duplicate operationId
// (document-wide), duplicate parameter (name + in) within an operation, and
// missing response description. Same mount-and-drive-via-wrapper.vm strategy
// as the other FormEditor tab spec files.

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

function baseModelValue(overrides = {}) {
  return {
    openapi: "3.0.0",
    info: { title: "Test API", version: "1.0.0" },
    servers: [],
    tags: [],
    paths: {},
    components: { schemas: {} },
    ...overrides,
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
    props: { modelValue: modelValue || baseModelValue() },
    global: {
      plugins: [PrimeVue, ConfirmationService, ToastService],
      directives: { tooltip: Tooltip },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe("FormEditor - duplicate operationId validation", () => {
  test("returns false when operationId is unique", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/a": { get: { operationId: "getA", responses: { 200: { description: "ok" } } } },
          "/b": { get: { operationId: "getB", responses: { 200: { description: "ok" } } } },
        },
      })
    );
    expect(wrapper.vm.isOperationIdDuplicate("/a", "get")).toBe(false);
  });

  test("returns true when two operations share an operationId", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/a": { get: { operationId: "same", responses: { 200: { description: "ok" } } } },
          "/b": { get: { operationId: "same", responses: { 200: { description: "ok" } } } },
        },
      })
    );
    expect(wrapper.vm.isOperationIdDuplicate("/a", "get")).toBe(true);
    expect(wrapper.vm.isOperationIdDuplicate("/b", "get")).toBe(true);
  });

  test("detects duplicates across different methods on different paths, not just siblings", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/a": { get: { operationId: "dupe", responses: { 200: { description: "ok" } } } },
          "/b": { post: { operationId: "dupe", responses: { 200: { description: "ok" } } } },
        },
      })
    );
    expect(wrapper.vm.isOperationIdDuplicate("/a", "get")).toBe(true);
    expect(wrapper.vm.isOperationIdDuplicate("/b", "post")).toBe(true);
  });

  test("empty/unset operationId is never flagged as a duplicate", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/a": { get: { operationId: "", responses: { 200: { description: "ok" } } } },
          "/b": { get: { operationId: "", responses: { 200: { description: "ok" } } } },
        },
      })
    );
    expect(wrapper.vm.isOperationIdDuplicate("/a", "get")).toBe(false);
  });
});

describe("FormEditor - duplicate parameter validation", () => {
  test("returns false for a unique (name, in) pair", () => {
    const wrapper = mountFE();
    const parameters = [
      { name: "id", in: "path" },
      { name: "id", in: "query" },
    ];
    expect(wrapper.vm.isParameterDuplicate(parameters, 0)).toBe(false);
    expect(wrapper.vm.isParameterDuplicate(parameters, 1)).toBe(false);
  });

  test("returns true for two parameters with the same name AND location", () => {
    const wrapper = mountFE();
    const parameters = [
      { name: "filter", in: "query" },
      { name: "filter", in: "query" },
    ];
    expect(wrapper.vm.isParameterDuplicate(parameters, 0)).toBe(true);
    expect(wrapper.vm.isParameterDuplicate(parameters, 1)).toBe(true);
  });

  test("empty parameter name is never flagged as a duplicate", () => {
    const wrapper = mountFE();
    const parameters = [
      { name: "", in: "query" },
      { name: "", in: "query" },
    ];
    expect(wrapper.vm.isParameterDuplicate(parameters, 0)).toBe(false);
  });
});

describe("FormEditor - missing response description validation", () => {
  test("returns true when description is absent", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.isResponseDescriptionMissing({})).toBe(true);
  });

  test("returns true when description is whitespace-only", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.isResponseDescriptionMissing({ description: "   " })).toBe(true);
  });

  test("returns false when description is present", () => {
    const wrapper = mountFE();
    expect(wrapper.vm.isResponseDescriptionMissing({ description: "ok" })).toBe(false);
  });
});
