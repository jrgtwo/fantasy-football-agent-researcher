// Crudely turn an HTML page into readable text for an LLM: drop script/style blocks, strip tags,
// collapse whitespace, and cap length (context budget). Generic — any research tool wants this, so
// it lives under tools/generic/ (a promotion candidate, kept FF-free).
export function extractText(html: string, maxChars: number): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, maxChars);
}
