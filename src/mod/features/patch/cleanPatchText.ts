import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'

/**
 * Cleans repository-controlled patch text for the engine: each line has its control characters,
 * tabs, carriage returns and lone surrogates turned into spaces, and only the newlines survive,
 * since `Code` refuses any other control character.
 *
 * @param text - A file's patch.
 * @returns The cleaned text, with the same lines.
 */
export function cleanPatchText(text: string): string {
  return text
    .split('\n')
    .map((line) => replaceUnprintable(line))
    .join('\n')
}
