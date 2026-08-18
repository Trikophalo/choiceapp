/** Progressive enhancement: Android fires, iOS Safari silently ignores. */
export function tapFeedback(pattern: number | number[] = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Some browsers throw when the page is not visible; never a real error.
    }
  }
}
