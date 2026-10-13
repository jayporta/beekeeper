/**
 * A hand-written slice of Claude Code 2.1.296's plugin API, only what the mod uses.
 * CI's `claude plugin validate` and `claude plugin test` check the mod against the real engine.
 */
declare module 'claude-code' {
  /** An element or text the engine can draw. Elements are opaque: the engine validates them. */
  export type RenderNode = object | string

  /** What an element takes as `children`: a node, a dropped value, or a list of them. */
  export type RenderChildren =
    RenderNode | number | boolean | null | undefined | readonly RenderChildren[]

  /** Props of the layout box. */
  export interface BoxProps {
    /** Which way the box lays its children out. */
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
    /** The box's children. */
    children?: RenderChildren
  }

  /** Props of a run of text. */
  export interface TextProps {
    /** Draws the text dimmed. */
    dimColor?: boolean
    /** The text. */
    children?: RenderChildren
  }

  /** The elements a surface draws with. */
  export interface Elements {
    /** A layout box. */
    Box: (props: BoxProps) => object
    /** A run of text. */
    Text: (props: TextProps) => object
  }

  /** A surface the engine draws on. */
  export type RenderSurface = 'terminal' | 'desktop' | 'mobile' | 'vscode'

  /** The input of `session.start`. */
  export interface SessionStartInput {
    /** The directory the session runs in, absolute. */
    cwd: string
    /** Where the session draws at start; null for a `-p` run or the SDK. */
    surface: RenderSurface | null
    /** Whether a person is at the prompt. */
    isInteractive: boolean
  }

  /** What `session.start` answers: the cwd, echoed by the engine. */
  export interface SessionStartResult {
    /** The session's directory. */
    cwd: string
  }

  /** The input of `command.run`. */
  export interface CommandRunInput {
    /** The command's name without its slash. */
    command: string
    /** Everything after the name, as typed. */
    args: string
  }

  /** What `command.run` answers. */
  export interface CommandRunResult {
    /** The command's output text; the model reads it. */
    text?: string
  }

  /** The input of a `ui.render` for the `Pane` component. */
  export interface PaneRenderInput {
    /** The surface being drawn. */
    surface: RenderSurface
    /** Always `Pane`. */
    component: 'Pane'
    /** The id the pane was opened under. */
    requestId: string
    /** What the surface measured and the pane's state. */
    props: {
      /** The tab label. */
      title: string
      /** Whether the person has given the pane the keyboard. */
      isFocused: boolean
      /** Cells across the body. */
      bodyColumns: number
    }
  }

  /** What `ui.render` answers: the tree to draw. */
  export type RenderResult = object

  /** The engine's version, as `$.session.version()` answers. */
  export interface SessionVersion {
    /** The full version, as `claude --version` prints it. */
    version: string
    /** The release the version is built from; absent when not spelled as a release. */
    base?: string
  }

  /** One entry of a directory listing. */
  export interface FsEntry {
    /** The entry's name. */
    name: string
    /** What the entry is. */
    kind: 'file' | 'dir' | 'other'
    /** Size in bytes. */
    size: number
    /** Modification time, in milliseconds since the epoch. */
    mtimeMs: number
    /** Whether the entry is a symbolic link. */
    isLink: boolean
  }

  /** What `$.fs.stat` answers. */
  export interface FsStat {
    /** What the path leads to. */
    kind: 'file' | 'dir' | 'other'
    /** Size in bytes. */
    size: number
    /** Modification time, in milliseconds since the epoch. */
    mtimeMs: number
    /** Whether the path itself is a symbolic link. */
    isLink: boolean
    /** Where the path lands, absolute; present when asked with `{ resolve: true }`. */
    realPath?: string
  }

  /** Options of `$.process.run`. */
  export interface ProcessRunInit {
    /** Variables set over the inherited environment. */
    env?: Record<string, string>
    /** How long the child may run before it is killed, in milliseconds. */
    timeoutMs?: number
  }

  /** What `$.process.run` resolves with once the child has exited. */
  export interface ProcessRunResult {
    /** The child's exit status. */
    exitCode: number
    /** Standard output as text, capped at 4 MiB. */
    stdout: string
    /** Standard error as text, capped at 4 MiB. */
    stderr: string
    /** Whether `stdout` was cut at the cap. */
    isStdoutTruncated: boolean
    /** Whether `stderr` was cut at the cap. */
    isStderrTruncated: boolean
  }

  /** The argument of `$.process.spawn`. */
  export interface ProcessSpawnRequest {
    /** The command and its arguments, `argv[0]` the executable. */
    argv: readonly string[]
  }

  /** One decoded piece of a spawned child's output. */
  export interface ProcessSpawnChunk {
    /** The pipe the text came from. */
    stream: 'stdout' | 'stderr'
    /** What the child wrote, decoded. */
    text: string
  }

  /** How a spawned child ended. */
  export interface ProcessSpawnResult {
    /** The exit status; null when a signal ended it. */
    code: number | null
    /** The signal that ended it; null when it exited on its own. */
    signal: string | null
  }

  /** The input of `turn.complete`; the mod reads none of it. */
  export type TurnCompleteInput = object

  /** What `turn.complete` answers; the mod passes the engine's answer on. */
  export type TurnCompleteResult = object

  /** The input of `agent.spawn`; the mod reads none of it. */
  export type AgentSpawnInput = object

  /** What `agent.spawn` answers; the mod passes the engine's answer on. */
  export type AgentSpawnResult = object

  /** The input of `session.end`. */
  export interface SessionEndInput {
    /** Why the session ends; `clear` is a `/clear`, which continues under a new session id. */
    reason: string
  }

  /** What `session.end` answers; the mod passes the engine's answer on. */
  export type SessionEndResult = object

  /** A running timer. */
  export interface Timer {
    /** Stops it; a stopped timer never fires again. */
    cancel: () => void
  }

  /** One of the plugin's open panes. */
  export interface UiPane {
    /** The id the pane was opened under. */
    id: string
  }

  /** A typed reference to one of the plugin's `$.state` values. */
  export interface StateRef {
    /** The plugin that owns the value. */
    plugin: string
    /** The value's key in the plugin's contract. */
    key: string
  }

  /** The `$` of a hook: the engine calls the mod uses. */
  export interface Engine {
    /** The session. */
    session: {
      /** The engine's version. */
      version: () => Promise<SessionVersion>
      /** The current session's id. */
      id: () => Promise<string>
      /** The current session's working directory, absolute. */
      root: () => Promise<string>
    }
    /** The time and timers. */
    clock: {
      /** Milliseconds since the epoch, now. */
      now: () => Promise<number>
      /** Calls `fn` once after `ms` milliseconds. */
      after: (ms: number, fn: () => void) => Timer
      /** Calls `fn` every `ms` milliseconds until cancelled. */
      every: (ms: number, fn: () => void) => Timer
    }
    /** The plugin's values the host keeps for the session. */
    state: {
      /** Writes the plugin's own value; refused while a render draws. */
      set: (ref: StateRef, value: object) => Promise<{ isSet: boolean }>
    }
    /** Slash commands. */
    command: {
      /** Adds a slash command. */
      register: (spec: { name: string; description: string }) => Promise<unknown>
    }
    /** Panes and the status line. */
    ui: {
      /** Opens (or retitles) a pane. */
      open: (pane: {
        id: string
        title?: string
        focus?: true
        closeOnEscape?: true
      }) => Promise<{ isPlaced: boolean }>
      /** The elements of the surface a render input names. */
      resolve: (e: { surface: RenderSurface }) => Elements
      /** Lists the plugin's open panes. */
      panes: () => Promise<readonly UiPane[]>
      /** Sets the status line, which stays until replaced; undefined clears it. */
      status: (text: string | undefined) => void
    }
    /** The process environment. */
    env: {
      /** Reads one variable by literal name. */
      get: (name: string) => Promise<string | undefined>
    }
    /** The file system. */
    fs: {
      /** Reads a file's bytes as base64; rejects over 4 MiB. */
      read: (path: string, options: { as: 'bytes' }) => Promise<{ base64: string }>
      /** Lists a directory. */
      list: (path: string) => Promise<FsEntry[]>
      /** Describes a path. */
      stat: (path: string, options?: { resolve: boolean }) => Promise<FsStat>
    }
    /** Child processes. */
    process: {
      /** Runs a child to completion. */
      run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
      /** Starts a child and streams its output. */
      spawn: (request: ProcessSpawnRequest) => AsyncGenerator<ProcessSpawnChunk, ProcessSpawnResult>
    }
  }

  /** The continuation of a hook: the rest of the chain, then the engine's own work. */
  export type Next<I, R> = ((e: I) => Promise<R>) & {
    /** Whether `next` has been called. */
    readonly called: boolean
  }

  /** A hook: the engine, the event's input, and the continuation. */
  export type Hook<I, R> = ($: Engine, e: Readonly<I>, next: Next<I, R>) => R | Promise<R>

  /** What `on(...)` returns. */
  export interface Registration<I, R> {
    /** Sets the handler that runs when the hook throws or overruns its budget. */
    readonly catch: (handler: Hook<I, R>) => void
  }

  /** Adds a hook for an event, optionally narrowed by a matcher. */
  export interface On {
    (
      event: 'session.start',
      hook: Hook<SessionStartInput, SessionStartResult>
    ): Registration<SessionStartInput, SessionStartResult>
    (
      event: 'command.run',
      matcher: { command: string },
      hook: Hook<CommandRunInput, CommandRunResult>
    ): Registration<CommandRunInput, CommandRunResult>
    (
      event: 'turn.complete',
      hook: Hook<TurnCompleteInput, TurnCompleteResult>
    ): Registration<TurnCompleteInput, TurnCompleteResult>
    (
      event: 'agent.spawn',
      hook: Hook<AgentSpawnInput, AgentSpawnResult>
    ): Registration<AgentSpawnInput, AgentSpawnResult>
    (
      event: 'session.end',
      hook: Hook<SessionEndInput, SessionEndResult>
    ): Registration<SessionEndInput, SessionEndResult>
    (
      event: 'ui.render',
      matcher: { component: 'Pane'; requestId: string },
      hook: Hook<PaneRenderInput, RenderResult>
    ): Registration<PaneRenderInput, RenderResult>
  }

  /** The entry point a hooks module exports. */
  export type Register = (on: On, options: Record<string, unknown>) => unknown
}
