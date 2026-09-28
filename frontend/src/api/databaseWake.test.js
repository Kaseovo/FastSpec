import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { createPinia, setActivePinia } from "pinia";
import {
  POLL_INTERVAL_MS,
  READY_URL,
  SLOW_AFTER_MS,
  databaseStatus,
  waitForDatabase,
} from "./databaseWake";
import { createApiClient } from "./http";

const readiness = new MockAdapter(axios);
const STARTING = [503, { status: "not_ready", code: "database_starting" }];

afterEach(() => {
  readiness.reset();
  vi.useRealTimers();
});

describe("waitForDatabase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("resolves straight away when the database is up", async () => {
    readiness.onGet(READY_URL).reply(200, { status: "ready" });

    await waitForDatabase();

    expect(databaseStatus.waking).toBe(false);
    expect(readiness.history.get).toHaveLength(1);
  });

  test("shows the waking-up screen and polls until the database is up", async () => {
    readiness
      .onGet(READY_URL).replyOnce(...STARTING)
      .onGet(READY_URL).replyOnce(...STARTING)
      .onGet(READY_URL).reply(200, { status: "ready" });

    const done = waitForDatabase();
    await vi.advanceTimersByTimeAsync(0);
    expect(databaseStatus.waking).toBe(true);

    await vi.advanceTimersByTimeAsync(2 * POLL_INTERVAL_MS);
    await done;

    expect(databaseStatus.waking).toBe(false);
    expect(readiness.history.get).toHaveLength(3);
  });

  test("says so when waking up takes longer than usual", async () => {
    readiness.onGet(READY_URL).reply(...STARTING);

    const done = waitForDatabase();
    await vi.advanceTimersByTimeAsync(0);
    expect(databaseStatus.slow).toBe(false);

    await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS + POLL_INTERVAL_MS);
    expect(databaseStatus.slow).toBe(true);

    readiness.reset();
    readiness.onGet(READY_URL).reply(200, { status: "ready" });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await done;
    expect(databaseStatus).toEqual({ waking: false, slow: false });
  });

  test.each([
    ["the server is down", () => readiness.onGet(READY_URL).networkError()],
    ["the database is simply unavailable", () =>
      readiness.onGet(READY_URL).reply(503, { code: "database_unavailable" })],
    ["the backend predates readiness checks", () => readiness.onGet(READY_URL).reply(404)],
  ])("stops waiting when %s", async (_, respond) => {
    respond();

    await waitForDatabase();

    expect(databaseStatus.waking).toBe(false);
  });

  test("concurrent callers share one wait", async () => {
    readiness.onGet(READY_URL).reply(200, { status: "ready" });

    await Promise.all([waitForDatabase(), waitForDatabase()]);

    expect(readiness.history.get).toHaveLength(1);
  });
});

describe("API calls while the database wakes up", () => {
  let client;
  let api;

  beforeEach(() => {
    setActivePinia(createPinia());
    client = createApiClient();
    api = new MockAdapter(client);
    readiness.onGet(READY_URL).reply(200, { status: "ready" });
  });

  test("wait for it, then retry", async () => {
    api.onGet("/api/specs").replyOnce(...STARTING).onGet("/api/specs").reply(200, ["pets"]);

    const { data } = await client.get("/api/specs");

    expect(data).toEqual(["pets"]);
    expect(readiness.history.get).toHaveLength(1);
  });

  test("retry only once", async () => {
    api.onGet("/api/specs").reply(...STARTING);

    await expect(client.get("/api/specs")).rejects.toMatchObject({
      response: { status: 503 },
    });
    expect(api.history.get).toHaveLength(2);
  });
});
