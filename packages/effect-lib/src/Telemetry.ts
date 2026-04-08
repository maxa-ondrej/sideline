import { Otlp } from '@effect/opentelemetry';
import { NodeHttpClient } from '@effect/platform-node';
import { Layer } from 'effect';

export const makeTelemetryLayer = (options: {
  readonly endpoint: string;
  readonly serviceName: string;
  readonly environment: string;
  readonly origin: string;
}): Layer.Layer<never> =>
  Otlp.layerJson({
    baseUrl: options.endpoint,
    resource: {
      serviceName: options.serviceName,
      attributes: {
        'deployment.environment': options.environment,
        'service.origin': options.origin,
      },
    },
  }).pipe(Layer.provide(NodeHttpClient.layerUndici));
