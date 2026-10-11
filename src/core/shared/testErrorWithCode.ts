/**
 * Builds an error with a `code` property and a message that holds an absolute
 * path, like a Node or Chromium failure, so tests can check the message never
 * reaches a log line or a result.
 *
 * @param code - The value for the error's `code`.
 * @returns An `Error` carrying that code.
 */
export function errorWithCode(code: string): Error {
  return Object.assign(new Error('failed loading file:///Users/someone/app/index.html'), { code })
}
