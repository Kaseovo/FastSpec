import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PreviewPanel from "../PreviewPanel.vue";

jest.mock("../../api/specs", () => ({
  listSpecVersions: jest.fn(),
  compareSpecVersions: jest.fn(),
}));

import { listSpecVersions, compareSpecVersions } from "../../api/specs";

describe("PreviewPanel - version compare", () => {
  beforeEach(() => {
    // stub Swagger UI to avoid loading external scripts
    global.SwaggerUIBundle = {};
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.SwaggerUIBundle;
  });

  test("loads versions and runs initial compare, rendering diff via DiffDrawer", async () => {
    // mock versions (latest first)
    listSpecVersions.mockResolvedValueOnce([
      { id: "v2", version: "1.0.1", is_published: true },
      { id: "v1", version: "1.0.0" },
    ]);

    const mockDiff = {
      added: [{ path: "/pets", method: "get", summary: "List pets" }],
      modified: [],
      removed: [],
      schemaAdded: [],
      schemaModified: [],
      schemaRemoved: [],
      infoAdded: [],
      infoModified: [],
      infoRemoved: [],
    };

    // compare called automatically after loadVersions sets defaults
    compareSpecVersions.mockResolvedValueOnce({
      base: { id: "v1" },
      compare: { id: "v2" },
      diff: mockDiff,
    });

    const wrapper = mount(PreviewPanel, {
      props: {
        spec: {
          id: 1,
          openapi: "3.0.0",
          info: { title: "T" },
          components: { schemas: {} },
        },
      },
      global: {
        // stub DiffDrawer to capture the diff prop
        components: {
          DiffDrawer: {
            props: ["diff", "spec", "inline"],
            template:
              '<div class="diff-stub">DIFF:{{ JSON.stringify(diff) }}</div>',
          },
        },
      },
    });

    // wait for loadVersions and initial compare to resolve
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // ensure defaults set
    expect(wrapper.vm.baseVersion).toBe("1.0.0");
    expect(wrapper.vm.compareVersion).toBe("1.0.1");

    // Expect DiffDrawer stub to be present with diff JSON (initial compare)
    await nextTick();
    const stub = wrapper.find(".diff-stub");
    expect(stub.exists()).toBe(true);
    expect(stub.text()).toContain('"added"');
    expect(stub.text()).toContain("/pets");
  });

  test("changing version selection triggers compare and updates diff", async () => {
    // three versions: v3 (latest published), v2 (published), v1
    listSpecVersions.mockResolvedValueOnce([
      { id: "v3", version: "1.0.2", is_published: true },
      { id: "v2", version: "1.0.1", is_published: true },
      { id: "v1", version: "1.0.0" },
    ]);

    const initialDiff = { added: [{ path: "/a" }], modified: [], removed: [] };
    const updatedDiff = { added: [], modified: [{ path: "/b" }], removed: [] };

    // two compare responses: initial and after user change
    compareSpecVersions.mockResolvedValueOnce({
      base: { id: "v2" },
      compare: { id: "v3" },
      diff: initialDiff,
    });
    compareSpecVersions.mockResolvedValueOnce({
      base: { id: "v2" },
      compare: { id: "v1" },
      diff: updatedDiff,
    });

    const wrapper = mount(PreviewPanel, {
      props: {
        spec: {
          id: 1,
          openapi: "3.0.0",
          info: { title: "T" },
          components: { schemas: {} },
        },
      },
      global: {
        components: {
          DiffDrawer: {
            props: ["diff", "spec", "inline"],
            template:
              '<div class="diff-stub">DIFF:{{ JSON.stringify(diff) }}</div>',
          },
        },
      },
    });

    // wait for initial compare
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // initial defaults should be latest two published
    expect(wrapper.vm.baseVersion).toBe("1.0.1");
    expect(wrapper.vm.compareVersion).toBe("1.0.2");

    // initial diff displayed
    await nextTick();
    expect(wrapper.find(".diff-stub").text()).toContain("/a");

    // simulate user changing compare version to 1.0.0
    wrapper.vm.compareVersion = "1.0.0";
    await nextTick();
    // allow watcher-triggered compare to resolve
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // expect compareSpecVersions called twice (initial + change)
    expect(compareSpecVersions).toHaveBeenCalledTimes(2);

    // updated diff displayed
    await nextTick();
    expect(wrapper.find(".diff-stub").text()).toContain("/b");
  });
});
