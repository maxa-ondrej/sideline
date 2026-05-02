import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'docker-entrypoint.d', '15-compute-upstreams.envsh');

type UpstreamEnv = {
  SERVER_SCHEME?: string;
  SERVER_HOST?: string;
  SERVER_PORT?: string;
  WEB_SCHEME?: string;
  WEB_HOST?: string;
  WEB_PORT?: string;
  DOCS_SCHEME?: string;
  DOCS_HOST?: string;
  DOCS_PORT?: string;
};

const sourceScript = (env: UpstreamEnv) => {
  const stdout = execFileSync(
    'sh',
    [
      '-c',
      `. "${SCRIPT}" && printf '%s\\n%s\\n%s\\n' "$SERVER_UPSTREAM" "$WEB_UPSTREAM" "$DOCS_UPSTREAM"`,
    ],
    {
      env: { PATH: process.env.PATH ?? '', ...env },
      encoding: 'utf-8',
    },
  );
  const [server, web, docs] = stdout.trimEnd().split('\n');
  return { server, web, docs };
};

describe('15-compute-upstreams.envsh', () => {
  it('defaults to http and emits scheme://host:port for non-default ports', () => {
    const result = sourceScript({
      SERVER_HOST: 'server',
      SERVER_PORT: '80',
      WEB_HOST: 'web',
      WEB_PORT: '3000',
      DOCS_HOST: 'docs',
      DOCS_PORT: '80',
    });

    expect(result.server).toBe('http://server');
    expect(result.web).toBe('http://web:3000');
    expect(result.docs).toBe('http://docs');
  });

  it('honours *_SCHEME=https and elides :443 for the default https port', () => {
    const result = sourceScript({
      WEB_SCHEME: 'https',
      WEB_HOST: 'web.majksa.net',
      WEB_PORT: '443',
      SERVER_SCHEME: 'https',
      SERVER_HOST: 'server.majksa.net',
      SERVER_PORT: '443',
      DOCS_SCHEME: 'https',
      DOCS_HOST: 'docs.majksa.net',
      DOCS_PORT: '443',
    });

    expect(result.server).toBe('https://server.majksa.net');
    expect(result.web).toBe('https://web.majksa.net');
    expect(result.docs).toBe('https://docs.majksa.net');
  });

  it('keeps non-default https ports in the URL', () => {
    const result = sourceScript({
      WEB_SCHEME: 'https',
      WEB_HOST: 'web.majksa.net',
      WEB_PORT: '8443',
      SERVER_SCHEME: 'http',
      SERVER_HOST: 'server',
      SERVER_PORT: '80',
      DOCS_SCHEME: 'http',
      DOCS_HOST: 'docs',
      DOCS_PORT: '80',
    });

    expect(result.web).toBe('https://web.majksa.net:8443');
    expect(result.server).toBe('http://server');
    expect(result.docs).toBe('http://docs');
  });

  it('elides the port when *_PORT is unset for both http and https', () => {
    const result = sourceScript({
      SERVER_SCHEME: 'http',
      SERVER_HOST: 'server',
      WEB_SCHEME: 'https',
      WEB_HOST: 'web.majksa.net',
      DOCS_SCHEME: 'https',
      DOCS_HOST: 'docs.majksa.net',
    });

    expect(result.server).toBe('http://server');
    expect(result.web).toBe('https://web.majksa.net');
    expect(result.docs).toBe('https://docs.majksa.net');
  });
});
