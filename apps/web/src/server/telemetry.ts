// OpenTelemetry instrumentation stub — replace with real implementation when ready.
// To enable: install packages and set OTEL_EXPORTER_OTLP_ENDPOINT env var
// pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http

/** Initialize OpenTelemetry — currently a no-op stub */
export function initTelemetry(): void {
  // TODO: Replace with real OpenTelemetry SDK initialization
  // Dynamic import approach (when packages are installed):
  //
  // const { NodeSDK } = await import('@opentelemetry/sdk-node')
  // const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
  // const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
  // const { Resource } = await import('@opentelemetry/resources')
  // const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions')
  //
  // const resource = new Resource({ [SEMRESATTRS_SERVICE_NAME]: 'remotty-web', [SEMRESATTRS_SERVICE_VERSION]: '1.0.0' })
  // const sdk = new NodeSDK({ resource, traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }), ... })
  // sdk.start()
  // process.on('SIGTERM', () => sdk.shutdown())
}

export interface Span {
  end(): void
  setStatus(_status: { code: number; message?: string }): void
  recordException(_err: unknown): void
}

function noOpSpan(): Span {
  return { end: () => {}, setStatus: () => {}, recordException: () => {} }
}

export function getTracer() {
  return { startSpan: () => noOpSpan() }
}

export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const span = getTracer().startSpan()
  try {
    return await fn(span)
  } finally {
    span.end()
  }
}
