import { mount } from "@vue/test-utils";
import { vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import SpecList from "../SpecList.vue";

vi.mock("../../api/specs", () => ({
  fetchSpecs: vi.fn(),
  listSpecVersions: vi.fn(),
  compareSpecVersions: vi.fn(),
}));

import {
  fetchSpecs,
  listSpecVersions,
  compareSpecVersions,
} from "../../api/specs";

describe("SpecList - version history read-only", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchSpecs.mockResolvedValue([
      {
        id: 1,
        name: "Test Spec",
        title: "T",
        version: "1.0.1",
        user_id: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    listSpecVersions.mockResolvedValue([
      { id: "v2", version: "1.0.1", is_published: true },
      { id: "v1", version: "1.0.0" },
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("history drawer shows compare controls and can run compare", async () => {
    compareSpecVersions.mockResolvedValue({
      diff: { info: null, added: [], modified: [], removed: [] },
    });
    const wrapper = mount(SpecList, {
      global: {
        plugins: [PrimeVue, ConfirmationService],
        components: {
          Button: { template: "<button />" },
          Select: { template: "<select />" },
          Drawer: { template: "<div><slot /></div>" },
          ProgressSpinner: { template: "<div />" },
          Message: { template: "<div />" },
          ConfirmDialog: { template: "<div />" },
          DiffDrawer: { template: '<div :diff="{}" />' },
        },
        provide: {
          refreshSpecList: { value: 0 },
        },
      },
    });

    // wait for fetchSpecs promise to resolve
    await new Promise((r) => setImmediate(r));

    // open history for the first spec
    await wrapper.vm.openHistory(wrapper.vm.specs[0]);
    // wait for listSpecVersions promise
    await new Promise((r) => setImmediate(r));

    // history should expose compare selectors (Select stub renders a <select>)
    // note: spec cards also render a <select> via the Select stub, so total ≥ 2
    expect(wrapper.findAll("select").length).toBeGreaterThanOrEqual(2);

    // run compare and verify API called with preselected versions
    await wrapper.vm.runCompare();
    expect(compareSpecVersions).toHaveBeenCalledWith(
      wrapper.vm.specs[0].id,
      "v1",
      "v2",
    );
  });

  test("renders transient unsaved card when provided and emits on select", async () => {
    // provide a transient unsaved spec
    const unsaved = {
      id: "__unsaved",
      name: "Untitled Spec",
      spec_json: {
        openapi: "3.0.0",
        info: { title: "Untitled Spec", version: "1.0.0" },
      },
      version: "1.0.0",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const wrapper = mount(SpecList, {
      global: {
        plugins: [PrimeVue, ConfirmationService],
        components: {
          Button: { template: "<button />" },
          Select: { template: "<select />" },
          Drawer: { template: "<div><slot /></div>" },
          ProgressSpinner: { template: "<div />" },
          Message: { template: "<div />" },
          ConfirmDialog: { template: "<div />" },
          DiffDrawer: { template: '<div :diff="{}" />' },
        },
        provide: {
          refreshSpecList: { value: 0 },
          unsavedSpec: { value: unsaved },
        },
      },
    });

    await new Promise((r) => setImmediate(r));

    // transient unsaved should be first in the list
    expect(wrapper.vm.specs[0].id).toBe("__unsaved");
    // clicking the transient item should emit spec-selected with the transient spec
    await wrapper.findAll(".spec-card")[0].trigger("click");
    expect(wrapper.emitted()["spec-selected"]).toBeTruthy();
    const emitted = wrapper.emitted()["spec-selected"][0][0];
    expect(emitted.id).toBe("__unsaved");
    expect(emitted.spec_json).toBeDefined();
  });
});
