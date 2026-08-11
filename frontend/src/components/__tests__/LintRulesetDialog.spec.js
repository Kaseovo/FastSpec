// Regression tests: LintRulesetDialog's error banner used to live only
// inside the Raw YAML TabPanel (yaml-error-msg), so a failed create (409
// duplicate name) or delete (409 pinned-to-specs / default-with-others) gave
// the user zero visible feedback whenever that specific DOM branch wasn't
// mounted -- which is the common case, since creatingNew and the default
// "rules" tab both hide it. The fix moves the error Message to the top of
// the dialog, rendered regardless of state.

import { mount, flushPromises } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import Tooltip from "primevue/tooltip";
import LintRulesetDialog from "../LintRulesetDialog.vue";

const mockApi = vi.hoisted(() => ({
  createLintRuleset: vi.fn(),
  deleteLintRuleset: vi.fn(),
  getLintRuleset: vi.fn(),
  listLintRulesets: vi.fn(),
  previewLintRule: vi.fn(),
  setDefaultLintRuleset: vi.fn(),
  updateLintRuleset: vi.fn(),
}));

vi.mock("../../api/lint", () => mockApi);

vi.mock("primevue/useconfirm", () => ({
  useConfirm: () => ({
    require: (opts) => opts.accept && opts.accept(),
    close: () => {},
  }),
}));

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

function mountDialog() {
  const wrapper = mount(LintRulesetDialog, {
    props: { open: false, specContent: "" },
    global: {
      plugins: [PrimeVue, ConfirmationService],
      directives: { tooltip: Tooltip },
    },
  });
  return wrapper;
}

const RULESET_A = { id: "r1", name: "Internal API", is_default: true, rules_json: [], raw_yaml: null };

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.listLintRulesets.mockResolvedValue([RULESET_A]);
  mockApi.getLintRuleset.mockResolvedValue(RULESET_A);
});

describe("LintRulesetDialog - error visibility", () => {
  test("a failed ruleset creation (409 duplicate name) shows the error while the create row is still open", async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();

    // Enter "create new" mode -- this is the state the old bug hid errors in.
    wrapper.vm.startCreateRuleset();
    wrapper.vm.newRulesetName = "Internal API";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.creatingNew).toBe(true);

    mockApi.createLintRuleset.mockRejectedValue({
      response: { status: 409, data: { detail: "A ruleset named 'Internal API' already exists." } },
    });

    await wrapper.vm.onCreateRuleset();
    await wrapper.vm.$nextTick();

    expect(document.body.textContent).toContain("A ruleset named 'Internal API' already exists.");
  });

  test("a failed ruleset deletion (409 pinned to specs) shows the error while on the default Structured Rules tab", async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();
    wrapper.vm.selectedRulesetId = "r1";
    await flushPromises();

    // activeTab defaults to "rules" and onDelete never switches it -- this
    // is exactly the state the old bug's error was invisible in.
    expect(wrapper.vm.activeTab).toBe("rules");

    mockApi.deleteLintRuleset.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: "Ruleset is assigned to one or more specs and can't be deleted until they're reassigned." },
      },
    });

    wrapper.vm.onDelete(); // confirm.require's accept fires synchronously (mocked above)
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(document.body.textContent).toContain(
      "Ruleset is assigned to one or more specs and can't be deleted until they're reassigned."
    );
  });

  test("the error banner is not tied to the yaml tab being active", async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();
    wrapper.vm.selectedRulesetId = "r1";
    await flushPromises();

    wrapper.vm.yamlError = "Some failure";
    await wrapper.vm.$nextTick();

    // Not inside the (inactive) yaml TabPanel -- it's a sibling at the top
    // of the dialog, so it's present regardless of which tab is showing.
    expect(wrapper.vm.activeTab).toBe("rules");
    expect(document.body.textContent).toContain("Some failure");
  });
});

describe("LintRulesetDialog - set default", () => {
  test("guards against overlapping calls while a set-default request is in flight", async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();
    wrapper.vm.selectedRulesetId = "r1";
    await flushPromises();

    let resolveSetDefault;
    mockApi.setDefaultLintRuleset.mockReturnValue(
      new Promise((resolve) => {
        resolveSetDefault = resolve;
      })
    );

    const firstCall = wrapper.vm.onSetDefault();
    expect(wrapper.vm.settingDefault).toBe(true);

    // A second click while the first request is still in flight must not
    // fire a second overlapping request.
    await wrapper.vm.onSetDefault();
    expect(mockApi.setDefaultLintRuleset).toHaveBeenCalledTimes(1);

    resolveSetDefault();
    await firstCall;
    expect(wrapper.vm.settingDefault).toBe(false);
  });

  test("emits set-default on success so listeners (e.g. LintPanel) can refresh", async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();
    wrapper.vm.selectedRulesetId = "r1";
    await flushPromises();

    mockApi.setDefaultLintRuleset.mockResolvedValue({});
    await wrapper.vm.onSetDefault();

    expect(wrapper.emitted("set-default")).toBeTruthy();
  });
});
