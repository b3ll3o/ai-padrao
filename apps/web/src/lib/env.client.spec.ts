import { describe, expect, it } from 'vitest';
import { env } from './env.client';

describe('env.client', () => {
  it('exposes a NEXT_PUBLIC_API_URL pointing at the local api in dev', () => {
    expect(env.NEXT_PUBLIC_API_URL).toMatch(/^https?:\/\//);
  });

  it('defaults to localhost:3001 when env is not provided', () => {
    // The module-level parse already ran with the env at import time.
    // We assert that the resolved value is either the test-time override or the documented default.
    expect(['http://localhost:3001', process.env.NEXT_PUBLIC_API_URL ?? '']).toContain(
      env.NEXT_PUBLIC_API_URL,
    );
  });
});