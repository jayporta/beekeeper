/**
 * A view without its time, so a refresh that found nothing new can be told from one that did.
 *
 * @param view - A pane or Browse view.
 * @returns The key to compare with the last stored view's.
 */
export function contentKey(view: { readonly refreshedAtMs: number }): string {
  return JSON.stringify({ ...view, refreshedAtMs: 0 })
}
