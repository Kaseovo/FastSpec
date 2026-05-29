import MockAdapter from "axios-mock-adapter";
import { createPinia, setActivePinia } from "pinia";
import {
  api,
  listSpecVersions,
  createSpecVersion,
  getSpecVersion,
  deleteSpecVersion,
  compareSpecVersions,
  publishSpecVersion,
  updateSpec,
} from "./specs";

const mock = new MockAdapter(api);

describe("specs API client", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => mock.reset());

  test("listSpecVersions calls GET and returns data", async () => {
    mock
      .onGet("/api/specs/1/versions")
      .reply(200, [{ id: "v1", version: "1.0.0" }]);
    const res = await listSpecVersions(1);
    expect(res).toEqual([{ id: "v1", version: "1.0.0" }]);
  });

  test("createSpecVersion posts payload and returns created version", async () => {
    const payload = { version: "1.0.1", content: { paths: {} } };
    mock
      .onPost("/api/specs/1/versions", payload)
      .reply(201, { id: "v2", ...payload });
    const res = await createSpecVersion(1, payload);
    expect(res.id).toBe("v2");
    expect(res.version).toBe("1.0.1");
  });

  test("getSpecVersion retrieves specific version", async () => {
    mock
      .onGet("/api/specs/1/versions/1.0.1")
      .reply(200, { id: "v2", version: "1.0.1" });
    const res = await getSpecVersion(1, "1.0.1");
    expect(res.version).toBe("1.0.1");
  });

  test("deleteSpecVersion sends delete request", async () => {
    mock.onDelete("/api/specs/1/versions/1.0.1").reply(204);
    await expect(deleteSpecVersion(1, "1.0.1")).resolves.toBeUndefined();
  });

  test("compareSpecVersions returns compare payload", async () => {
    const body = { base: "1.0.0", compare: "1.0.1" };
    mock.onPost("/api/specs/1/compare", body).reply(200, {
      base: { id: "b" },
      compare: { id: "c" },
      diff: { added: [] },
    });
    const res = await compareSpecVersions(1, "1.0.0", "1.0.1");
    expect(res.diff).toBeDefined();
  });

  test("publishSpecVersion posts publish", async () => {
    mock
      .onPost("/api/specs/1/versions/1.0.1/publish")
      .reply(200, { id: "v2", version: "1.0.1", is_published: true });
    const res = await publishSpecVersion(1, "1.0.1");
    expect(res.is_published).toBe(true);
  });

  test("updateSpec sends name and version", async () => {
    const payload = {
      name: "S",
      version: "1.0.1",
    };
    mock.onPut("/api/specs/1", payload).reply(200, {
      id: 1,
      name: "S",
      version: "1.0.1",
      spec_json: { info: { version: "1.0.1" } },
    });
    const res = await updateSpec(1, payload);
    expect(res.name).toBe("S");
    expect(res.version).toBe("1.0.1");
  });
});
