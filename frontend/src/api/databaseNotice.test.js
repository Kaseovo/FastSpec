import MockAdapter from "axios-mock-adapter";
import { createPinia, setActivePinia } from "pinia";
import { databaseNotice, noteDatabaseLimit } from "./databaseNotice";
import { createApiClient } from "./http";

const answer = (status, code, detail = `detail for ${code}`) => ({
  response: { status, data: { code, detail } },
});

beforeEach(() => {
  databaseNotice.code = null;
  databaseNotice.message = null;
});

describe("noteDatabaseLimit", () => {
  test.each([
    [503, "database_quota_exceeded"],
    [507, "database_storage_full"],
  ])("a %s %s becomes the app-wide notice", (status, code) => {
    noteDatabaseLimit(answer(status, code));

    expect(databaseNotice).toEqual({ code, message: `detail for ${code}` });
  });

  test.each([
    ["an ordinary outage", answer(503, "database_unavailable")],
    ["another error", answer(400, undefined)],
    ["a network error", new Error("Network Error")],
  ])("ignores %s", (_, error) => {
    noteDatabaseLimit(error);

    expect(databaseNotice.message).toBeNull();
  });
});

describe("API calls that hit a database limit", () => {
  test("raise the notice, and still fail like any error", async () => {
    setActivePinia(createPinia());
    const client = createApiClient();
    new MockAdapter(client).onPost("/api/specs").reply(507, {
      code: "database_storage_full",
      detail: "FastSpec's database is full",
    });

    await expect(client.post("/api/specs", {})).rejects.toMatchObject({
      response: { status: 507 },
    });
    expect(databaseNotice.code).toBe("database_storage_full");
  });
});
