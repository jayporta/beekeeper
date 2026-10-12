/** Globals of the engine's module environment that ES2023 does not declare. */

/** The element factory the engine's JSX compiles to. */
declare function h(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): object

/** The fragment marker of the engine's JSX. */
declare const Fragment: unique symbol

declare namespace h {
  /** JSX typing: any element the factory builds is an opaque object. */
  namespace JSX {
    type Element = object
    interface IntrinsicElements {}
    interface ElementChildrenAttribute {
      children: unknown
    }
  }
}

interface Uint8ArrayConstructor {
  /** Decodes a base64 string into bytes. */
  fromBase64(base64: string): Uint8Array
}

declare class TextEncoder {
  /** Encodes text as UTF-8. */
  encode(input?: string): Uint8Array
}

declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean })
  /** Decodes UTF-8 bytes. */
  decode(input?: Uint8Array, options?: { stream?: boolean }): string
}

declare const console: {
  /** Writes a message to the debug log. */
  log(...data: unknown[]): void
  /** Writes a warning to the debug log. */
  warn(...data: unknown[]): void
  /** Writes an error to the debug log. */
  error(...data: unknown[]): void
}

declare const performance: {
  /** Milliseconds from an arbitrary origin, monotonic. */
  now(): number
}

declare function setTimeout(callback: () => void, ms?: number): unknown
declare function clearTimeout(handle: unknown): void
