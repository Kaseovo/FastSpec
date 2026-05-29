import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { vi } from "vitest";
import PreviewPanel from "../PreviewPanel.vue";

vi.mock("../../api/specs", () => ({
  listSpecVersions: vi.fn(),
  compareSpecVersions: vi.fn(),
}));

import { listSpecVersions, compareSpecVersions } from "../../api/specs";

// flush all pending promises and microtasks
const flushAll = async (n = 4) => {
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setImmediate(r));
  }
  await nextTick();
};

describe("PreviewPanel - version compare", () => {
  beforeEach(() => {
    // stub Swagger UI to avoid loading external scripts
    global.SwaggerUIBundle = {};
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete global.SwaggerUIBundle;
  });

  test("loads versions and runs initial compare, rendering diff via DiffDrawer", async () => {
    // mock versions (latest first)
    listSpecVersions.mockResolvedValue([
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

    // Use mockResolvedValue (not Once) so the watcher-triggered compare and
    // the onMounted-triggered compare both get the same diff.
    compareSpecVersions.mockResolvedValue({
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
        stubs: {
          DiffDrawer: {
            props: ["diff", "spec", "inline"],
            template:
              '<div class="diff-stub">DIFF:{{ JSON.stringify(diff) }}</div>',
          },
        },
      },
    });

    await flushAll();

    // ensure defaults set
    expect(wrapper.vm.baseVersion).toBe("1.0.0");
    expect(wrapper.vm.compareVersion).toBe("1.0.1");

    // DiffDrawer should be present with the diff JSON
    const stub = wrapper.find(".diff-stub");
    expect(stub.exists()).toBe(true);
    expect(stub.text()).toContain('"added"');
    expect(stub.text()).toContain("/pets");
  });

  test("changing version selection triggers compare and updates diff", async () => {
    // three versions: v3 (latest published), v2 (published), v1
    listSpecVersions.mockResolvedValue([
      { id: "v3", version: "1.0.2", is_published: true },
      { id: "v2", version: "1.0.1", is_published: true },
      { id: "v1", version: "1.0.0" },
    ]);

    const initialDiff = { added: [{ path: "/a" }], modified: [], removed: [] };
    const updatedDiff = { added: [], modified: [{ path: "/b" }], removed: [] };

    // Use mockResolvedValue for initial phase so watcher + onMounted calls
    // all return initialDiff. Then override once for the user-triggered change.
    compareSpecVersions.mockResolvedValue({
      base: { id: "v2" },
      compare: { id: "v3" },
      diff: initialDiff,
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
        stubs: {
          DiffDrawer: {
            props: ["diff", "spec", "inline"],
            template:
              '<div class="diff-stub">DIFF:{{ JSON.stringify(diff) }}</div>',
          },
        },
      },
    });

    await flushAll();

    // initial defaults should be latest two published
    expect(wrapper.vm.baseVersion).toBe("1.0.1");
    expect(wrapper.vm.compareVersion).toBe("1.0.2");

    // initial diff displayed
    expect(wrapper.find(".diff-stub").text()).toContain("/a");

    // override next call for the user-triggered change
    compareSpecVersions.mockResolvedValueOnce({
      base: { id: "v2" },
      compare: { id: "v1" },
      diff: updatedDiff,
    });

    // simulate user changing compare version to 1.0.0
    wrapper.vm.compareVersion = "1.0.0";
    await flushAll();

    // updated diff displayed
    expect(wrapper.find(".diff-stub").text()).toContain("/b");
  });
});
