/** What the mod's logic may ask of the engine. `register.ts` builds one from `$` and is the only place that touches `$`. */
export interface ModHost {
  /** The engine's version: `$.session.version()`. */
  version(): Promise<{ readonly version: string; readonly base?: string }>
}
