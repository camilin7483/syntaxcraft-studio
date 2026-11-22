export interface OffsetEdit {
  start: number;
  end: number;
  newText: string;
}

export interface TextPreview {
  edits: readonly OffsetEdit[];
  after: string;
}

export function previewEdits(
  before: string,
  edits: readonly OffsetEdit[],
): TextPreview | undefined {
  const ordered = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  const chunks: string[] = [];
  let previousStart = -1;
  let end = 0;
  for (const edit of ordered) {
    if (
      !Number.isSafeInteger(edit.start) ||
      !Number.isSafeInteger(edit.end) ||
      edit.start < end ||
      edit.start === previousStart ||
      edit.end < edit.start ||
      edit.end > before.length ||
      typeof edit.newText !== 'string'
    ) {
      return undefined;
    }
    chunks.push(before.slice(end, edit.start), edit.newText);
    previousStart = edit.start;
    end = edit.end;
  }
  chunks.push(before.slice(end));
  return { edits: ordered, after: chunks.join('') };
}

export function trailingWhitespaceStart(line: string): number {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) {
    end -= 1;
  }
  return end;
}

export function normalizeNewlines(text: string, eol: '\n' | '\r\n'): string {
  return text.replace(/\r\n|\r|\n/gu, eol);
}
