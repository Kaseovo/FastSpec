import { ref } from "vue";
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/specs", () => ({
  lintSpec: vi.fn(),
  lintSpecById: vi.fn(),
}));

import { lintSpec, lintSpecById } from "../../api/specs";
import { useLint } from "../useLint";

describe("useLint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Cycle 1: shape
  test("returns lintResults, lintLoading, lintError, runLint", () => {
    const specContentRef = ref("{}");
    const currentSpecRef = ref(null);
    const lint = useLint({ specContentRef, currentSpecRef });
    expect(lint).toHaveProperty("lintResults");
    expect(lint).toHaveProperty("lintLoading");
    expect(lint).toHaveProperty("lintError");
    expect(lint).toHaveProperty("runLint");
    expect(typeof lint.runLint).toBe("function");
  });

  // Cycle 2: loading flag
  test("runLint sets lintLoading=true during call, false on completion", async () => {
    lintSpec.mockResolvedValue({ score: 100, results: [] });
    const specContentRef = ref('{"openapi":"3.0.0"}');
    const currentSpecRef = ref(null);
    const { runLint, lintLoading } = useLint({ specContentRef, currentSpecRef });
    const promise = runLint();
    expect(lintLoading.value).toBe(true);
    await promise;
    expect(lintLoading.value).toBe(false);
  });

  // Cycle 3: invalid JSON sets error and skips API
  test("runLint sets lintError and skips API when specContent is invalid JSON", async () => {
    const specContentRef = ref("not-valid-json");
    const currentSpecRef = ref(null);
    const { runLint, lintError, lintLoading } = useLint({ specContentRef, currentSpecRef });
    await runLint();
    expect(lintError.value).toBeTruthy();
    expect(lintSpec).not.toHaveBeenCalled();
    expect(lintSpecById).not.toHaveBeenCalled();
    expect(lintLoading.value).toBe(false);
  });

  // Cycle 4: clears lintError at start of each call
  test("runLint clears lintError at start of each call", async () => {
    lintSpec.mockResolvedValue({ score: 90, results: [] });
    const specContentRef = ref("not-valid");
    const currentSpecRef = ref(null);
    const { runLint, lintError } = useLint({ specContentRef, currentSpecRef });
    await runLint(); // sets error
    expect(lintError.value).toBeTruthy();

    specContentRef.value = '{"openapi":"3.0.0"}';
    await runLint(); // should clear error first
    expect(lintError.value).toBeNull();
  });

  // Cycle 5: calls by-id path when spec has id + version and not __unsaved
  test("runLint calls lintSpecById when currentSpec has persisted id + version", async () => {
    lintSpecById.mockResolvedValue({ score: 95, results: [] });
    const specContentRef = ref('{"openapi":"3.0.0"}');
    const currentSpecRef = ref({ id: "abc123", version: "1.0.0" });
    const { runLint, lintResults } = useLint({ specContentRef, currentSpecRef });
    await runLint();
    expect(lintSpecById).toHaveBeenCalledWith("abc123", "1.0.0");
    expect(lintSpec).not.toHaveBeenCalled();
    expect(lintResults.value.score).toBe(95);
  });

  // Cycle 6: calls ad-hoc path when spec is unsaved
  test("runLint calls lintSpec (ad-hoc) when id is __unsaved", async () => {
    lintSpec.mockResolvedValue({ score: 80, results: [] });
    const specContentRef = ref('{"openapi":"3.0.0"}');
    const currentSpecRef = ref({ id: "__unsaved", version: "1.0.0" });
    const { runLint } = useLint({ specContentRef, currentSpecRef });
    await runLint();
    expect(lintSpec).toHaveBeenCalledWith({ openapi: "3.0.0" });
    expect(lintSpecById).not.toHaveBeenCalled();
  });

  // Cycle 7: sets lintError from API error
  test("runLint sets lintError from err.response.data.detail or err.message on throw", async () => {
    lintSpec.mockRejectedValue({
      response: { data: { detail: "lint service down" } },
    });
    const specContentRef = ref('{"openapi":"3.0.0"}');
    const currentSpecRef = ref(null);
    const { runLint, lintError, lintLoading } = useLint({ specContentRef, currentSpecRef });
    await runLint();
    expect(lintError.value).toBe("lint service down");
    expect(lintLoading.value).toBe(false);
  });
});
