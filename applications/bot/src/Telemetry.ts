import { Otlp } from '@effect/opentelemetry';
import { NodeHttpClient } from '@effect/platform-node';
import { Layer } from 'effect';

export const makeTelemetryLayer = (options: {
  readonly endpoint: string;
  readonly serviceName: string;
}): Layer.Layer<never> =>
  Otlp.layer({
    baseUrl: options.endpoint,
    resource: { serviceName: options.serviceName },
  }).pipe(Layer.provide(NodeHttpClient.layerUndici));
