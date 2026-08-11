// Regression test: hasChanges used to be computed independently from
// summary and omitted server-added/modified/removed entirely, so a diff
// containing only server changes made summary's pills non-zero while
// hasChanges stayed false -- DiffDrawer's `v-if="!hasChanges"` then rendered
// "No Changes" and never mounted the cards area (including
// DiffServersSection), hiding the server diff from view.

import { useDiffDrawer } from "../useDiffDrawer";

function makeProps(diff) {
  return { diff, spec: {}, markdown: null };
}

describe("useDiffDrawer - hasChanges / summary agreement", () => {
  test("hasChanges is false and summary is all-zero for an empty diff", () => {
    const { hasChanges, summary } = useDiffDrawer(makeProps({}));
    expect(hasChanges.value).toBe(false);
    expect(summary.value).toEqual({ added: 0, modified: 0, removed: 0 });
  });

  test("a diff with only serverAdded is reflected in both summary and hasChanges", () => {
    const diff = { serverAdded: [{ url: "https://api.example.com" }] };
    const { hasChanges, summary } = useDiffDrawer(makeProps(diff));
    expect(summary.value.added).toBe(1);
    expect(hasChanges.value).toBe(true);
  });

  test("a diff with only serverModified is reflected in both summary and hasChanges", () => {
    const diff = { serverModified: [{ url: "https://api.example.com" }] };
    const { hasChanges, summary } = useDiffDrawer(makeProps(diff));
    expect(summary.value.modified).toBe(1);
    expect(hasChanges.value).toBe(true);
  });

  test("a diff with only serverRemoved is reflected in both summary and hasChanges", () => {
    const diff = { serverRemoved: [{ url: "https://api.example.com" }] };
    const { hasChanges, summary } = useDiffDrawer(makeProps(diff));
    expect(summary.value.removed).toBe(1);
    expect(hasChanges.value).toBe(true);
  });

  test("hasChanges matches (summary.added + modified + removed > 0) for a mixed diff", () => {
    const diff = {
      added: [{ path: "/a" }],
      schemaModified: [{ name: "Foo" }],
      serverRemoved: [{ url: "https://old.example.com" }],
    };
    const { hasChanges, summary } = useDiffDrawer(makeProps(diff));
    expect(summary.value).toEqual({ added: 1, modified: 1, removed: 1 });
    expect(hasChanges.value).toBe(true);
  });
});
