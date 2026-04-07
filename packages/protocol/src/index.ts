import { z } from 'zod'

export const HostHello = z.object({
  type: z.literal('host.hello'),
  hostName: z.string(),
  token: z.string(),
  version: z.string(),
})

export const SpawnRequest = z.object({
  type: z.literal('session.spawn'),
  sessionId: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()),
  cwd: z.string().optional(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
})

export const StdinChunk = z.object({
  type: z.literal('session.stdin'),
  sessionId: z.string(),
  data: z.string(),
})

export const Resize = z.object({
  type: z.literal('session.resize'),
  sessionId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
})

export const Kill = z.object({
  type: z.literal('session.kill'),
  sessionId: z.string(),
  signal: z.string().default('SIGTERM'),
})

export const StdoutChunk = z.object({
  type: z.literal('session.stdout'),
  sessionId: z.string(),
  data: z.string(),
})

export const SessionExit = z.object({
  type: z.literal('session.exit'),
  sessionId: z.string(),
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
})

export const ServerMessage = z.discriminatedUnion('type', [
  SpawnRequest, StdinChunk, Resize, Kill,
])

export const DaemonMessage = z.discriminatedUnion('type', [
  HostHello, StdoutChunk, SessionExit,
])

export type THostHello = z.infer<typeof HostHello>
export type TSpawnRequest = z.infer<typeof SpawnRequest>
export type TStdinChunk = z.infer<typeof StdinChunk>
export type TResize = z.infer<typeof Resize>
export type TKill = z.infer<typeof Kill>
export type TStdoutChunk = z.infer<typeof StdoutChunk>
export type TSessionExit = z.infer<typeof SessionExit>
export type TServerMessage = z.infer<typeof ServerMessage>
export type TDaemonMessage = z.infer<typeof DaemonMessage>
