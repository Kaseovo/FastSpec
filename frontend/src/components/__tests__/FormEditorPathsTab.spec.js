// Characterization tests for FormEditor.vue's "Paths" tab behavior.
//
// FormEditor is a large Options-API `setup()` component that exposes ALL of
// its internal refs/computed/functions via its `return { ... }` block. We
// exploit that here: instead of clicking through PrimeVue's Accordion/Dialog
// DOM, we mount the real component and drive it via `wrapper.vm.<fn>()`,
// asserting on `wrapper.vm.formData` mutations directly. This is exactly
// what a future structural refactor (splitting Paths/Components into their
// own SFCs) must continue to satisfy byte-for-byte.
//
// `useConfirm()` is mocked so that `confirm.require({ accept })` always
// fires `accept` synchronously - this lets us exercise the real mutation
// logic inside "remove" handlers without dealing with real dialog DOM.

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import FormEditor from "../FormEditor.vue";

// jsdom doesn't implement these; PrimeVue's Tabs/Select components touch them on mount.
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

describe("FormEditor - Paths tab", () => {
  describe("empty state", () => {
    test("shows empty state message when there are no paths", () => {
      const wrapper = mountFE();
      expect(wrapper.text()).toContain("No paths defined. Add one to get started.");
    });

    test("pathsList is empty for a fresh formData", () => {
      const wrapper = mountFE();
      expect(wrapper.vm.pathsList).toEqual([]);
    });
  });

  describe("addPath", () => {
    test("adds a path/method with defaults and selects it", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      expect(wrapper.vm.formData.paths["/users"]).toBeTruthy();
      const op = wrapper.vm.formData.paths["/users"].get;
      expect(op).toMatchObject({
        summary: "",
        description: "",
        operationId: "",
        tags: [],
        deprecated: false,
        parameters: [],
      });
      expect(op.responses).toEqual({ 200: { description: "Successful response" } });
      expect(wrapper.vm.selectedPath).toBe("/users");
      expect(wrapper.vm.selectedMethod).toBe("get");
      // Dialog state reset
      expect(wrapper.vm.newPath).toBe("");
      expect(wrapper.vm.newMethod).toBe("");
      expect(wrapper.vm.showAddPathDialog).toBe(false);
    });

    test("does nothing when no method is selected", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "";
      wrapper.vm.addPath();
      expect(wrapper.vm.formData.paths).toEqual({});
    });

    test("prepends a leading slash when missing", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "no-leading-slash";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      expect(wrapper.vm.formData.paths["/no-leading-slash"]).toBeTruthy();
    });

    test("does not double a leading slash when already present", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "/already-slashed";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      expect(wrapper.vm.formData.paths["/already-slashed"]).toBeTruthy();
    });

    test("empty newPath falls back to root '/'", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      expect(wrapper.vm.formData.paths["/"]).toBeTruthy();
    });

    test("adding an already-used path/method combination silently overwrites the method", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.formData.paths["/users"].get.summary = "customized";

      // Re-run "addPath" for the same path/method (current UI behavior: no duplicate guard)
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      // Overwritten back to defaults - current (possibly surprising) behavior.
      expect(wrapper.vm.formData.paths["/users"].get.summary).toBe("");
    });

    test("path template params generate path parameter entries", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users/{id}/posts/{postId}";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      const params = wrapper.vm.formData.paths["/users/{id}/posts/{postId}"].get.parameters;
      expect(params.map((p) => p.name)).toEqual(["id", "postId"]);
      expect(params[0]).toMatchObject({
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    });
  });

  describe("removePath", () => {
    test("deletes the path via confirm.accept", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.removePath("/users");
      expect(wrapper.vm.formData.paths["/users"]).toBeUndefined();
    });

    test("clears selection when the removed path was selected", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      expect(wrapper.vm.selectedPath).toBe("/users");

      wrapper.vm.removePath("/users");
      expect(wrapper.vm.selectedPath).toBe("");
      expect(wrapper.vm.selectedMethod).toBe("");
    });

    test("leaves selection untouched when a different path was selected", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.newPath = "posts";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      expect(wrapper.vm.selectedPath).toBe("/posts");

      wrapper.vm.removePath("/users");
      expect(wrapper.vm.selectedPath).toBe("/posts");
    });
  });

  describe("removeMethod", () => {
    test("removes a single method, keeping the path when other methods remain", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.addMethodToPath.call(null); // no-op guard check below
      wrapper.vm.currentPathForMethod = "/users";
      wrapper.vm.methodToAdd = "post";
      wrapper.vm.addMethodToPath();

      wrapper.vm.removeMethod("/users", "post");
      expect(Object.keys(wrapper.vm.formData.paths["/users"])).toEqual(["get"]);
    });

    test("removes the entire path when the last method is removed", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.removeMethod("/users", "get");
      expect(wrapper.vm.formData.paths["/users"]).toBeUndefined();
      expect(wrapper.vm.selectedPath).toBe("");
    });

    test("clears selectedMethod when the removed method was selected but other methods remain", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.currentPathForMethod = "/users";
      wrapper.vm.methodToAdd = "post";
      wrapper.vm.addMethodToPath();
      // now selectedMethod is post
      wrapper.vm.removeMethod("/users", "post");
      expect(wrapper.vm.selectedMethod).toBe("");
      expect(wrapper.vm.selectedPath).toBe("/users"); // path survives (get remains)
    });

    test("no-ops if the path does not exist", () => {
      const wrapper = mountFE();
      expect(() => wrapper.vm.removeMethod("/missing", "get")).not.toThrow();
    });
  });

  describe("addMethodToPath / showAddMethodDialog", () => {
    test("showAddMethodDialog sets up dialog state", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.showAddMethodDialog("/users");
      expect(wrapper.vm.currentPathForMethod).toBe("/users");
      expect(wrapper.vm.methodToAdd).toBe("");
      expect(wrapper.vm.showAddMethodDialogVisible).toBe(true);
    });

    test("adds the method with path params synced from the path template", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users/{id}";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.currentPathForMethod = "/users/{id}";
      wrapper.vm.methodToAdd = "delete";
      wrapper.vm.addMethodToPath();

      const del = wrapper.vm.formData.paths["/users/{id}"].delete;
      expect(del).toBeTruthy();
      expect(del.parameters.map((p) => p.name)).toEqual(["id"]);
      expect(wrapper.vm.selectedPath).toBe("/users/{id}");
      expect(wrapper.vm.selectedMethod).toBe("delete");
      expect(wrapper.vm.showAddMethodDialogVisible).toBe(false);
    });

    test("does nothing when methodToAdd or currentPathForMethod is empty", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.currentPathForMethod = "/users";
      wrapper.vm.methodToAdd = "";
      wrapper.vm.addMethodToPath();
      expect(Object.keys(wrapper.vm.formData.paths["/users"])).toEqual(["get"]);
    });

    test("availableMethodsForPath excludes already-defined methods", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.currentPathForMethod = "/users";
      expect(wrapper.vm.availableMethodsForPath).not.toContain("get");
      expect(wrapper.vm.availableMethodsForPath).toContain("post");
    });

    test("availableMethodsForPath returns all methods when no path is targeted", () => {
      const wrapper = mountFE();
      wrapper.vm.currentPathForMethod = "";
      expect(wrapper.vm.availableMethodsForPath).toEqual(wrapper.vm.httpMethods);
    });
  });

  describe("editPath / confirmEditPath", () => {
    function addUsersIdPath(wrapper) {
      wrapper.vm.newPath = "users/{id}";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
    }

    test("editPath seeds dialog state, stripping the leading slash", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.editPath("/users/{id}");
      expect(wrapper.vm.editingPath).toBe("/users/{id}");
      expect(wrapper.vm.editPathValue).toBe("users/{id}");
      expect(wrapper.vm.editPathError).toBe("");
      expect(wrapper.vm.showEditPathDialog).toBe(true);
    });

    test("renames the path while preserving method data, when there is no param diff", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.formData.paths["/users/{id}"].get.summary = "Get user";

      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "accounts/{id}";
      wrapper.vm.confirmEditPath();

      expect(wrapper.vm.formData.paths["/users/{id}"]).toBeUndefined();
      expect(wrapper.vm.formData.paths["/accounts/{id}"].get.summary).toBe("Get user");
      expect(wrapper.vm.showEditPathDialog).toBe(false);
    });

    test("updates selectedPath when the renamed path was selected", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "accounts/{id}";
      wrapper.vm.confirmEditPath();
      expect(wrapper.vm.selectedPath).toBe("/accounts/{id}");
    });

    test("sets an error and refuses to rename onto an existing path", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.newPath = "accounts/{id}";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "accounts/{id}";
      wrapper.vm.confirmEditPath();

      expect(wrapper.vm.editPathError).toBe("Path already exists");
      expect(wrapper.vm.formData.paths["/users/{id}"]).toBeTruthy();
    });

    test("renaming to the exact same path is not treated as a conflict", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "users/{id}";
      wrapper.vm.confirmEditPath();
      expect(wrapper.vm.editPathError).toBe("");
      expect(wrapper.vm.formData.paths["/users/{id}"]).toBeTruthy();
    });

    test("adding a new path param token adds a corresponding parameter entry", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();

      wrapper.vm.editPath("/users");
      wrapper.vm.editPathValue = "users/{id}";
      wrapper.vm.confirmEditPath();

      const params = wrapper.vm.formData.paths["/users/{id}"].get.parameters;
      expect(params.find((p) => p.name === "id" && p.in === "path")).toBeTruthy();
    });

    test("removing an empty (content-less) path param is dropped without a confirm prompt", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);

      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "users";
      wrapper.vm.confirmEditPath();

      const params = wrapper.vm.formData.paths["/users"].get.parameters;
      expect(params.find((p) => p.name === "id")).toBeUndefined();
    });

    test("removing a content-filled path param goes through confirm.require (auto-accepted) and still renames", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      // Fill in content on the path param so it's considered "filled"
      const idParam = wrapper.vm.formData.paths["/users/{id}"].get.parameters.find(
        (p) => p.name === "id"
      );
      idParam.description = "The user id";

      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "users";
      wrapper.vm.confirmEditPath();

      // Our confirm mock auto-accepts, so the rename should have gone through.
      expect(wrapper.vm.formData.paths["/users/{id}"]).toBeUndefined();
      expect(wrapper.vm.formData.paths["/users"]).toBeTruthy();
      const params = wrapper.vm.formData.paths["/users"].get.parameters;
      expect(params.find((p) => p.name === "id")).toBeUndefined();
    });

    test("path param order is preserved across multiple methods when renaming", () => {
      const wrapper = mountFE();
      addUsersIdPath(wrapper);
      wrapper.vm.currentPathForMethod = "/users/{id}";
      wrapper.vm.methodToAdd = "delete";
      wrapper.vm.addMethodToPath();

      wrapper.vm.editPath("/users/{id}");
      wrapper.vm.editPathValue = "accounts/{id}";
      wrapper.vm.confirmEditPath();

      const renamed = wrapper.vm.formData.paths["/accounts/{id}"];
      expect(Object.keys(renamed)).toEqual(["get", "delete"]);
    });
  });

  describe("selection helpers", () => {
    test("selectPathMethod sets selectedPath/selectedMethod directly", () => {
      const wrapper = mountFE();
      wrapper.vm.selectPathMethod("/foo", "get");
      expect(wrapper.vm.selectedPath).toBe("/foo");
      expect(wrapper.vm.selectedMethod).toBe("get");
    });

    test("selectFirstMethod selects the first method and opens the accordion panel", async () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.currentPathForMethod = "/users";
      wrapper.vm.methodToAdd = "post";
      wrapper.vm.addMethodToPath();
      wrapper.vm.selectedMethod = "";

      wrapper.vm.selectFirstMethod({ path: "/users", methods: ["get", "post"] });
      expect(wrapper.vm.selectedPath).toBe("/users");
      expect(wrapper.vm.selectedMethod).toBe("get");
      await nextTick();
      expect(wrapper.vm.openPaths).toContain("0");
    });

    test("selectFirstMethod is a no-op if a method chip was already directly selected for that path", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.currentPathForMethod = "/users";
      wrapper.vm.methodToAdd = "post";
      wrapper.vm.addMethodToPath();
      wrapper.vm.selectedMethod = "post";

      wrapper.vm.selectFirstMethod({ path: "/users", methods: ["get", "post"] });
      expect(wrapper.vm.selectedMethod).toBe("post");
    });

    test("selectAndOpenPath opens the accordion panel synchronously", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.openPaths = [];

      wrapper.vm.selectAndOpenPath("/users", "get");
      expect(wrapper.vm.openPaths).toContain("0");
      expect(wrapper.vm.selectedPath).toBe("/users");
      expect(wrapper.vm.selectedMethod).toBe("get");
    });
  });

  describe("addChipOnEnter", () => {
    test("adds a trimmed, non-empty value and clears the input", () => {
      const wrapper = mountFE();
      const obj = { tags: [] };
      const input = { value: "  new-tag  " };
      wrapper.vm.addChipOnEnter({ target: input }, obj, "tags");
      expect(obj.tags).toEqual(["new-tag"]);
      expect(input.value).toBe("");
    });

    test("does not add duplicate values", () => {
      const wrapper = mountFE();
      const obj = { tags: ["existing"] };
      const input = { value: "existing" };
      wrapper.vm.addChipOnEnter({ target: input }, obj, "tags");
      expect(obj.tags).toEqual(["existing"]);
    });

    test("does nothing for a blank/whitespace-only value", () => {
      const wrapper = mountFE();
      const obj = { tags: [] };
      const input = { value: "   " };
      wrapper.vm.addChipOnEnter({ target: input }, obj, "tags");
      expect(obj.tags).toEqual([]);
    });

    test("initializes the array if the key was not previously an array", () => {
      const wrapper = mountFE();
      const obj = {};
      const input = { value: "first" };
      wrapper.vm.addChipOnEnter({ target: input }, obj, "enum");
      expect(obj.enum).toEqual(["first"]);
    });
  });

  describe("parameters", () => {
    function withPath(wrapper) {
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
    }

    test("addParameter pushes a default query parameter", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addParameter("/users", "get");
      const params = wrapper.vm.formData.paths["/users"].get.parameters;
      expect(params).toHaveLength(1);
      expect(params[0]).toMatchObject({
        name: "",
        in: "query",
        required: false,
        schema: { type: "string" },
      });
    });

    test("addParameter initializes the parameters array if missing", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      delete wrapper.vm.formData.paths["/users"].get.parameters;
      wrapper.vm.addParameter("/users", "get");
      expect(wrapper.vm.formData.paths["/users"].get.parameters).toHaveLength(1);
    });

    test("removeParameter removes by index via confirm.accept", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addParameter("/users", "get");
      wrapper.vm.addParameter("/users", "get");
      wrapper.vm.formData.paths["/users"].get.parameters[0].name = "keep-me";
      wrapper.vm.removeParameter("/users", "get", 1);
      const params = wrapper.vm.formData.paths["/users"].get.parameters;
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe("keep-me");
    });
  });

  describe("request body - reference schema", () => {
    function withPathAndSchema(wrapper) {
      wrapper.vm.formData.components.schemas.User = { type: "object", properties: {} };
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "post";
      wrapper.vm.addPath();
    }

    test("selecting a reference schema sets the requestBody content schema to a $ref", async () => {
      const wrapper = mountFE();
      withPathAndSchema(wrapper);
      wrapper.vm.requestBodyContentType = "application/json";
      wrapper.vm.requestBodySchemaType = "reference";
      wrapper.vm.requestBodySchemaRef = "#/components/schemas/User";
      await nextTick();

      const content = wrapper.vm.formData.paths["/users"].post.requestBody.content;
      expect(content["application/json"].schema).toEqual({
        $ref: "#/components/schemas/User",
      });
    });

    test("availableSchemas lists label/value pairs derived from components.schemas", () => {
      const wrapper = mountFE();
      withPathAndSchema(wrapper);
      expect(wrapper.vm.availableSchemas).toEqual([
        { label: "User", value: "#/components/schemas/User" },
      ]);
    });
  });

  describe("request body - inline schema", () => {
    function withPath(wrapper) {
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "post";
      wrapper.vm.addPath();
      wrapper.vm.requestBodyContentType = "application/json";
      wrapper.vm.requestBodySchemaType = "inline";
    }

    test("currentRequestBodySchema is null unless a path/method is selected, inline mode, and a content type is set", () => {
      const wrapper = mountFE();
      expect(wrapper.vm.currentRequestBodySchema).toBeNull();
      withPath(wrapper);
      expect(wrapper.vm.currentRequestBodySchema).toBeTruthy();
    });

    test("currentRequestBodySchema lazily initializes requestBody.content for the current content type", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      const schema = wrapper.vm.currentRequestBodySchema;
      expect(schema).toEqual({ type: "object" });
      expect(
        wrapper.vm.formData.paths["/users"].post.requestBody.content["application/json"].schema
      ).toBe(schema);
    });

    test("onRequestBodyTypeChange('object') resets to an empty object schema with properties", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.requestBodyInlineSchemaType = "object";
      wrapper.vm.onRequestBodyTypeChange();
      const schema =
        wrapper.vm.formData.paths["/users"].post.requestBody.content["application/json"].schema;
      expect(schema).toEqual({ type: "object", properties: {} });
    });

    test("onRequestBodyTypeChange('array') resets to an array schema with _itemSchemas", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.requestBodyInlineSchemaType = "array";
      wrapper.vm.onRequestBodyTypeChange();
      const schema =
        wrapper.vm.formData.paths["/users"].post.requestBody.content["application/json"].schema;
      expect(schema).toEqual({ type: "array", _itemSchemas: [] });
    });

    test("addRequestBodyProperty adds newProperty with an incrementing suffix on collision", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty();
      wrapper.vm.addRequestBodyProperty();
      const props = wrapper.vm.currentRequestBodySchema.properties;
      expect(Object.keys(props)).toEqual(["newProperty", "newProperty1"]);
      expect(props.newProperty).toEqual({ type: "string", description: "" });
    });

    test("removeRequestBodyProperty deletes the property and prunes it from required[]", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty();
      wrapper.vm.toggleRequestBodyPropertyRequired("newProperty", true);
      wrapper.vm.removeRequestBodyProperty("newProperty");
      expect(wrapper.vm.currentRequestBodySchema.properties.newProperty).toBeUndefined();
      expect(wrapper.vm.currentRequestBodySchema.required).toEqual([]);
    });

    test("renameRequestBodyProperty renames while preserving position in required[]", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty();
      wrapper.vm.toggleRequestBodyPropertyRequired("newProperty", true);
      wrapper.vm.renameRequestBodyProperty("newProperty", "email");
      expect(wrapper.vm.currentRequestBodySchema.properties.email).toBeTruthy();
      expect(wrapper.vm.currentRequestBodySchema.properties.newProperty).toBeUndefined();
      expect(wrapper.vm.currentRequestBodySchema.required).toEqual(["email"]);
    });

    test("renameRequestBodyProperty refuses to rename onto an existing property name", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty(); // newProperty
      wrapper.vm.addRequestBodyProperty(); // newProperty1
      wrapper.vm.renameRequestBodyProperty("newProperty", "newProperty1");
      expect(Object.keys(wrapper.vm.currentRequestBodySchema.properties)).toEqual([
        "newProperty",
        "newProperty1",
      ]);
    });

    test("renameRequestBodyProperty is a no-op for an empty new name", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty();
      wrapper.vm.renameRequestBodyProperty("newProperty", "");
      expect(wrapper.vm.currentRequestBodySchema.properties.newProperty).toBeTruthy();
    });

    test("toggleRequestBodyPropertyRequired adds and removes from required[] idempotently", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.addRequestBodyProperty();
      wrapper.vm.toggleRequestBodyPropertyRequired("newProperty", true);
      wrapper.vm.toggleRequestBodyPropertyRequired("newProperty", true); // idempotent
      expect(wrapper.vm.currentRequestBodySchema.required).toEqual(["newProperty"]);
      wrapper.vm.toggleRequestBodyPropertyRequired("newProperty", false);
      expect(wrapper.vm.currentRequestBodySchema.required).toEqual([]);
    });

    test("nested array item schemas (_itemSchemas) via onItemTypesChange on the request body schema", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.requestBodyInlineSchemaType = "array";
      wrapper.vm.onRequestBodyTypeChange();
      const schema = wrapper.vm.currentRequestBodySchema;

      wrapper.vm.onItemTypesChange(schema, ["string", "object"]);
      expect(schema._itemSchemas).toEqual([
        { type: "string" },
        { type: "object", $ref: "" },
      ]);

      // Deselecting object removes all object entries; scalar entries retain prior constraints.
      schema._itemSchemas[0].format = "email";
      wrapper.vm.onItemTypesChange(schema, ["string"]);
      expect(schema._itemSchemas).toEqual([{ type: "string", format: "email" }]);
    });
  });

  describe("onPropertyTypeChange / onItemTypesChange (shared helpers used by request body + params)", () => {
    test("onPropertyTypeChange('array') seeds items and _itemSchemas when missing", () => {
      const wrapper = mountFE();
      const prop = { type: "array" };
      wrapper.vm.onPropertyTypeChange(prop);
      expect(prop.items).toEqual({});
      expect(prop._itemSchemas).toEqual([]);
    });

    test("onPropertyTypeChange('$ref') seeds an empty $ref", () => {
      const wrapper = mountFE();
      const prop = { type: "$ref" };
      wrapper.vm.onPropertyTypeChange(prop);
      expect(prop.$ref).toBe("");
    });

    test("onPropertyTypeChange leaves existing items/$ref untouched", () => {
      const wrapper = mountFE();
      const prop = { type: "array", items: { type: "number" }, _itemSchemas: [{ type: "number" }] };
      wrapper.vm.onPropertyTypeChange(prop);
      expect(prop.items).toEqual({ type: "number" });
      expect(prop._itemSchemas).toEqual([{ type: "number" }]);
    });

    test("onItemTypesChange keeps multiple existing object entries when object stays selected", () => {
      const wrapper = mountFE();
      const schema = {
        _itemSchemas: [
          { type: "object", $ref: "#/components/schemas/A" },
          { type: "object", $ref: "#/components/schemas/B" },
        ],
      };
      wrapper.vm.onItemTypesChange(schema, ["object"]);
      expect(schema._itemSchemas).toHaveLength(2);
    });
  });

  describe("responses - dialog flow", () => {
    function withPath(wrapper) {
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
    }

    test("openAddResponseDialog resets to step 1 / add mode", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.editingResponseCode = "999"; // leftover from a previous edit
      wrapper.vm.openAddResponseDialog();
      expect(wrapper.vm.editingResponseCode).toBe("");
      expect(wrapper.vm.newResponseCode).toBe("");
      expect(wrapper.vm.responseDialogStep).toBe(1);
      expect(wrapper.vm.responseDialogCategory).toBe("");
      expect(wrapper.vm.showAddResponseDialog).toBe(true);
    });

    test("confirmResponseDialog adds a new response with a status-name-derived description", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.openAddResponseDialog();
      wrapper.vm.newResponseCode = "404";
      wrapper.vm.confirmResponseDialog();

      const responses = wrapper.vm.formData.paths["/users"].get.responses;
      expect(responses["404"]).toEqual({ description: "Not Found", content: {} });
      expect(wrapper.vm.showAddResponseDialog).toBe(false);
    });

    test("confirmResponseDialog does not overwrite an existing response for the same code", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.formData.paths["/users"].get.responses["404"] = {
        description: "Custom",
        content: { "application/json": { schema: { type: "object" } } },
      };
      wrapper.vm.openAddResponseDialog();
      wrapper.vm.newResponseCode = "404";
      wrapper.vm.confirmResponseDialog();

      expect(wrapper.vm.formData.paths["/users"].get.responses["404"].description).toBe("Custom");
    });

    test("confirmResponseDialog does nothing without a code selected", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      const before = JSON.stringify(wrapper.vm.formData.paths["/users"].get.responses);
      wrapper.vm.openAddResponseDialog();
      wrapper.vm.newResponseCode = "";
      wrapper.vm.confirmResponseDialog();
      expect(JSON.stringify(wrapper.vm.formData.paths["/users"].get.responses)).toBe(before);
    });

    test("openEditResponseCodeDialog pre-selects the matching status category", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.openEditResponseCodeDialog("200");
      expect(wrapper.vm.responseDialogCategory).toBe("2xx");
      expect(wrapper.vm.responseDialogStep).toBe(2);
      expect(wrapper.vm.editingResponseCode).toBe("200");

      wrapper.vm.openEditResponseCodeDialog("301");
      expect(wrapper.vm.responseDialogCategory).toBe("3xx");
      wrapper.vm.openEditResponseCodeDialog("404");
      expect(wrapper.vm.responseDialogCategory).toBe("4xx");
      wrapper.vm.openEditResponseCodeDialog("500");
      expect(wrapper.vm.responseDialogCategory).toBe("5xx");
      wrapper.vm.openEditResponseCodeDialog("999");
      expect(wrapper.vm.responseDialogCategory).toBe("custom");
    });

    test("confirmResponseDialog in edit mode renames the response code, preserving its content", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.formData.paths["/users"].get.responses["200"] = {
        description: "OK",
        content: { "application/json": { schema: { type: "object" } } },
      };
      wrapper.vm.openEditResponseCodeDialog("200");
      wrapper.vm.newResponseCode = "201";
      wrapper.vm.confirmResponseDialog();

      const responses = wrapper.vm.formData.paths["/users"].get.responses;
      expect(responses["200"]).toBeUndefined();
      expect(responses["201"].description).toBe("OK");
    });

    test("confirmResponseDialog in edit mode with an unchanged code is a no-op", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.formData.paths["/users"].get.responses["200"].description = "Custom OK";
      wrapper.vm.openEditResponseCodeDialog("200");
      wrapper.vm.newResponseCode = "200";
      wrapper.vm.confirmResponseDialog();
      expect(wrapper.vm.formData.paths["/users"].get.responses["200"].description).toBe(
        "Custom OK"
      );
    });

    test("resetResponseDialog clears all dialog state", () => {
      const wrapper = mountFE();
      wrapper.vm.responseDialogStep = 2;
      wrapper.vm.responseDialogCategory = "4xx";
      wrapper.vm.editingResponseCode = "404";
      wrapper.vm.newResponseCode = "404";
      wrapper.vm.resetResponseDialog();
      expect(wrapper.vm.responseDialogStep).toBe(1);
      expect(wrapper.vm.responseDialogCategory).toBe("");
      expect(wrapper.vm.editingResponseCode).toBe("");
      expect(wrapper.vm.newResponseCode).toBe("");
    });

    test("isResponseCodeUsed excludes the code currently being edited", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.formData.paths["/users"].get.responses["404"] = { description: "" };
      wrapper.vm.editingResponseCode = "404";
      expect(wrapper.vm.isResponseCodeUsed("404")).toBe(false);
      expect(wrapper.vm.isResponseCodeUsed("200")).toBe(true);
    });

    test("isResponseCodeUsed reports used codes in add mode", () => {
      const wrapper = mountFE();
      withPath(wrapper);
      wrapper.vm.editingResponseCode = "";
      expect(wrapper.vm.isResponseCodeUsed("200")).toBe(true);
      expect(wrapper.vm.isResponseCodeUsed("404")).toBe(false);
    });
  });

  describe("responses - removal and content/schema management", () => {
    function withResponse(wrapper) {
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      return wrapper.vm.formData.paths["/users"].get.responses["200"];
    }

    test("removeResponse deletes the given status code via confirm.accept", () => {
      const wrapper = mountFE();
      withResponse(wrapper);
      wrapper.vm.removeResponse("/users", "get", "200");
      expect(wrapper.vm.formData.paths["/users"].get.responses["200"]).toBeUndefined();
    });

    test("getResponseContentType / setResponseContentType round-trip", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      expect(wrapper.vm.getResponseContentType(response)).toBe("");
      wrapper.vm.setResponseContentType(response, "application/json");
      expect(wrapper.vm.getResponseContentType(response)).toBe("application/json");
      expect(response.content["application/json"]).toEqual({ schema: { type: "object" } });
    });

    test("setResponseContentType('') clears content", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      wrapper.vm.setResponseContentType(response, "");
      expect(response.content).toEqual({});
    });

    test("setResponseContentType preserves the existing schema when switching content type", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      response.content = { "application/json": { schema: { type: "string" } } };
      wrapper.vm.setResponseContentType(response, "application/xml");
      expect(response.content).toEqual({ "application/xml": { schema: { type: "string" } } });
    });

    test("getResponseSchemaType detects reference vs inline via presence of $ref key", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      expect(wrapper.vm.getResponseSchemaType(response)).toBe("inline");

      response.content["application/json"].schema = { $ref: "" };
      expect(wrapper.vm.getResponseSchemaType(response)).toBe("reference");

      response.content["application/json"].schema = { $ref: "#/components/schemas/User" };
      expect(wrapper.vm.getResponseSchemaType(response)).toBe("reference");
    });

    test("getResponseSchemaType defaults to 'inline' with no content type set", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      expect(wrapper.vm.getResponseSchemaType(response)).toBe("inline");
    });

    test("setResponseSchemaType('reference') / ('inline') swap the schema shape", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");

      wrapper.vm.setResponseSchemaType(response, "reference");
      expect(response.content["application/json"].schema).toEqual({ $ref: "" });

      wrapper.vm.setResponseSchemaType(response, "inline");
      expect(response.content["application/json"].schema).toEqual({
        type: "object",
        properties: {},
      });
    });

    test("getResponseSchemaRef / setResponseSchemaRef round-trip", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      wrapper.vm.setResponseSchemaRef(response, "#/components/schemas/User");
      expect(wrapper.vm.getResponseSchemaRef(response)).toBe("#/components/schemas/User");
    });

    test("getResponseInlineSchema returns {} for a reference schema", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      wrapper.vm.setResponseSchemaType(response, "reference");
      expect(wrapper.vm.getResponseInlineSchema(response)).toEqual({});
    });

    test("getResponseInlineSchema returns the live (mutable) schema object for inline schemas", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      const schema = wrapper.vm.getResponseInlineSchema(response);
      schema.description = "mutated";
      expect(response.content["application/json"].schema.description).toBe("mutated");
    });

    test("getResponseInlineSchemaType defaults to 'object' and unwraps 3.1 nullable unions", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      expect(wrapper.vm.getResponseInlineSchemaType(response)).toBe("object");

      response.content["application/json"].schema = { type: ["string", "null"] };
      expect(wrapper.vm.getResponseInlineSchemaType(response)).toBe("string");
    });

    test("setResponseInlineSchemaType('array') seeds _itemSchemas, ('object') seeds properties", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");

      wrapper.vm.setResponseInlineSchemaType(response, "array");
      expect(response.content["application/json"].schema).toEqual({
        type: "array",
        _itemSchemas: [],
      });

      wrapper.vm.setResponseInlineSchemaType(response, "object");
      expect(response.content["application/json"].schema).toEqual({
        type: "object",
        properties: {},
      });
    });

    test("addResponseProperty / removeResponseProperty / renameResponseProperty / toggleResponsePropertyRequired", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");

      wrapper.vm.addResponseProperty(response);
      wrapper.vm.addResponseProperty(response);
      const schema = wrapper.vm.getResponseInlineSchema(response);
      expect(Object.keys(schema.properties)).toEqual(["newProperty", "newProperty1"]);

      wrapper.vm.toggleResponsePropertyRequired(response, "newProperty", true);
      expect(schema.required).toEqual(["newProperty"]);

      wrapper.vm.renameResponseProperty(response, "newProperty", "id");
      expect(schema.properties.id).toBeTruthy();
      expect(schema.properties.newProperty).toBeUndefined();
      expect(schema.required).toEqual(["id"]);

      wrapper.vm.removeResponseProperty(response, "id");
      expect(schema.properties.id).toBeUndefined();
      expect(schema.required).toEqual([]);
    });

    test("renameResponseProperty refuses to overwrite an existing property", () => {
      const wrapper = mountFE();
      const response = withResponse(wrapper);
      wrapper.vm.setResponseContentType(response, "application/json");
      wrapper.vm.addResponseProperty(response); // newProperty
      wrapper.vm.addResponseProperty(response); // newProperty1
      wrapper.vm.renameResponseProperty(response, "newProperty", "newProperty1");
      const schema = wrapper.vm.getResponseInlineSchema(response);
      expect(Object.keys(schema.properties)).toEqual(["newProperty", "newProperty1"]);
    });
  });

  describe("drag and drop - paths and methods", () => {
    function withTwoPaths(wrapper) {
      wrapper.vm.newPath = "aaa";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      wrapper.vm.newPath = "bbb";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
    }

    test("handlePathDragStart records the dragged path/index", () => {
      const wrapper = mountFE();
      withTwoPaths(wrapper);
      const ev = mockDragEvent();
      wrapper.vm.handlePathDragStart(ev, "/aaa", 0);
      expect(wrapper.vm.draggedPath).toBe("/aaa");
      expect(ev.target.classList.add).toHaveBeenCalledWith("dragging-path");
    });

    test("handlePathDrop reorders paths object insertion order", () => {
      const wrapper = mountFE();
      withTwoPaths(wrapper);
      wrapper.vm.handlePathDragStart(mockDragEvent(), "/aaa", 0);
      wrapper.vm.handlePathDrop(mockDragEvent(), 1);
      expect(Object.keys(wrapper.vm.formData.paths)).toEqual(["/bbb", "/aaa"]);
    });

    test("handlePathDrop onto the same index is a no-op", () => {
      const wrapper = mountFE();
      withTwoPaths(wrapper);
      wrapper.vm.handlePathDragStart(mockDragEvent(), "/aaa", 0);
      wrapper.vm.handlePathDrop(mockDragEvent(), 0);
      expect(Object.keys(wrapper.vm.formData.paths)).toEqual(["/aaa", "/bbb"]);
    });

    test("handleDragEnd clears all drag state", () => {
      const wrapper = mountFE();
      withTwoPaths(wrapper);
      wrapper.vm.handlePathDragStart(mockDragEvent(), "/aaa", 0);
      wrapper.vm.handleDragEnd(mockDragEvent());
      expect(wrapper.vm.draggedPath).toBeNull();
    });
  });

  describe("keyboard helpers", () => {
    test("handlePathKeydown inserts matching braces at the cursor and prevents default", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users/";
      const input = { value: "users/", selectionStart: 6, selectionEnd: 6, setSelectionRange: vi.fn() };
      const event = { key: "{", preventDefault: vi.fn(), target: input };
      wrapper.vm.handlePathKeydown(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(wrapper.vm.newPath).toBe("users/{}");
    });

    test("handlePathKeydown ignores non-brace keys", () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      const event = { key: "a", preventDefault: vi.fn(), target: { value: "users" } };
      wrapper.vm.handlePathKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(wrapper.vm.newPath).toBe("users");
    });

    test("handleEditPathKeydown inserts braces into editPathValue", () => {
      const wrapper = mountFE();
      wrapper.vm.editPathValue = "users/";
      const input = { value: "users/", selectionStart: 6, selectionEnd: 6, setSelectionRange: vi.fn() };
      const event = { key: "{", preventDefault: vi.fn(), target: input };
      wrapper.vm.handleEditPathKeydown(event);
      expect(wrapper.vm.editPathValue).toBe("users/{}");
    });
  });

  describe("isOpenAPI31", () => {
    test("is false for a 3.0.x spec", () => {
      const wrapper = mountFE(baseModelValue({ openapi: "3.0.0" }));
      expect(wrapper.vm.isOpenAPI31).toBe(false);
    });

    test("is true for a 3.1.x spec", () => {
      const wrapper = mountFE(baseModelValue({ openapi: "3.1.0" }));
      expect(wrapper.vm.isOpenAPI31).toBe(true);
    });
  });

  describe("modelValue prop watcher and update:modelValue emit", () => {
    test("normalizes an inline $ref property (adds type: '$ref') on load", () => {
      const wrapper = mountFE(
        baseModelValue({
          paths: {
            "/users": {
              post: {
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { owner: { $ref: "#/components/schemas/User" } },
                      },
                    },
                  },
                },
              },
            },
          },
          components: { schemas: { User: { type: "object", properties: {} } } },
        })
      );
      const prop =
        wrapper.vm.formData.paths["/users"].post.requestBody.content["application/json"].schema
          .properties.owner;
      expect(prop.type).toBe("$ref");
      expect(prop.$ref).toBe("#/components/schemas/User");
    });

    test("emits update:modelValue with cleanRefsForOutput applied after a mutation", async () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "get";
      wrapper.vm.addPath();
      await nextTick();

      const emitted = wrapper.emitted("update:modelValue");
      expect(emitted).toBeTruthy();
      const last = emitted[emitted.length - 1][0];
      expect(last.paths["/users"].get.responses["200"]).toEqual({
        description: "Successful response",
      });
      // Internal helper keys should never leak into the emitted payload.
      expect(last.paths["/users"].get.parameters).toEqual([]);
    });

    test("emitted payload strips _itemSchemas back to a plain items object for array request bodies", async () => {
      const wrapper = mountFE();
      wrapper.vm.newPath = "users";
      wrapper.vm.newMethod = "post";
      wrapper.vm.addPath();
      wrapper.vm.requestBodyContentType = "application/json";
      wrapper.vm.requestBodySchemaType = "inline";
      await nextTick();
      wrapper.vm.requestBodyInlineSchemaType = "array";
      wrapper.vm.onRequestBodyTypeChange();
      const schema = wrapper.vm.currentRequestBodySchema;
      wrapper.vm.onItemTypesChange(schema, ["string"]);
      await nextTick();

      const emitted = wrapper.emitted("update:modelValue");
      const last = emitted[emitted.length - 1][0];
      const outSchema =
        last.paths["/users"].post.requestBody.content["application/json"].schema;
      expect(outSchema._itemSchemas).toBeUndefined();
      expect(outSchema.items).toEqual({ type: "string" });
    });
  });
});
