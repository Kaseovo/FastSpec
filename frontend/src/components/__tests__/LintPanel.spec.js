import { mount, flushPromises } from "@vue/test-utils";
import { vi } from "vitest";
import LintPanel from "../LintPanel.vue";

const mockLintApi = vi.hoisted(() => ({
  listLintRulesets: vi.fn(),
  assignSpecRuleset: vi.fn(),
}));
vi.mock("../../api/lint", () => mockLintApi);

const mockSpecsApi = vi.hoisted(() => ({
  fetchSpec: vi.fn(),
}));
vi.mock("../../api/specs", () => mockSpecsApi);

// Stub PrimeVue components that are not relevant to unit-testing logic
const stubComponents = {
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ["click"] },
  Message: { template: "<div><slot /></div>" },
  ProgressSpinner: { template: "<div class='spinner' />" },
  LintRulesetDialog: { template: "<div />" },
  Select: {
    props: ["modelValue", "options"],
    emits: ["update:model-value"],
    template: "<div class='stub-select' />",
  },
};

const LINT_RESULTS_CLEAN = {
  score: 100,
  summary: { error: 0, warn: 0, info: 0, hint: 0 },
  results: [],
};

const LINT_RESULTS_WITH_ISSUES = {
  score: 74,
  summary: { error: 0, warn: 2, info: 0, hint: 0 },
  results: [
    {
      code: "operation-description",
      message: "Operation must have a description",
      severity: "warn",
      path: ["paths", "/users", "get"],
      range: { start: { line: 12, character: 4 } },
    },
    {
      code: "info-contact",
      message: "Info object should contain `contact` object",
      severity: "warn",
      path: ["info"],
      range: { start: { line: 2, character: 0 } },
    },
  ],
};

const LINT_RESULTS_MULTI_SEVERITY = {
  score: 50,
  summary: { error: 1, warn: 1, info: 1, hint: 1 },
  results: [
    { code: "err-code",  message: "error msg",  severity: "error", path: [], range: {} },
    { code: "warn-code", message: "warn msg",   severity: "warn",  path: [], range: {} },
    { code: "info-code", message: "info msg",   severity: "info",  path: [], range: {} },
    { code: "hint-code", message: "hint msg",   severity: "hint",  path: [], range: {} },
  ],
};

describe("LintPanel", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Empty / initial state ──────────────────────────────────────────────────

  test("shows empty state and Run Lint button when results is null", () => {
    const wrapper = mount(LintPanel, {
      props: { results: null, loading: false, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".lint-empty").exists()).toBe(true);
    const btn = wrapper.findComponent({ name: "Button" });
    expect(btn.exists()).toBe(true);
  });

  test("emits run-lint when Run Lint button is clicked in empty state", async () => {
    const wrapper = mount(LintPanel, {
      props: { results: null, loading: false, error: null },
      global: { components: stubComponents },
    });
    await wrapper.find(".lint-empty button").trigger("click");
    expect(wrapper.emitted("run-lint")).toBeTruthy();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  test("shows loading spinner when loading prop is true", () => {
    const wrapper = mount(LintPanel, {
      props: { results: null, loading: true, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".lint-loading").exists()).toBe(true);
    expect(wrapper.findComponent({ name: "ProgressSpinner" }).exists()).toBe(true);
  });

  // ── Error state ────────────────────────────────────────────────────────────

  test("shows error message when error prop is set", () => {
    const wrapper = mount(LintPanel, {
      props: { results: null, loading: false, error: "CLI not found" },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".lint-error").exists()).toBe(true);
    expect(wrapper.text()).toContain("CLI not found");
  });

  // ── Score bar ──────────────────────────────────────────────────────────────

  test("renders score bar with correct value and green class for high score", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_CLEAN, loading: false, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".score-value").text()).toBe("100");
    expect(wrapper.find(".score-value").classes()).toContain("score-good");
  });

  test("renders orange score class for mid-range score", () => {
    const results = { ...LINT_RESULTS_WITH_ISSUES, score: 60 };
    const wrapper = mount(LintPanel, {
      props: { results, loading: false, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".score-value").classes()).toContain("score-warn");
  });

  test("renders red score class for low score", () => {
    const results = { ...LINT_RESULTS_WITH_ISSUES, score: 20 };
    const wrapper = mount(LintPanel, {
      props: { results, loading: false, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".score-value").classes()).toContain("score-bad");
  });

  // ── Summary pills ──────────────────────────────────────────────────────────

  test("renders four severity pills with correct counts", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_MULTI_SEVERITY, loading: false, error: null },
      global: { components: stubComponents },
    });
    const pills = wrapper.findAll(".severity-pill");
    // severities array has 5 entries: "All" + error + warn + info + hint
    expect(pills).toHaveLength(5);

    // Each pill should show count 1 (skip "All" pill at index 0 which has no count)
    pills.slice(1).forEach((pill) => {
      expect(pill.find(".pill-count").text()).toBe("1");
    });
  });

  test("filters results when a severity pill is clicked", async () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_MULTI_SEVERITY, loading: false, error: null },
      global: { components: stubComponents },
    });

    // Initially all 4 results visible
    expect(wrapper.findAll(".lint-result-item")).toHaveLength(4);

    // Click the "error" pill
    const errorPill = wrapper.find(".severity-pill.error");
    await errorPill.trigger("click");

    expect(wrapper.findAll(".lint-result-item")).toHaveLength(1);
    expect(wrapper.find(".lint-result-item").classes()).toContain("error");
  });

  test("clicking active severity pill again clears filter", async () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_MULTI_SEVERITY, loading: false, error: null },
      global: { components: stubComponents },
    });

    const warnPill = wrapper.find(".severity-pill.warn");
    await warnPill.trigger("click");
    expect(wrapper.findAll(".lint-result-item")).toHaveLength(1);

    // Click again to deactivate
    await warnPill.trigger("click");
    expect(wrapper.findAll(".lint-result-item")).toHaveLength(4);
  });

  // ── Result items ───────────────────────────────────────────────────────────

  test("renders result items with correct structure", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_WITH_ISSUES, loading: false, error: null },
      global: { components: stubComponents },
    });
    const items = wrapper.findAll(".lint-result-item");
    expect(items).toHaveLength(2);

    const first = items[0];
    expect(first.classes()).toContain("warn");
    expect(first.find(".result-message").text()).toContain("Operation must have a description");
    expect(first.find(".result-code").text()).toBe("operation-description");
  });

  test("shows path as breadcrumb string in result item", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_WITH_ISSUES, loading: false, error: null },
      global: { components: stubComponents },
    });
    const first = wrapper.findAll(".lint-result-item")[0];
    expect(first.find(".result-path").text()).toBe("paths › /users › get");
  });

  test("shows 1-based line number in result item", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_WITH_ISSUES, loading: false, error: null },
      global: { components: stubComponents },
    });
    // range.start.line = 12 → displayed as line 13
    expect(wrapper.findAll(".lint-result-item")[0].find(".result-line").text()).toBe("line 13");
  });

  test("emits go-to-line event with result when item is clicked", async () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_WITH_ISSUES, loading: false, error: null },
      global: { components: stubComponents },
    });
    await wrapper.findAll(".lint-result-item")[0].trigger("click");
    expect(wrapper.emitted("go-to-line")).toBeTruthy();
    expect(wrapper.emitted("go-to-line")[0][0].code).toBe("operation-description");
  });

  // ── No results after filter ────────────────────────────────────────────────

  test("shows no-results message when all issues filtered out", async () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_WITH_ISSUES, loading: false, error: null },
      global: { components: stubComponents },
    });
    // Filter by error — there are none
    await wrapper.find(".severity-pill.error").trigger("click");
    expect(wrapper.find(".lint-no-results").exists()).toBe(true);
    expect(wrapper.find(".lint-no-results").text()).toContain("error");
  });

  // ── Zero issues (clean spec) ───────────────────────────────────────────────

  test("shows no-results message without filter text when spec is clean", () => {
    const wrapper = mount(LintPanel, {
      props: { results: LINT_RESULTS_CLEAN, loading: false, error: null },
      global: { components: stubComponents },
    });
    expect(wrapper.find(".lint-no-results").exists()).toBe(true);
    expect(wrapper.find(".lint-no-results").text()).toContain("No issues found.");
  });

  // ── Per-spec ruleset assignment ──────────────────────────────────────────

  const RULESET_A = { id: "r1", name: "Internal API", is_default: true };
  const RULESET_B = { id: "r2", name: "Public API strict", is_default: false };

  describe("ruleset assignment", () => {
    beforeEach(() => {
      vi.resetAllMocks();
      mockLintApi.listLintRulesets.mockResolvedValue([RULESET_A, RULESET_B]);
      mockSpecsApi.fetchSpec.mockResolvedValue({ id: "spec-1", active_ruleset_id: "r1" });
      mockLintApi.assignSpecRuleset.mockResolvedValue({});
    });

    function mountWithSpec(props = {}) {
      return mount(LintPanel, {
        props: { results: null, loading: false, error: null, specId: "spec-1", ...props },
        global: { components: stubComponents },
      });
    }

    test("a failed assignment reverts the dropdown instead of leaving an unpersisted selection", async () => {
      const wrapper = mountWithSpec();
      await flushPromises();
      expect(wrapper.vm.assignedRulesetId).toBe("r1");

      mockLintApi.assignSpecRuleset.mockRejectedValue(new Error("network error"));
      await wrapper.vm.onAssignRuleset("r2");
      await flushPromises();

      // Not "r2" -- the PUT failed, so the dropdown must reflect what's
      // actually persisted (r1), not the attempted-but-failed change.
      expect(wrapper.vm.assignedRulesetId).toBe("r1");
    });

    test("a successful assignment keeps the new selection and re-runs lint", async () => {
      const wrapper = mountWithSpec();
      await flushPromises();

      await wrapper.vm.onAssignRuleset("r2");
      await flushPromises();

      expect(wrapper.vm.assignedRulesetId).toBe("r2");
      expect(mockLintApi.assignSpecRuleset).toHaveBeenCalledWith("spec-1", "r2");
      expect(wrapper.emitted("run-lint")).toBeTruthy();
    });

    test("onRulesetDialogChanged (saved/deleted/set-default) reloads the assignment", async () => {
      const wrapper = mountWithSpec();
      await flushPromises();
      expect(mockLintApi.listLintRulesets).toHaveBeenCalledTimes(1);

      // Simulate the dialog renaming/deleting/re-defaulting a ruleset
      // server-side, then firing one of its change events.
      mockLintApi.listLintRulesets.mockResolvedValue([RULESET_A, { ...RULESET_B, name: "Renamed" }]);
      const dialog = wrapper.findComponent({ name: "LintRulesetDialog" });
      dialog.vm.$emit("saved");
      await flushPromises();

      expect(mockLintApi.listLintRulesets).toHaveBeenCalledTimes(2);
      expect(wrapper.vm.rulesetAssignOptions).toContainEqual({ label: "Renamed", value: "r2" });
      expect(wrapper.emitted("run-lint")).toBeTruthy();
    });

    test("set-default event from the dialog also reloads the assignment", async () => {
      const wrapper = mountWithSpec();
      await flushPromises();
      expect(mockLintApi.listLintRulesets).toHaveBeenCalledTimes(1);

      const dialog = wrapper.findComponent({ name: "LintRulesetDialog" });
      dialog.vm.$emit("set-default");
      await flushPromises();

      expect(mockLintApi.listLintRulesets).toHaveBeenCalledTimes(2);
    });
  });
});
