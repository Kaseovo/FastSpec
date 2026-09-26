import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../stores/auth";
import { bootstrapSession, SIGN_IN_CALLBACK_PATH } from "../session";
import { createApiClient } from "../../api/http";

const USER = { id: 1, email: "local@localhost", provider: "local" };
const NONE_CONFIG = { mode: "none", provider_name: null, login_url: null };
const OIDC_CONFIG = { mode: "oidc", provider_name: "Google", login_url: "/auth/oidc/login" };

let globalMock;

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  globalMock = new MockAdapter(axios);
  window.history.replaceState(null, "", "/specs/");
});

afterEach(() => {
  globalMock.restore();
});

describe("bootstrapSession", () => {
  test("single-user mode starts a local session", async () => {
    globalMock.onGet("/auth/config").reply(200, NONE_CONFIG);
    globalMock.onPost("/auth/local/session").reply(200, { access_token: "t1", user: USER });

    await bootstrapSession();

    const auth = useAuthStore();
    expect(auth.authMode).toBe("none");
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.token).toBe("t1");
  });

  test("OIDC mode does not start a session on its own", async () => {
    globalMock.onGet("/auth/config").reply(200, OIDC_CONFIG);

    await bootstrapSession();

    const auth = useAuthStore();
    expect(auth.authMode).toBe("oidc");
    expect(auth.providerName).toBe("Google");
    expect(auth.isAuthenticated).toBe(false);
    expect(globalMock.history.post).toHaveLength(0);
  });

  test("completes the sign-in redirect and clears the token from the URL", async () => {
    window.history.replaceState(null, "", `${SIGN_IN_CALLBACK_PATH}#token=abc`);
    globalMock.onGet("/auth/me").reply((config) => {
      expect(config.headers.Authorization).toBe("Bearer abc");
      return [200, { ...USER, provider: "google" }];
    });
    globalMock.onGet("/auth/config").reply(200, OIDC_CONFIG);

    await bootstrapSession();

    const auth = useAuthStore();
    expect(auth.token).toBe("abc");
    expect(auth.isAuthenticated).toBe(true);
    expect(window.location.pathname).toBe("/specs/");
    expect(window.location.hash).toBe("");
  });

  test("surfaces a sign-in error from the redirect", async () => {
    window.history.replaceState(
      null,
      "",
      `${SIGN_IN_CALLBACK_PATH}#error=${encodeURIComponent("Not allowed")}`,
    );
    globalMock.onGet("/auth/config").reply(200, OIDC_CONFIG);

    await bootstrapSession();

    const auth = useAuthStore();
    expect(auth.oauthError).toBe("Not allowed");
    expect(auth.isAuthenticated).toBe(false);
  });

  test("flags an unreachable server", async () => {
    globalMock.onGet("/auth/config").networkError();

    await bootstrapSession();

    expect(useAuthStore().serverUnreachable).toBe(true);
  });
});

describe("createApiClient 401 handling", () => {
  test("single-user mode renews the session and retries once", async () => {
    const auth = useAuthStore();
    auth.setAuthConfig(NONE_CONFIG);
    auth.setAuth("expired", USER);
    const client = createApiClient("/api/specs");
    const clientMock = new MockAdapter(client);
    clientMock.onGet("/").replyOnce(401).onGet("/").reply((config) => {
      expect(config.headers.Authorization).toBe("Bearer fresh");
      return [200, ["ok"]];
    });
    globalMock.onPost("/auth/local/session").reply(200, { access_token: "fresh", user: USER });

    const response = await client.get("/");

    expect(response.data).toEqual(["ok"]);
    expect(auth.token).toBe("fresh");
  });

  test("OIDC mode drops the session without retrying", async () => {
    const auth = useAuthStore();
    auth.setAuthConfig(OIDC_CONFIG);
    auth.setAuth("expired", USER);
    const client = createApiClient("/api/specs");
    const clientMock = new MockAdapter(client);
    clientMock.onGet("/").reply(401);

    await expect(client.get("/")).rejects.toThrow();

    expect(auth.isAuthenticated).toBe(false);
    expect(clientMock.history.get).toHaveLength(1);
  });
});
