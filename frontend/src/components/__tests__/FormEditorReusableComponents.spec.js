// Tests for FormEditor's "Reusable Parameters" and "Reusable Responses"
// sections (components.parameters / components.responses), referenced from
// operations via $ref. Same mount-and-drive-via-wrapper.vm strategy as the
// other FormEditor tab spec files.

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
    components: { schemas: {}, parameters: {}, responses: {} },
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

describe("FormEditor - reusable parameters", () => {
  test("addReusableParameter creates a query-string parameter named 'NewParameter'", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    expect(wrapper.vm.formData.components.parameters.NewParameter).toEqual({
      name: "",
      in: "query",
      description: "",
      required: false,
      schema: { type: "string" },
    });
  });

  test("increments the name on collision", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    wrapper.vm.addReusableParameter();
    expect(Object.keys(wrapper.vm.formData.components.parameters)).toEqual([
      "NewParameter",
      "NewParameter1",
    ]);
  });

  test("renameReusableParameter renames the key, preserving data", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    wrapper.vm.renameReusableParameter("NewParameter", "PageOffset");
    expect(wrapper.vm.formData.components.parameters.NewParameter).toBeUndefined();
    expect(wrapper.vm.formData.components.parameters.PageOffset).toBeTruthy();
  });

  test("renameReusableParameter refuses to collide with an existing name", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    wrapper.vm.addReusableParameter();
    wrapper.vm.renameReusableParameter("NewParameter1", "NewParameter");
    expect(wrapper.vm.formData.components.parameters.NewParameter1).toBeTruthy();
  });

  test("renameReusableParameter updates $ref strings in operations that use it", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/foo": {
            get: {
              responses: { 200: { description: "ok" } },
              parameters: [{ $ref: "#/components/parameters/NewParameter" }],
            },
          },
        },
      })
    );
    wrapper.vm.addReusableParameter();
    wrapper.vm.renameReusableParameter("NewParameter", "PageOffset");
    expect(wrapper.vm.formData.paths["/foo"].get.parameters[0].$ref).toBe(
      "#/components/parameters/PageOffset"
    );
  });

  test("removeReusableParameter deletes the definition via confirm.accept", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    wrapper.vm.removeReusableParameter("NewParameter");
    expect(wrapper.vm.formData.components.parameters.NewParameter).toBeUndefined();
  });

  test("removeReusableParameter drops the dangling $ref from every operation's parameter list", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/foo": {
            get: {
              responses: { 200: { description: "ok" } },
              parameters: [
                { $ref: "#/components/parameters/NewParameter" },
                { name: "keepMe", in: "query", schema: { type: "string" } },
              ],
            },
          },
        },
      })
    );
    wrapper.vm.addReusableParameter();
    wrapper.vm.removeReusableParameter("NewParameter");
    expect(wrapper.vm.formData.paths["/foo"].get.parameters).toEqual([
      { name: "keepMe", in: "query", schema: { type: "string" } },
    ]);
  });

  test("availableParameters lists label/value pairs derived from components.parameters", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableParameter();
    expect(wrapper.vm.availableParameters).toEqual([
      { label: "NewParameter", value: "#/components/parameters/NewParameter" },
    ]);
  });
});

describe("FormEditor - reusable responses", () => {
  test("addReusableResponse creates a blank response named 'NewResponse'", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableResponse();
    expect(wrapper.vm.formData.components.responses.NewResponse).toEqual({
      description: "",
      content: {},
    });
  });

  test("increments the name on collision", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableResponse();
    wrapper.vm.addReusableResponse();
    expect(Object.keys(wrapper.vm.formData.components.responses)).toEqual([
      "NewResponse",
      "NewResponse1",
    ]);
  });

  test("renameReusableResponse updates $ref strings in operations that use it", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/foo": {
            get: {
              responses: {
                404: { $ref: "#/components/responses/NewResponse" },
              },
            },
          },
        },
      })
    );
    wrapper.vm.addReusableResponse();
    wrapper.vm.renameReusableResponse("NewResponse", "NotFoundError");
    expect(wrapper.vm.formData.paths["/foo"].get.responses["404"].$ref).toBe(
      "#/components/responses/NotFoundError"
    );
  });

  test("removeReusableResponse replaces dangling refs with a blank inline response, preserving the status code", () => {
    const wrapper = mountFE(
      baseModelValue({
        paths: {
          "/foo": {
            get: {
              responses: {
                404: { $ref: "#/components/responses/NewResponse" },
              },
            },
          },
        },
      })
    );
    wrapper.vm.addReusableResponse();
    wrapper.vm.removeReusableResponse("NewResponse");
    expect(wrapper.vm.formData.paths["/foo"].get.responses["404"]).toEqual({
      description: "",
      content: {},
    });
  });

  test("shared response-content helpers work on a components.responses entry", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableResponse();
    const response = wrapper.vm.formData.components.responses.NewResponse;

    wrapper.vm.setResponseContentType(response, "application/json");
    expect(wrapper.vm.getResponseContentType(response)).toBe("application/json");

    wrapper.vm.addResponseProperty(response);
    const schema = wrapper.vm.getResponseInlineSchema(response);
    expect(Object.keys(schema.properties)).toEqual(["newProperty"]);

    wrapper.vm.setResponseSchemaType(response, "reference");
    expect(wrapper.vm.getResponseSchemaType(response)).toBe("reference");
  });

  test("availableResponses lists label/value pairs derived from components.responses", () => {
    const wrapper = mountFE();
    wrapper.vm.addReusableResponse();
    expect(wrapper.vm.availableResponses).toEqual([
      { label: "NewResponse", value: "#/components/responses/NewResponse" },
    ]);
  });
});

describe("FormEditor - using reusable parameters/responses from an operation", () => {
  function specWithOperation() {
    return baseModelValue({
      paths: {
        "/foo": {
          get: {
            parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
            responses: { 200: { description: "ok" } },
          },
        },
      },
    });
  }

  test("isParameterRef is false for an inline parameter, true for a $ref", () => {
    const wrapper = mountFE(specWithOperation());
    const params = wrapper.vm.formData.paths["/foo"].get.parameters;
    expect(wrapper.vm.isParameterRef(params[0])).toBe(false);
    expect(wrapper.vm.isParameterRef({ $ref: "#/components/parameters/X" })).toBe(true);
  });

  test("convertParameterToRef replaces the inline entry with a blank $ref", () => {
    const wrapper = mountFE(specWithOperation());
    wrapper.vm.convertParameterToRef("/foo", "get", 0);
    expect(wrapper.vm.formData.paths["/foo"].get.parameters[0]).toEqual({ $ref: "" });
  });

  test("convertParameterToInline replaces a $ref with a blank inline parameter", () => {
    const wrapper = mountFE(specWithOperation());
    wrapper.vm.convertParameterToRef("/foo", "get", 0);
    wrapper.vm.convertParameterToInline("/foo", "get", 0);
    expect(wrapper.vm.formData.paths["/foo"].get.parameters[0]).toEqual({
      name: "",
      in: "query",
      description: "",
      required: false,
      schema: { type: "string" },
    });
  });

  test("isResponseRef is false for an inline response, true for a $ref", () => {
    const wrapper = mountFE(specWithOperation());
    const response = wrapper.vm.formData.paths["/foo"].get.responses["200"];
    expect(wrapper.vm.isResponseRef(response)).toBe(false);
    expect(wrapper.vm.isResponseRef({ $ref: "#/components/responses/X" })).toBe(true);
  });

  test("convertResponseToRef replaces the inline entry with a blank $ref, keeping the status code", () => {
    const wrapper = mountFE(specWithOperation());
    wrapper.vm.convertResponseToRef("/foo", "get", "200");
    expect(wrapper.vm.formData.paths["/foo"].get.responses["200"]).toEqual({ $ref: "" });
  });

  test("convertResponseToInline replaces a $ref with a blank inline response", () => {
    const wrapper = mountFE(specWithOperation());
    wrapper.vm.convertResponseToRef("/foo", "get", "200");
    wrapper.vm.convertResponseToInline("/foo", "get", "200");
    expect(wrapper.vm.formData.paths["/foo"].get.responses["200"]).toEqual({
      description: "",
      content: {},
    });
  });

  test("end-to-end: define a reusable parameter, use it, rename it, and the operation follows", () => {
    const wrapper = mountFE(specWithOperation());
    wrapper.vm.addReusableParameter();
    wrapper.vm.convertParameterToRef("/foo", "get", 0);
    wrapper.vm.formData.paths["/foo"].get.parameters[0].$ref =
      "#/components/parameters/NewParameter";
    wrapper.vm.renameReusableParameter("NewParameter", "SearchTerm");
    expect(wrapper.vm.formData.paths["/foo"].get.parameters[0].$ref).toBe(
      "#/components/parameters/SearchTerm"
    );
  });
});
