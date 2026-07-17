// Tests for schema composition (oneOf/anyOf/allOf + discriminator) added to
// FormEditor's Components tab. Same mount-and-drive-via-wrapper.vm strategy
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

function specWithSchemas(schemas) {
  return {
    openapi: "3.0.0",
    info: { title: "Test API", version: "1.0.0" },
    servers: [],
    tags: [],
    paths: {},
    components: { schemas },
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
    props: { modelValue },
    global: {
      plugins: [PrimeVue, ConfirmationService, ToastService],
      directives: { tooltip: Tooltip },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe("FormEditor - getSchemaKind", () => {
  test("returns the plain type for a non-composition schema", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: { type: "object", properties: {} } }));
    expect(wrapper.vm.getSchemaKind(wrapper.vm.formData.components.schemas.Pet)).toBe("object");
  });

  test("defaults to 'object' when type is unset", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: {} }));
    expect(wrapper.vm.getSchemaKind(wrapper.vm.formData.components.schemas.Pet)).toBe("object");
  });

  test("returns 'oneOf'/'anyOf'/'allOf' when that array is present", () => {
    const wrapper = mountFE(
      specWithSchemas({
        A: { oneOf: [] },
        B: { anyOf: [] },
        C: { allOf: [] },
      })
    );
    const schemas = wrapper.vm.formData.components.schemas;
    expect(wrapper.vm.getSchemaKind(schemas.A)).toBe("oneOf");
    expect(wrapper.vm.getSchemaKind(schemas.B)).toBe("anyOf");
    expect(wrapper.vm.getSchemaKind(schemas.C)).toBe("allOf");
  });
});

describe("FormEditor - setSchemaKind", () => {
  test("switching to oneOf clears the previous type-specific fields", () => {
    const wrapper = mountFE(
      specWithSchemas({
        Pet: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setSchemaKind(schema, "oneOf");
    expect(schema).toEqual({ oneOf: [] });
  });

  test("switching to oneOf preserves description", () => {
    const wrapper = mountFE(
      specWithSchemas({ Pet: { type: "object", description: "A pet", properties: {} } })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setSchemaKind(schema, "oneOf");
    expect(schema).toEqual({ oneOf: [], description: "A pet" });
  });

  test("switching from oneOf back to object clears the composition array", () => {
    const wrapper = mountFE(
      specWithSchemas({ Pet: { oneOf: [{ $ref: "#/components/schemas/Cat" }] } })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setSchemaKind(schema, "object");
    expect(schema).toEqual({ type: "object", properties: {} });
  });

  test("switching to array sets a default string items schema", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: { oneOf: [] } }));
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setSchemaKind(schema, "array");
    expect(schema).toEqual({ type: "array", items: { type: "string" } });
  });
});

describe("FormEditor - composition members", () => {
  test("compositionMemberRefs extracts $ref strings from the member array", () => {
    const wrapper = mountFE(
      specWithSchemas({
        Pet: {
          oneOf: [
            { $ref: "#/components/schemas/Cat" },
            { $ref: "#/components/schemas/Dog" },
          ],
        },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    expect(wrapper.vm.compositionMemberRefs(schema, "oneOf")).toEqual([
      "#/components/schemas/Cat",
      "#/components/schemas/Dog",
    ]);
  });

  test("setCompositionMembers rebuilds the member array from a list of refs", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: { oneOf: [] } }));
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setCompositionMembers(schema, "oneOf", [
      "#/components/schemas/Cat",
      "#/components/schemas/Dog",
    ]);
    expect(schema.oneOf).toEqual([
      { $ref: "#/components/schemas/Cat" },
      { $ref: "#/components/schemas/Dog" },
    ]);
  });

  test("isCompositionKind distinguishes composition from plain types", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: { type: "object", properties: {} } }));
    expect(wrapper.vm.isCompositionKind("oneOf")).toBe(true);
    expect(wrapper.vm.isCompositionKind("anyOf")).toBe(true);
    expect(wrapper.vm.isCompositionKind("allOf")).toBe(true);
    expect(wrapper.vm.isCompositionKind("object")).toBe(false);
    expect(wrapper.vm.isCompositionKind("string")).toBe(false);
  });
});

describe("FormEditor - discriminator", () => {
  test("setDiscriminatorEnabled(true) adds a blank discriminator", () => {
    const wrapper = mountFE(specWithSchemas({ Pet: { oneOf: [] } }));
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setDiscriminatorEnabled(schema, true);
    expect(schema.discriminator).toEqual({ propertyName: "", mapping: {} });
  });

  test("setDiscriminatorEnabled(false) removes it", () => {
    const wrapper = mountFE(
      specWithSchemas({
        Pet: { oneOf: [], discriminator: { propertyName: "petType", mapping: {} } },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setDiscriminatorEnabled(schema, false);
    expect(schema.discriminator).toBeUndefined();
  });

  test("addDiscriminatorMapping / renameDiscriminatorMappingKey / removeDiscriminatorMapping", () => {
    const wrapper = mountFE(
      specWithSchemas({
        Pet: { oneOf: [], discriminator: { propertyName: "petType", mapping: {} } },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;

    wrapper.vm.addDiscriminatorMapping(schema);
    expect(schema.discriminator.mapping.newKey).toBe("");

    wrapper.vm.addDiscriminatorMapping(schema);
    expect(Object.keys(schema.discriminator.mapping)).toEqual(["newKey", "newKey1"]);

    wrapper.vm.renameDiscriminatorMappingKey(schema, "newKey", "cat");
    expect(schema.discriminator.mapping.cat).toBe("");
    expect(schema.discriminator.mapping.newKey).toBeUndefined();

    wrapper.vm.removeDiscriminatorMapping(schema, "newKey1");
    expect(Object.keys(schema.discriminator.mapping)).toEqual(["cat"]);
  });

  test("renameDiscriminatorMappingKey refuses to collide with an existing key", () => {
    const wrapper = mountFE(
      specWithSchemas({
        Pet: {
          oneOf: [],
          discriminator: { propertyName: "petType", mapping: { cat: "#/components/schemas/Cat", dog: "" } },
        },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.renameDiscriminatorMappingKey(schema, "dog", "cat");
    expect(schema.discriminator.mapping.dog).toBe("");
    expect(schema.discriminator.mapping.cat).toBe("#/components/schemas/Cat");
  });
});

describe("FormEditor - schema composition end-to-end", () => {
  test("building a discriminated oneOf and saving it round-trips through emitted output", async () => {
    const wrapper = mountFE(
      specWithSchemas({
        Cat: { type: "object", properties: {} },
        Dog: { type: "object", properties: {} },
        Pet: { type: "object", properties: {} },
      })
    );
    const schema = wrapper.vm.formData.components.schemas.Pet;
    wrapper.vm.setSchemaKind(schema, "oneOf");
    wrapper.vm.setCompositionMembers(schema, "oneOf", [
      "#/components/schemas/Cat",
      "#/components/schemas/Dog",
    ]);
    wrapper.vm.setDiscriminatorEnabled(schema, true);
    schema.discriminator.propertyName = "petType";
    wrapper.vm.addDiscriminatorMapping(schema);
    wrapper.vm.renameDiscriminatorMappingKey(schema, "newKey", "cat");
    schema.discriminator.mapping.cat = "#/components/schemas/Cat";

    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted("update:modelValue");
    const last = emitted[emitted.length - 1][0];
    expect(last.components.schemas.Pet).toEqual({
      oneOf: [
        { $ref: "#/components/schemas/Cat" },
        { $ref: "#/components/schemas/Dog" },
      ],
      discriminator: {
        propertyName: "petType",
        mapping: { cat: "#/components/schemas/Cat" },
      },
    });
  });
});
