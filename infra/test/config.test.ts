import { getConfig } from '../lib/config';

describe('getConfig', () => {
  test("prod resolves to fastspec.kaseovo.com with frontend deployment", () => {
    const config = getConfig('prod');
    expect(config.env).toBe('prod');
    expect(config.domain).toBe('fastspec.kaseovo.com');
    expect(config.deployFrontend).toBe(true);
    expect(config.awsEndpoint).toBeUndefined();
  });

  test("local targets localhost with no frontend deployment and floci endpoint", () => {
    const config = getConfig('local');
    expect(config.env).toBe('local');
    expect(config.domain).toBe('localhost');
    expect(config.deployFrontend).toBe(false);
    expect(config.awsEndpoint).toBe('http://localhost:4566');
  });

  test("dev resolves to dev.fastspec.kaseovo.com with frontend deployment", () => {
    const config = getConfig('dev');
    expect(config.env).toBe('dev');
    expect(config.domain).toBe('dev.fastspec.kaseovo.com');
    expect(config.deployFrontend).toBe(true);
    expect(config.awsEndpoint).toBeUndefined();
  });

  test("staging resolves to staging.fastspec.kaseovo.com with frontend deployment", () => {
    const config = getConfig('staging');
    expect(config.env).toBe('staging');
    expect(config.domain).toBe('staging.fastspec.kaseovo.com');
    expect(config.deployFrontend).toBe(true);
    expect(config.awsEndpoint).toBeUndefined();
  });

  test("unknown env value throws a descriptive error", () => {
    expect(() => getConfig('noop' as any)).toThrow(/Unknown deployment environment/);
  });
});
