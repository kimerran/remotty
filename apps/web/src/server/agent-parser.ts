/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */
import type { ParsedEventKind } from '@prisma/client'

export interface ToolCallData {
  tool: string
  args: Record<string, string>
  duration?: number
}

export interface FileEditData {
  path: string
  action: 'create' | 'edit' | 'delete'
  linesAdded?: number
  linesRemoved?: number
}

export interface ErrorData {
  message: string
  type: 'runtime' | 'compile' | 'test' | 'unknown'
  line?: number
}

export interface TestResultData {
  passed: number
  failed: number
  total: number
  duration?: number
}

export interface TokenUsageData {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUSD?: number
}

export interface CommandData {
  command: string
  exitCode?: number
  duration?: number
}

export type ParsedEventData =
  | ToolCallData
  | FileEditData
  | ErrorData
  | TestResultData
  | TokenUsageData
  | CommandData

export interface ParsedEvent {
  kind: ParsedEventKind
  data: ParsedEventData
  ts: Date
}

/**
 * Parse a line of Claude Code PTY output and extract structured events.
 * Claude Code outputs structured text with markers like [TOOL_CALL], [ERROR], etc.
 */
export function parseClaudeCodeLine(line: string, ts: Date): ParsedEvent | null {
  // Tool call patterns
  // e.g. [TOOL_CALL] bash: {"command": "npm test"}
  const toolCallMatch = line.match(/^\[TOOL_CALL\]\s+(\w+):\s*(.*)$/)
  if (toolCallMatch) {
    const tool = toolCallMatch[1]!.toLowerCase()
    let args: Record<string, string>
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args = JSON.parse(toolCallMatch[2]!) as any
    } catch {
      args = { raw: toolCallMatch[2]! }
    }
    return { kind: 'TOOL_CALL', data: { tool, args }, ts }
  }

  // Error patterns
  // e.g. [ERROR] TypeError: Cannot read property 'x' of undefined
  const errorMatch = line.match(/^\[ERROR\]\s+(.+)$/)
  if (errorMatch) {
    const message = errorMatch[1]!
    const type = detectErrorType(message)
    return { kind: 'ERROR', data: { message, type }, ts }
  }

  // File edit patterns
  // e.g. [FILE_EDIT] src/app.ts (created, +45 -3)
  // e.g. [FILE_EDIT] src/app.ts (edited, +12 -5)
  // e.g. [FILE_EDIT] src/app.ts (deleted)
  const fileEditMatch = line.match(/^\[FILE_EDIT\]\s+(\S+)\s+\(([^)]+)\)$/)
  if (fileEditMatch) {
    const path = fileEditMatch[1]!
    const actionStr = fileEditMatch[2]!
    const [actionPart, diffPart] = actionStr.split(',')
    const action = detectAction(actionPart.trim())
    const linesAdded = diffPart ? extractAddedLines(diffPart) : undefined
    const linesRemoved = diffPart ? extractRemovedLines(diffPart) : undefined
    return { kind: 'FILE_EDIT', data: { path, action, linesAdded, linesRemoved }, ts }
  }

  // Test result patterns
  // e.g. [TEST_RESULT] 5 passed, 2 failed (3.2s)
  // e.g. [TEST_RESULT] All tests passed (1.5s)
  const testMatch = line.match(/^\[TEST_RESULT\]\s+(.+)$/)
  if (testMatch) {
    const result = testMatch[1]!
    const parsed = parseTestResult(result)
    if (parsed) return { kind: 'TEST_RESULT', data: parsed, ts }
  }

  // Token usage patterns
  // e.g. [TOKEN_USAGE] input=1500 output=3200 total=4700 cost=$0.12
  const tokenMatch = line.match(/^\[TOKEN_USAGE\]\s+(.+)$/)
  if (tokenMatch) {
    const parsed = parseTokenUsage(tokenMatch[1]!)
    if (parsed) return { kind: 'TOKEN_USAGE', data: parsed, ts }
  }

  // Command exit patterns (from bash output)
  // e.g. Command exited with code 1
  const cmdExitMatch = line.match(/^Command exited with code (\d+)$/)
  if (cmdExitMatch) {
    const exitCode = parseInt(cmdExitMatch[1]!, 10)
    return { kind: 'COMMAND', data: { command: '', exitCode }, ts }
  }

  return null
}

function detectErrorType(message: string): 'runtime' | 'compile' | 'test' | 'unknown' {
  const lower = message.toLowerCase()
  if (lower.includes('syntaxerror') || lower.includes('parseerror')) return 'compile'
  if (lower.includes('fail') || lower.includes('test') || lower.includes('expect')) return 'test'
  if (lower.includes('error') || lower.includes('exception')) return 'runtime'
  return 'unknown'
}

function detectAction(actionStr: string): 'create' | 'edit' | 'delete' {
  const lower = actionStr.toLowerCase()
  if (lower.includes('delete') || lower.includes('remove')) return 'delete'
  if (lower.includes('create') || lower.includes('new')) return 'create'
  return 'edit'
}

function extractAddedLines(diff: string): number {
  const match = diff.match(/\+(\d+)/)
  return match ? parseInt(match[1]!, 10) : 0
}

function extractRemovedLines(diff: string): number {
  const match = diff.match(/-(\d+)/)
  return match ? parseInt(match[1]!, 10) : 0
}

function parseTestResult(text: string): TestResultData | null {
  // "All tests passed (1.5s)"
  const allPassed = text.match(/all tests passed\s*\(?([\d.]+)s?\)?/i)
  if (allPassed) {
    return { passed: 0, failed: 0, total: 0, duration: parseFloat(allPassed[1]!) * 1000 }
  }

  // "5 passed, 2 failed (3.2s)"
  // "5 passed, 1 failed"
  const match = text.match(/(\d+)\s*passed,?\s*(\d+)\s*failed/i)
  if (match) {
    const passed = parseInt(match[1]!, 10)
    const failed = parseInt(match[2]!, 10)
    const durationMatch = text.match(/\(([\d.]+)s\)/)
    return {
      passed,
      failed,
      total: passed + failed,
      duration: durationMatch ? parseFloat(durationMatch[1]!) * 1000 : undefined,
    }
  }

  // "N passed" only
  const passedOnly = text.match(/(\d+)\s*passed/i)
  if (passedOnly) {
    const passed = parseInt(passedOnly[1]!, 10)
    return { passed, failed: 0, total: passed }
  }

  return null
}

function parseTokenUsage(text: string): TokenUsageData | null {
  const inputMatch = text.match(/input=(\d+)/i)
  const outputMatch = text.match(/output=(\d+)/i)
  const totalMatch = text.match(/total=(\d+)/i)
  const costMatch = text.match(/cost=\$?([\d.]+)/i)

  if (!inputMatch && !outputMatch && !totalMatch) return null

  const inputTokens = inputMatch ? parseInt(inputMatch[1]!, 10) : 0
  const outputTokens = outputMatch ? parseInt(outputMatch[1]!, 10) : 0
  const totalTokens = totalMatch ? parseInt(totalMatch[1]!, 10) : inputTokens + outputTokens
  const costUSD = costMatch ? parseFloat(costMatch[1]!) : undefined

  return { inputTokens, outputTokens, totalTokens, costUSD }
}

/**
 * Generate a summary string from parsed events.
 * e.g. "edited 3 files, ran tests: 2 failed"
 */
export function generateSummary(events: ParsedEvent[]): string {
  let fileEdits = 0
  let filesCreated = 0
  let filesDeleted = 0
  let errorCount = 0
  let testPassed = 0
  let testFailed = 0

  for (const event of events) {
    switch (event.kind) {
      case 'FILE_EDIT': {
        fileEdits++
        const d = event.data as FileEditData
        if (d.action === 'create') filesCreated++
        else if (d.action === 'delete') filesDeleted++
        break
      }
      case 'ERROR':
        errorCount++
        break
      case 'TEST_RESULT': {
        const d = event.data as TestResultData
        testPassed += d.passed
        testFailed += d.failed
        break
      }
    }
  }

  if (errorCount > 0) {
    const errWord = errorCount !== 1 ? 'errors' : 'error'
    return `${errorCount} ${errWord} encountered`
  }

  const parts: string[] = []
  if (filesCreated > 0) parts.push(`created ${String(filesCreated)} file${filesCreated !== 1 ? 's' : ''}`)
  const editedCount = fileEdits - filesCreated - filesDeleted
  if (editedCount > 0) parts.push(`edited ${String(editedCount)} file${editedCount !== 1 ? 's' : ''}`)
  if (filesDeleted > 0) parts.push(`deleted ${String(filesDeleted)} file${filesDeleted !== 1 ? 's' : ''}`)
  if (testFailed > 0) parts.push(`ran tests: ${String(testFailed)} failed`)
  else if (testPassed > 0) parts.push(`ran ${String(testPassed)} tests: all passed`)

  return parts.length > 0 ? parts.join(', ') : 'No significant actions'
}
