// Kept separate from email.ts so it can be imported (and tested) without
// pulling in the Resend client, which is constructed at module load.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape first, then convert newlines — doing it the other way round would
 * escape the `<br />` tags we just inserted.
 *
 * The reminder text is written by a user and mailed only to that same user, so
 * this is not really an XSS boundary. It is here for correctness: an `&` or a
 * `<` in an ordinary Lithuanian sentence must not corrupt the message.
 */
export function escapeHtmlWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}
