/**
 * Non-destructive bounded section surgery for Life OS daily notes.
 * Preserves YAML frontmatter, CRLF/LF endings, user reflections, and code fences.
 */
export function replaceBoundedSection(markdown: string, headingName: string, newBodyLines: string[]): string {
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const targetHeader = `## ${headingName}`;

  let inFence = false;
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (startIdx === -1) {
      if (line.trim() === targetHeader) {
        startIdx = i;
      }
    } else if (/^##\s+/.test(line)) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    const trimmed = markdown.trimEnd();
    return `${trimmed}${eol}${eol}${targetHeader}${eol}${newBodyLines.join(eol)}${eol}`;
  }

  const before = lines.slice(0, startIdx + 1);
  const after = lines.slice(endIdx);
  const merged = [...before, ...newBodyLines, "", ...after];
  return merged.join(eol);
}
