// Regression tests: switching a property's Type to "array" in each of the
// three single-item-type property editors (request body properties, schema
// properties, inline response properties) must seed a valid `items.type`
// instead of leaving `items: {}`. The shared onPropertyTypeChange()
// deliberately leaves items type-less (other editors' tests pin that), and
// each of these dialogs' "Array Items Type" control is v-if'd on
// `prop.items` alone being truthy -- already satisfied by items:{} -- so it
// used to render unselected, and saving without touching it exported an
// invalid array schema (see CONTEXT.md's Item Schema entry).

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

describe("Request body property (EditPropertyDialog) - array Type switch", () => {
  test("seeds items: {type: 'string'} and does not clobber an existing item type", () => {
    const wrapper = mountFE();
    wrapper.vm.newPath = "users";
    wrapper.vm.newMethod = "post";
    wrapper.vm.addPath();
    wrapper.vm.requestBodyContentType = "application/json";
    wrapper.vm.requestBodySchemaType = "inline";
    wrapper.vm.addRequestBodyProperty();
    wrapper.vm.openEditPropertyDialog("newProperty");

    const dialog = wrapper.findComponent({ name: "EditPropertyDialog" });
    expect(dialog.exists()).toBe(true);

    const property = dialog.vm.property;
    property.type = "array";
    dialog.vm.onTypeChange();
    expect(property.items).toEqual({ type: "string" });

    // Re-running must not clobber a type the user already picked.
    property.items.type = "integer";
    dialog.vm.onTypeChange();
    expect(property.items).toEqual({ type: "integer" });
  });
});

describe("Schema property (EditSchemaPropertyDialog) - array Type switch", () => {
  test("seeds items: {type: 'string'} on the property object", () => {
    const wrapper = mountFE();
    wrapper.vm.addSchema(); // creates "NewSchema"
    wrapper.vm.addSchemaProperty("NewSchema");
    wrapper.vm.openEditSchemaPropertyDialog("NewSchema", "newProperty");

    const dialog = wrapper.findComponent({ name: "EditSchemaPropertyDialog" });
    expect(dialog.exists()).toBe(true);

    const property = dialog.vm.property;
    // addSchemaProperty pre-seeds a default `items: {type: "string"}` on
    // every new property regardless of its type, which would mask this bug
    // (onPropertyTypeChange only initializes `items` when it's *absent*).
    // A property loaded from a real, previously-saved non-array type (e.g.
    // boolean) has no `items` key at all, which is the actual failure case
    // -- delete it first to reproduce that starting state.
    delete property.items;
    property.type = "array";
    dialog.vm.onTypeChange();
    expect(property.items).toEqual({ type: "string" });
  });
});

describe("Inline response property (OperationResponsesStep) - array Type switch", () => {
  test("seeds items: {type: 'string'} via onResponsePropertyTypeChange", async () => {
    const wrapper = mountFE();
    wrapper.vm.newPath = "users";
    wrapper.vm.newMethod = "get";
    wrapper.vm.addPath();
    wrapper.vm.selectAndOpenPath("/users", "get"); // accordion panel must be open to render
    const response = wrapper.vm.formData.paths["/users"].get.responses["200"];
    wrapper.vm.setResponseContentType(response, "application/json");
    wrapper.vm.addResponseProperty(response);

    const pathsTab = wrapper.findComponent({ name: "PathsTab" });
    // PathsTab watches selectedPath/selectedMethod and resets
    // activeOperationStep to "basicInfo" -- let that settle (from
    // selectAndOpenPath above) before overriding it, or the watcher's
    // deferred reset clobbers this write on the same tick.
    await wrapper.vm.$nextTick();
    pathsTab.vm.activeOperationStep = "responses";
    await wrapper.vm.$nextTick();

    const step = wrapper.findComponent({ name: "OperationResponsesStep" });
    expect(step.exists()).toBe(true);

    const schema = wrapper.vm.getResponseInlineSchema(response);
    const prop = schema.properties.newProperty;
    prop.type = "array";
    step.vm.onResponsePropertyTypeChange(prop);

    expect(prop.items).toEqual({ type: "string" });
  });
});
