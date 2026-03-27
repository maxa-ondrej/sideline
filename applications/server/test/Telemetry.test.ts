import { Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTelemetryLayer } from '~/Telemetry.js';

describe('makeTelemetryLayer', () => {
  it('returns Layer.empty when endpoint is empty string', () => {
    const result = makeTelemetryLayer({ endpoint: '', serviceName: 'sideline-server' });
    expect(result).toBe(Layer.empty);
  });

  it('returns a non-empty layer when endpoint is provided', () => {
    const result = makeTelemetryLayer({
      endpoint: 'http://otel-collector:4318',
      serviceName: 'sideline-server',
    });
    expect(result).not.toBe(Layer.empty);
  });

  it('returns Layer.empty regardless of serviceName when endpoint is empty', () => {
    const result = makeTelemetryLayer({ endpoint: '', serviceName: 'any-service' });
    expect(result).toBe(Layer.empty);
  });
});
