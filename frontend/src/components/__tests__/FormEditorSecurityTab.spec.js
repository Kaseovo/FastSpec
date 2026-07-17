// Tests for FormEditor.vue's "Security" tab: components.securitySchemes CRUD,
// the global `security` requirement list, and per-operation overrides.
// Same strategy as FormEditorComponentsTab.spec.js: mount the real FormEditor
// and drive it through `wrapper.vm.<fn>()`, asserting on `wrapper.vm.formData`.

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
    components: { schemas: {}, securitySchemes: {} },
    security: [],
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

describe("FormEditor - Security tab", () => {
  describe("empty state", () => {
    test("shows empty state message when there are no schemes", () => {
      const wrapper = mountFE();
      expect(wrapper.text()).toContain(
        "No security schemes defined. Add one to get started."
      );
    });

    test("securitySchemesList is empty for a fresh formData", () => {
      const wrapper = mountFE();
      expect(wrapper.vm.securitySchemesList).toEqual([]);
    });
  });

  describe("addSecurityScheme", () => {
    test("creates a scheme named 'NewSecurityScheme' defaulting to apiKey/header", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      expect(wrapper.vm.formData.components.securitySchemes.NewSecurityScheme).toEqual({
        type: "apiKey",
        name: "",
        in: "header",
      });
    });

    test("increments the name on collision", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.addSecurityScheme();
      expect(Object.keys(wrapper.vm.formData.components.securitySchemes)).toEqual([
        "NewSecurityScheme",
        "NewSecurityScheme1",
      ]);
    });
  });

  describe("onSecuritySchemeTypeChange", () => {
    test("switching apiKey -> http replaces type-specific fields, keeps description", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      const scheme = wrapper.vm.formData.components.securitySchemes.NewSecurityScheme;
      scheme.description = "keep me";
      scheme.type = "http";
      wrapper.vm.onSecuritySchemeTypeChange(scheme);
      expect(scheme).toEqual({
        type: "http",
        scheme: "bearer",
        bearerFormat: "",
        description: "keep me",
      });
    });

    test("switching to oauth2 gives an empty flows object", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      const scheme = wrapper.vm.formData.components.securitySchemes.NewSecurityScheme;
      scheme.type = "oauth2";
      wrapper.vm.onSecuritySchemeTypeChange(scheme);
      expect(scheme.flows).toEqual({});
    });

    test("switching to openIdConnect gives an empty openIdConnectUrl", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      const scheme = wrapper.vm.formData.components.securitySchemes.NewSecurityScheme;
      scheme.type = "openIdConnect";
      wrapper.vm.onSecuritySchemeTypeChange(scheme);
      expect(scheme.openIdConnectUrl).toBe("");
    });
  });

  describe("renameSecurityScheme", () => {
    test("renames the key, preserving data", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.renameSecurityScheme("NewSecurityScheme", "ApiKeyAuth");
      expect(wrapper.vm.formData.components.securitySchemes.NewSecurityScheme).toBeUndefined();
      expect(wrapper.vm.formData.components.securitySchemes.ApiKeyAuth).toEqual({
        type: "apiKey",
        name: "",
        in: "header",
      });
    });

    test("refuses to rename onto an existing scheme name", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.renameSecurityScheme("NewSecurityScheme1", "NewSecurityScheme");
      expect(wrapper.vm.formData.components.securitySchemes.NewSecurityScheme1).toBeTruthy();
    });

    test("updates references in the global security list", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.formData.security = [{ NewSecurityScheme: [] }];
      wrapper.vm.renameSecurityScheme("NewSecurityScheme", "ApiKeyAuth");
      expect(wrapper.vm.formData.security).toEqual([{ ApiKeyAuth: [] }]);
    });

    test("updates references in a per-operation security override", () => {
      const wrapper = mountFE(
        baseModelValue({
          paths: {
            "/foo": {
              get: {
                responses: { 200: { description: "ok" } },
                security: [{ NewSecurityScheme: ["read"] }],
              },
            },
          },
        })
      );
      wrapper.vm.addSecurityScheme();
      wrapper.vm.renameSecurityScheme("NewSecurityScheme", "ApiKeyAuth");
      expect(wrapper.vm.formData.paths["/foo"].get.security).toEqual([
        { ApiKeyAuth: ["read"] },
      ]);
    });
  });

  describe("removeSecurityScheme", () => {
    test("deletes the scheme via confirm.accept", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.removeSecurityScheme("NewSecurityScheme");
      expect(wrapper.vm.formData.components.securitySchemes.NewSecurityScheme).toBeUndefined();
    });

    test("prunes the scheme out of the global security list, dropping now-empty requirements", () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.formData.security = [{ NewSecurityScheme: [] }, { OtherScheme: [] }];
      wrapper.vm.removeSecurityScheme("NewSecurityScheme");
      expect(wrapper.vm.formData.security).toEqual([{ OtherScheme: [] }]);
    });

    test("prunes the scheme out of per-operation overrides", () => {
      const wrapper = mountFE(
        baseModelValue({
          paths: {
            "/foo": {
              get: {
                responses: { 200: { description: "ok" } },
                security: [{ NewSecurityScheme: [] }],
              },
            },
          },
        })
      );
      wrapper.vm.addSecurityScheme();
      wrapper.vm.removeSecurityScheme("NewSecurityScheme");
      expect(wrapper.vm.formData.paths["/foo"].get.security).toEqual([]);
    });
  });

  describe("oauth2 flows and scopes", () => {
    function oauth2Scheme(wrapper) {
      wrapper.vm.addSecurityScheme();
      const scheme = wrapper.vm.formData.components.securitySchemes.NewSecurityScheme;
      scheme.type = "oauth2";
      wrapper.vm.onSecuritySchemeTypeChange(scheme);
      return scheme;
    }

    test("addOAuth2Flow adds authorizationCode with expected empty fields", () => {
      const wrapper = mountFE();
      const scheme = oauth2Scheme(wrapper);
      wrapper.vm.addOAuth2Flow(scheme, "authorizationCode");
      expect(scheme.flows.authorizationCode).toEqual({
        authorizationUrl: "",
        tokenUrl: "",
        scopes: {},
      });
    });

    test("addOAuth2Flow is a no-op if the flow already exists", () => {
      const wrapper = mountFE();
      const scheme = oauth2Scheme(wrapper);
      wrapper.vm.addOAuth2Flow(scheme, "implicit");
      scheme.flows.implicit.authorizationUrl = "https://example.com/auth";
      wrapper.vm.addOAuth2Flow(scheme, "implicit");
      expect(scheme.flows.implicit.authorizationUrl).toBe("https://example.com/auth");
    });

    test("removeOAuth2Flow deletes the flow", () => {
      const wrapper = mountFE();
      const scheme = oauth2Scheme(wrapper);
      wrapper.vm.addOAuth2Flow(scheme, "clientCredentials");
      wrapper.vm.removeOAuth2Flow(scheme, "clientCredentials");
      expect(scheme.flows.clientCredentials).toBeUndefined();
    });

    test("addScope / removeScope / renameScope on a flow", () => {
      const wrapper = mountFE();
      const scheme = oauth2Scheme(wrapper);
      wrapper.vm.addOAuth2Flow(scheme, "implicit");
      const flow = scheme.flows.implicit;

      wrapper.vm.addScope(flow);
      expect(flow.scopes.newScope).toBe("");

      wrapper.vm.addScope(flow);
      expect(Object.keys(flow.scopes)).toEqual(["newScope", "newScope1"]);

      wrapper.vm.renameScope(flow, "newScope", "read:things");
      expect(flow.scopes["read:things"]).toBe("");
      expect(flow.scopes.newScope).toBeUndefined();

      wrapper.vm.removeScope(flow, "newScope1");
      expect(Object.keys(flow.scopes)).toEqual(["read:things"]);
    });

    test("availableSecuritySchemes surfaces union of scopes across flows", () => {
      const wrapper = mountFE();
      const scheme = oauth2Scheme(wrapper);
      wrapper.vm.addOAuth2Flow(scheme, "implicit");
      wrapper.vm.addOAuth2Flow(scheme, "clientCredentials");
      scheme.flows.implicit.scopes = { "read:things": "" };
      scheme.flows.clientCredentials.scopes = { "write:things": "" };

      const available = wrapper.vm.availableSecuritySchemes.find(
        (s) => s.name === "NewSecurityScheme"
      );
      expect(available.scopes.sort()).toEqual(["read:things", "write:things"]);
    });
  });

  describe("global security requirement list (SecurityRequirementList integration)", () => {
    test("adding a requirement row appends an empty AND-group", () => {
      const wrapper = mountFE();
      wrapper.vm.formData.security.push({});
      expect(wrapper.vm.formData.security).toEqual([{}]);
    });

    test("empty security array is stripped from emitted output", async () => {
      const wrapper = mountFE();
      wrapper.vm.formData.info.title = "Changed";
      await wrapper.vm.$nextTick();
      const emitted = wrapper.emitted("update:modelValue");
      const last = emitted[emitted.length - 1][0];
      expect(last.security).toBeUndefined();
    });

    test("a non-empty security array is preserved in emitted output", async () => {
      const wrapper = mountFE();
      wrapper.vm.addSecurityScheme();
      wrapper.vm.formData.security = [{ NewSecurityScheme: [] }];
      await wrapper.vm.$nextTick();
      const emitted = wrapper.emitted("update:modelValue");
      const last = emitted[emitted.length - 1][0];
      expect(last.security).toEqual([{ NewSecurityScheme: [] }]);
    });
  });

  describe("per-operation security override", () => {
    function specWithOperation() {
      return baseModelValue({
        paths: {
          "/foo": {
            get: { responses: { 200: { description: "ok" } } },
          },
        },
      });
    }

    test("operationSecurityMode defaults to 'inherit' when the key is absent", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      expect(wrapper.vm.operationSecurityMode(op)).toBe("inherit");
    });

    test("operationSecurityMode is 'public' for an explicit empty array", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      op.security = [];
      expect(wrapper.vm.operationSecurityMode(op)).toBe("public");
    });

    test("operationSecurityMode is 'custom' for a non-empty array", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      op.security = [{ ApiKeyAuth: [] }];
      expect(wrapper.vm.operationSecurityMode(op)).toBe("custom");
    });

    test("setOperationSecurityMode('inherit') deletes the security key", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      op.security = [{ ApiKeyAuth: [] }];
      wrapper.vm.setOperationSecurityMode(op, "inherit");
      expect("security" in op).toBe(false);
    });

    test("setOperationSecurityMode('public') sets an empty array", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      wrapper.vm.setOperationSecurityMode(op, "public");
      expect(op.security).toEqual([]);
    });

    test("setOperationSecurityMode('custom') seeds one empty requirement row", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      wrapper.vm.setOperationSecurityMode(op, "custom");
      expect(op.security).toEqual([{}]);
    });

    test("setOperationSecurityMode('custom') preserves an existing non-empty list", () => {
      const wrapper = mountFE(specWithOperation());
      const op = wrapper.vm.formData.paths["/foo"].get;
      op.security = [{ ApiKeyAuth: ["read"] }];
      wrapper.vm.setOperationSecurityMode(op, "custom");
      expect(op.security).toEqual([{ ApiKeyAuth: ["read"] }]);
    });
  });
});
