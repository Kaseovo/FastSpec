// Characterization tests for FormEditor.vue's "Components / schemas" tab.
//
// Same strategy as FormEditorPathsTab.spec.js: mount the real FormEditor and
// drive it through `wrapper.vm.<fn>()`, asserting on `wrapper.vm.formData`
// mutations directly, since that's exactly what a future structural
// extraction (splitting the Components tab into its own SFC) must preserve.

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
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

function mockDragEvent(overrides = {}) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { effectAllowed: "", dropEffect: "", setData: vi.fn() },
    target: { classList: { add: vi.fn(), remove: vi.fn() } },
    ...overrides,
  };
}

describe("FormEditor - Components (schemas) tab", () => {
  describe("empty state", () => {
    test("shows empty state message when there are no schemas", () => {
      const wrapper = mountFE();
      expect(wrapper.text()).toContain("No schemas defined. Add one to get started.");
    });

    test("schemasList is empty for a fresh formData", () => {
      const wrapper = mountFE();
      expect(wrapper.vm.schemasList).toEqual([]);
    });
  });

  describe("addSchema", () => {
    test("creates a schema named 'NewSchema' with an empty object shape", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      expect(wrapper.vm.formData.components.schemas.NewSchema).toEqual({
        type: "object",
        properties: {},
      });
    });

    test("increments the name on collision: NewSchema -> NewSchema1 -> NewSchema2", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchema();
      wrapper.vm.addSchema();
      expect(Object.keys(wrapper.vm.formData.components.schemas)).toEqual([
        "NewSchema",
        "NewSchema1",
        "NewSchema2",
      ]);
    });

    test("skips over a manually-named NewSchema1 gap and still avoids collision", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.NewSchema = { type: "object", properties: {} };
      wrapper.vm.formData.components.schemas.NewSchema2 = { type: "object", properties: {} };
      wrapper.vm.addSchema();
      // counter starts at 1 -> tries NewSchema1 first, which is free
      expect(wrapper.vm.formData.components.schemas.NewSchema1).toBeTruthy();
    });
  });

  describe("removeSchema", () => {
    test("deletes the schema via confirm.accept", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.removeSchema("NewSchema");
      expect(wrapper.vm.formData.components.schemas.NewSchema).toBeUndefined();
    });
  });

  describe("renameSchema", () => {
    test("renames the schema key while preserving insertion order and data", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: { x: { type: "string" } } };
      wrapper.vm.formData.components.schemas.B = { type: "object", properties: {} };
      wrapper.vm.renameSchema("A", "Renamed");
      expect(Object.keys(wrapper.vm.formData.components.schemas)).toEqual(["Renamed", "B"]);
      expect(wrapper.vm.formData.components.schemas.Renamed.properties.x).toEqual({ type: "string" });
    });

    test("updates $ref strings elsewhere in the document that point at the old name", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.User = { type: "object", properties: {} };
      wrapper.vm.formData.components.schemas.Wrapper = {
        type: "object",
        properties: { user: { type: "$ref", $ref: "#/components/schemas/User" } },
      };
      wrapper.vm.formData.paths["/users"] = {
        get: {
          responses: {
            200: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/User" } },
              },
            },
          },
        },
      };

      wrapper.vm.renameSchema("User", "Account");

      expect(wrapper.vm.formData.components.schemas.Wrapper.properties.user.$ref).toBe(
        "#/components/schemas/Account"
      );
      expect(
        wrapper.vm.formData.paths["/users"].get.responses[200].content["application/json"].schema
          .$ref
      ).toBe("#/components/schemas/Account");
    });

    test("is a no-op when newName is empty", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {} };
      wrapper.vm.renameSchema("A", "");
      expect(wrapper.vm.formData.components.schemas.A).toBeTruthy();
    });

    test("is a no-op when newName equals oldName", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {}, marker: 1 };
      wrapper.vm.renameSchema("A", "A");
      expect(wrapper.vm.formData.components.schemas.A.marker).toBe(1);
    });

    test("is a no-op when newName already exists as a different schema", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {}, marker: "a" };
      wrapper.vm.formData.components.schemas.B = { type: "object", properties: {}, marker: "b" };
      wrapper.vm.renameSchema("A", "B");
      expect(wrapper.vm.formData.components.schemas.A.marker).toBe("a");
      expect(wrapper.vm.formData.components.schemas.B.marker).toBe("b");
    });
  });

  describe("updateSchema", () => {
    test("replaces the schema with parsed JSON", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {} };
      wrapper.vm.updateSchema("A", JSON.stringify({ type: "string", format: "uuid" }));
      expect(wrapper.vm.formData.components.schemas.A).toEqual({ type: "string", format: "uuid" });
    });

    test("leaves the schema untouched on invalid JSON", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {} };
      wrapper.vm.updateSchema("A", "{not valid json");
      expect(wrapper.vm.formData.components.schemas.A).toEqual({ type: "object", properties: {} });
    });
  });

  describe("schema properties", () => {
    test("addSchemaProperty adds newProperty with a default string+items shape, incrementing on collision", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema(); // NewSchema
      wrapper.vm.addSchemaProperty("NewSchema");
      wrapper.vm.addSchemaProperty("NewSchema");
      const props = wrapper.vm.formData.components.schemas.NewSchema.properties;
      expect(Object.keys(props)).toEqual(["newProperty", "newProperty1"]);
      expect(props.newProperty).toEqual({
        type: "string",
        description: "",
        items: { type: "string" },
      });
    });

    test("removeSchemaProperty deletes the property and prunes required[] via confirm.accept", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      wrapper.vm.toggleSchemaPropertyRequired("NewSchema", "newProperty", true);
      wrapper.vm.removeSchemaProperty("NewSchema", "newProperty");
      const schema = wrapper.vm.formData.components.schemas.NewSchema;
      expect(schema.properties.newProperty).toBeUndefined();
      expect(schema.required).toEqual([]);
    });

    test("renameSchemaProperty renames and keeps required[] in sync", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      wrapper.vm.toggleSchemaPropertyRequired("NewSchema", "newProperty", true);
      wrapper.vm.renameSchemaProperty("NewSchema", "newProperty", "id");
      const schema = wrapper.vm.formData.components.schemas.NewSchema;
      expect(schema.properties.id).toBeTruthy();
      expect(schema.properties.newProperty).toBeUndefined();
      expect(schema.required).toEqual(["id"]);
    });

    test("renameSchemaProperty is a no-op for empty new name or same name", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      wrapper.vm.renameSchemaProperty("NewSchema", "newProperty", "");
      wrapper.vm.renameSchemaProperty("NewSchema", "newProperty", "newProperty");
      expect(
        Object.keys(wrapper.vm.formData.components.schemas.NewSchema.properties)
      ).toEqual(["newProperty"]);
    });

    test("renameSchemaProperty refuses to overwrite an existing property name", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema"); // newProperty
      wrapper.vm.addSchemaProperty("NewSchema"); // newProperty1
      wrapper.vm.renameSchemaProperty("NewSchema", "newProperty", "newProperty1");
      expect(
        Object.keys(wrapper.vm.formData.components.schemas.NewSchema.properties)
      ).toEqual(["newProperty", "newProperty1"]);
    });

    test("toggleSchemaPropertyRequired initializes required[] on first use and toggles idempotently", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      const schema = wrapper.vm.formData.components.schemas.NewSchema;
      expect(schema.required).toBeUndefined();

      wrapper.vm.toggleSchemaPropertyRequired("NewSchema", "newProperty", true);
      wrapper.vm.toggleSchemaPropertyRequired("NewSchema", "newProperty", true); // idempotent add
      expect(schema.required).toEqual(["newProperty"]);

      wrapper.vm.toggleSchemaPropertyRequired("NewSchema", "newProperty", false);
      expect(schema.required).toEqual([]);
    });
  });

  describe("onSchemaTypeChange", () => {
    test("initializes .items when switching to array without existing items", () => {
      const wrapper = mountFE();
      const schema = { name: "Arr", data: { type: "array" } };
      wrapper.vm.onSchemaTypeChange(schema);
      expect(schema.data.items).toEqual({ type: "string" });
    });

    test("does not clobber existing .items when switching to array", () => {
      const wrapper = mountFE();
      const schema = { name: "Arr", data: { type: "array", items: { type: "number" } } };
      wrapper.vm.onSchemaTypeChange(schema);
      expect(schema.data.items).toEqual({ type: "number" });
    });

    test("initializes .properties when switching to object without existing properties", () => {
      const wrapper = mountFE();
      const schema = { name: "Obj", data: { type: "object" } };
      wrapper.vm.onSchemaTypeChange(schema);
      expect(schema.data.properties).toEqual({});
    });

    test("is a no-op for scalar types", () => {
      const wrapper = mountFE();
      const schema = { name: "Str", data: { type: "string" } };
      wrapper.vm.onSchemaTypeChange(schema);
      expect(schema.data.items).toBeUndefined();
      expect(schema.data.properties).toBeUndefined();
    });
  });

  describe("onPropertyTypeChange (schema property context)", () => {
    test("array type only seeds items when missing (addSchemaProperty already defaults items:{type:'string'}) and always seeds _itemSchemas:[]", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      const prop = wrapper.vm.formData.components.schemas.NewSchema.properties.newProperty;
      prop.type = "array";
      wrapper.vm.onPropertyTypeChange(prop);
      // addSchemaProperty already gave this property items:{type:'string'}, so
      // onPropertyTypeChange's `if (!prop.items) prop.items = {}` does not clobber it.
      expect(prop.items).toEqual({ type: "string" });
      expect(prop._itemSchemas).toEqual([]);
    });

    test("array type seeds items:{} from scratch when the property had no items at all", () => {
      const wrapper = mountFE();
      const prop = { type: "array" };
      wrapper.vm.onPropertyTypeChange(prop);
      expect(prop.items).toEqual({});
      expect(prop._itemSchemas).toEqual([]);
    });

    test("$ref type seeds an empty $ref string", () => {
      const wrapper = mountFE();
      wrapper.vm.addSchema();
      wrapper.vm.addSchemaProperty("NewSchema");
      const prop = wrapper.vm.formData.components.schemas.NewSchema.properties.newProperty;
      prop.type = "$ref";
      wrapper.vm.onPropertyTypeChange(prop);
      expect(prop.$ref).toBe("");
    });
  });

  describe("array item schemas via onItemTypesChange", () => {
    test("adding 'object' seeds a single { type: object, $ref: '' } entry", () => {
      const wrapper = mountFE();
      const schema = { _itemSchemas: [] };
      wrapper.vm.onItemTypesChange(schema, ["object"]);
      expect(schema._itemSchemas).toEqual([{ type: "object", $ref: "" }]);
    });

    test("deselecting 'object' removes ALL object entries, even if multiple were added", () => {
      const wrapper = mountFE();
      const schema = {
        _itemSchemas: [
          { type: "object", $ref: "#/components/schemas/A" },
          { type: "object", $ref: "#/components/schemas/B" },
          { type: "string" },
        ],
      };
      wrapper.vm.onItemTypesChange(schema, ["string"]);
      expect(schema._itemSchemas).toEqual([{ type: "string" }]);
    });

    test("re-selecting a scalar type after removal starts with a fresh entry (constraints lost)", () => {
      const wrapper = mountFE();
      const schema = { _itemSchemas: [{ type: "string", format: "email" }] };
      wrapper.vm.onItemTypesChange(schema, []); // deselect everything
      expect(schema._itemSchemas).toEqual([]);
      wrapper.vm.onItemTypesChange(schema, ["string"]); // reselect
      expect(schema._itemSchemas).toEqual([{ type: "string" }]);
    });

    test("preserves scalar constraints when the type list is unchanged", () => {
      const wrapper = mountFE();
      const schema = { _itemSchemas: [{ type: "number", minimum: 5 }] };
      wrapper.vm.onItemTypesChange(schema, ["number"]);
      expect(schema._itemSchemas).toEqual([{ type: "number", minimum: 5 }]);
    });
  });

  describe("$ref resolution via availableSchemas", () => {
    test("availableSchemas mirrors schema names as label/value pairs in insertion order", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.Zeta = { type: "object", properties: {} };
      wrapper.vm.formData.components.schemas.Alpha = { type: "object", properties: {} };
      expect(wrapper.vm.availableSchemas).toEqual([
        { label: "Zeta", value: "#/components/schemas/Zeta" },
        { label: "Alpha", value: "#/components/schemas/Alpha" },
      ]);
    });

    test("a schema property with type '$ref' can be pointed at any available schema", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.User = { type: "object", properties: {} };
      wrapper.vm.addSchema(); // NewSchema
      wrapper.vm.addSchemaProperty("NewSchema");
      const prop = wrapper.vm.formData.components.schemas.NewSchema.properties.newProperty;
      prop.type = "$ref";
      wrapper.vm.onPropertyTypeChange(prop);
      prop.$ref = wrapper.vm.availableSchemas.find((s) => s.label === "User").value;
      expect(prop.$ref).toBe("#/components/schemas/User");
    });
  });

  describe("drag and drop - schema property reordering", () => {
    function withThreeProps(wrapper) {
      wrapper.vm.addSchema(); // NewSchema
      wrapper.vm.addSchemaProperty("NewSchema"); // newProperty
      wrapper.vm.addSchemaProperty("NewSchema"); // newProperty1
      wrapper.vm.addSchemaProperty("NewSchema"); // newProperty2
    }

    test("handleDragStart records dragged property name/index/schema and marks the DOM node", () => {
      const wrapper = mountFE();
      withThreeProps(wrapper);
      const ev = mockDragEvent();
      wrapper.vm.handleDragStart(ev, "NewSchema", "newProperty", 0);
      expect(wrapper.vm.draggedProperty).toBe("newProperty");
      expect(ev.target.classList.add).toHaveBeenCalledWith("dragging");
      expect(ev.dataTransfer.setData).toHaveBeenCalled();
    });

    test("handleDrop reorders properties within the same schema", () => {
      const wrapper = mountFE();
      withThreeProps(wrapper);
      wrapper.vm.handleDragStart(mockDragEvent(), "NewSchema", "newProperty", 0);
      wrapper.vm.handleDrop(mockDragEvent(), "NewSchema", 2);
      expect(
        Object.keys(wrapper.vm.formData.components.schemas.NewSchema.properties)
      ).toEqual(["newProperty1", "newProperty2", "newProperty"]);
    });

    test("handleDrop ignores drops originating from a different schema", () => {
      const wrapper = mountFE();
      withThreeProps(wrapper);
      wrapper.vm.formData.components.schemas.Other = { type: "object", properties: { z: { type: "string" } } };
      wrapper.vm.handleDragStart(mockDragEvent(), "Other", "z", 0);
      wrapper.vm.handleDrop(mockDragEvent(), "NewSchema", 2);
      expect(
        Object.keys(wrapper.vm.formData.components.schemas.NewSchema.properties)
      ).toEqual(["newProperty", "newProperty1", "newProperty2"]);
    });

    test("handleDrop onto the same index is a no-op", () => {
      const wrapper = mountFE();
      withThreeProps(wrapper);
      wrapper.vm.handleDragStart(mockDragEvent(), "NewSchema", "newProperty", 0);
      wrapper.vm.handleDrop(mockDragEvent(), "NewSchema", 0);
      expect(
        Object.keys(wrapper.vm.formData.components.schemas.NewSchema.properties)
      ).toEqual(["newProperty", "newProperty1", "newProperty2"]);
    });

    test("handleDragOver calls preventDefault and sets dropEffect", () => {
      const wrapper = mountFE();
      const ev = mockDragEvent();
      wrapper.vm.handleDragOver(ev);
      expect(ev.preventDefault).toHaveBeenCalled();
      expect(ev.dataTransfer.dropEffect).toBe("move");
    });

    test("handleDragEnd clears property drag state and removes CSS classes", () => {
      const wrapper = mountFE();
      withThreeProps(wrapper);
      const startEvent = mockDragEvent();
      wrapper.vm.handleDragStart(startEvent, "NewSchema", "newProperty", 0);
      const endEvent = mockDragEvent();
      wrapper.vm.handleDragEnd(endEvent);
      expect(wrapper.vm.draggedProperty).toBeNull();
      expect(endEvent.target.classList.remove).toHaveBeenCalledWith("dragging");
    });
  });

  describe("array schema $ref vs inline item type (via top-level schema.items)", () => {
    test("an array schema can point its items directly at a $ref", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.User = { type: "object", properties: {} };
      wrapper.vm.formData.components.schemas.UserList = { type: "array", items: { type: "string" } };
      const listSchema = wrapper.vm.formData.components.schemas.UserList;
      listSchema.items = { type: "$ref", $ref: "#/components/schemas/User" };
      expect(listSchema.items.$ref).toBe("#/components/schemas/User");
    });

    test("onSchemaTypeChange does not overwrite an existing $ref-typed items object", () => {
      const wrapper = mountFE();
      const schema = {
        name: "UserList",
        data: { type: "array", items: { type: "$ref", $ref: "#/components/schemas/User" } },
      };
      wrapper.vm.onSchemaTypeChange(schema);
      expect(schema.data.items).toEqual({ type: "$ref", $ref: "#/components/schemas/User" });
    });
  });

  describe("modelValue normalization for components.schemas", () => {
    test("normalizes array schema items.$ref into type:'$ref' form on load", () => {
      const wrapper = mountFE(
        baseModelValue({
          components: {
            schemas: {
              User: { type: "object", properties: {} },
              UserList: { type: "array", items: { $ref: "#/components/schemas/User" } },
            },
          },
        })
      );
      expect(wrapper.vm.formData.components.schemas.UserList.items).toEqual({
        type: "$ref",
        $ref: "#/components/schemas/User",
      });
    });

    test("normalizes a $ref property (adds type: '$ref') on load", () => {
      const wrapper = mountFE(
        baseModelValue({
          components: {
            schemas: {
              User: { type: "object", properties: {} },
              Wrapper: {
                type: "object",
                properties: { user: { $ref: "#/components/schemas/User" } },
              },
            },
          },
        })
      );
      expect(wrapper.vm.formData.components.schemas.Wrapper.properties.user.type).toBe("$ref");
    });
  });

  describe("update:modelValue emit for schema mutations", () => {
    test("emits cleaned output with $ref-typed properties collapsed back to a bare { $ref } object", async () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.User = { type: "object", properties: {} };
      wrapper.vm.addSchema(); // NewSchema
      wrapper.vm.addSchemaProperty("NewSchema");
      const prop = wrapper.vm.formData.components.schemas.NewSchema.properties.newProperty;
      prop.type = "$ref";
      wrapper.vm.onPropertyTypeChange(prop);
      prop.$ref = "#/components/schemas/User";
      await nextTick();

      const emitted = wrapper.emitted("update:modelValue");
      const last = emitted[emitted.length - 1][0];
      expect(last.components.schemas.NewSchema.properties.newProperty).toEqual({
        $ref: "#/components/schemas/User",
      });
    });

    test("emits schema rename reflected in output paths order", async () => {
      const wrapper = mountFE();
      wrapper.vm.formData.components.schemas.A = { type: "object", properties: {} };
      wrapper.vm.formData.components.schemas.B = { type: "object", properties: {} };
      wrapper.vm.renameSchema("A", "Renamed");
      await nextTick();

      const emitted = wrapper.emitted("update:modelValue");
      const last = emitted[emitted.length - 1][0];
      expect(Object.keys(last.components.schemas)).toEqual(["Renamed", "B"]);
    });
  });
});
