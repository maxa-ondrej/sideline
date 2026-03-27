import { Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { Telemetry } from '../src/index.js';

describe('makeTelemetryLayer', () => {
  it('returns a non-empty layer when endpoint is provided', () => {
    const result = Telemetry.makeTelemetryLayer({
      endpoint: 'http://otel-collector:4318',
      serviceName: 'sideline-server',
      environment: 'production',
      origin: 'example.com',
    });
    expect(result).not.toBe(Layer.empty);
  });

  it('returns a layer for any valid endpoint and service name', () => {
    const result = Telemetry.makeTelemetryLayer({
      endpoint: 'https://otelcollectorhttp-ccogw4cogg00wwowc0s4c0cs.majksa.net/',
      serviceName: 'sideline-bot',
      environment: 'preview',
      origin: 'sideline-preview.majksa.net',
    });
    expect(result).not.toBe(Layer.empty);
  });
});
