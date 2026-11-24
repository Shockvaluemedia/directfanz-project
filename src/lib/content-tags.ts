/**
 * content.tags is a string column. Most writers store a JSON array, but rows
 * made by /api/content/create before Nov 2026 hold a comma-separated list (or
 * an empty string), which JSON.parse rejects. Readers use this instead so one
 * odd row can't fail the whole response.
 */
export function parseStoredTags(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    // Fall through to the comma-separated form.
  }
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}
