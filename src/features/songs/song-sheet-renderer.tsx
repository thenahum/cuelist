import type { SongDraft } from "../../domain/models";

export type SongSheetPresentation = "standard" | "perform";
export type SongSheetScale = "standard" | "large" | "xlarge";

interface SongSheetRendererProps {
  content?: string;
  showChords?: boolean;
  presentation?: SongSheetPresentation;
  scale?: SongSheetScale;
  emptyMessage?: string;
  className?: string;
}

type ParsedSongSheetLine =
  | { type: "blank" }
  | { type: "directive"; label: string }
  | { type: "content"; chordLine: string; lyricLine: string };

function normalizeMultilineText(value?: string): string {
  return value?.replace(/\r\n/g, "\n").trimEnd() ?? "";
}

function stripChordMarkup(line: string): string {
  return line.replace(/\[([^\]]+)\]/g, "");
}

function mergeChordAndLyricLine(chordLine: string, lyricLine: string): string {
  const normalizedChordLine = chordLine.trimEnd();
  const normalizedLyricLine = lyricLine.trimEnd();

  if (!normalizedChordLine) {
    return normalizedLyricLine;
  }

  if (!normalizedLyricLine) {
    return normalizedChordLine;
  }

  if (!normalizedChordLine.includes("[") || !normalizedChordLine.includes("]")) {
    return normalizedChordLine.length >= normalizedLyricLine.length
      ? normalizedChordLine
      : normalizedLyricLine;
  }

  const strippedChordLine = stripChordMarkup(normalizedChordLine);

  if (strippedChordLine === normalizedLyricLine) {
    return normalizedChordLine;
  }

  if (normalizedLyricLine.startsWith(strippedChordLine)) {
    return normalizedChordLine + normalizedLyricLine.slice(strippedChordLine.length);
  }

  return normalizedChordLine;
}

function mergeSongSheetContent(chords: string, lyrics: string): string {
  const chordLines = chords.split("\n");
  const lyricLines = lyrics.split("\n");
  const totalLines = Math.max(chordLines.length, lyricLines.length);
  const mergedLines: string[] = [];

  for (let index = 0; index < totalLines; index += 1) {
    const chordLine = chordLines[index] ?? "";
    const lyricLine = lyricLines[index] ?? "";

    if (chordLine && lyricLine) {
      mergedLines.push(mergeChordAndLyricLine(chordLine, lyricLine));
      continue;
    }

    mergedLines.push(chordLine || lyricLine);
  }

  return mergedLines.join("\n").trimEnd();
}

export function getSongSheetContent(
  songLike: Pick<SongDraft, "lyrics" | "chords">,
): string | undefined {
  const chords = normalizeMultilineText(songLike.chords);
  const lyrics = normalizeMultilineText(songLike.lyrics);

  if (chords && lyrics) {
    return mergeSongSheetContent(chords, lyrics) || undefined;
  }

  return chords || lyrics || undefined;
}

export function extractLyricsFromSongSheet(content: string): string {
  return normalizeMultilineText(content)
    .split("\n")
    .map((line) => {
      const directiveMatch = line.match(/^\{([^:}]+)(?::\s*(.*))?\}$/);

      if (directiveMatch) {
        return "";
      }

      if (line.trim().startsWith("#")) {
        return "";
      }

      return stripChordMarkup(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDirectiveLabel(name: string, value: string): string | null {
  switch (name) {
    case "comment":
    case "c":
      return value || "Comment";
    case "title":
    case "t":
      return value || "Title";
    case "subtitle":
    case "st":
      return value || "Subtitle";
    case "soc":
    case "start_of_chorus":
      return value || "Chorus";
    case "eoc":
    case "end_of_chorus":
      return null;
    default:
      return value || name.replace(/_/g, " ");
  }
}

function buildAlignedLine(line: string): ParsedSongSheetLine {
  const directiveMatch = line.match(/^\{([^:}]+)(?::\s*(.*))?\}$/);

  if (directiveMatch) {
    const label = formatDirectiveLabel(
      directiveMatch[1].trim().toLowerCase(),
      (directiveMatch[2] ?? "").trim(),
    );

    return label ? { type: "directive", label } : { type: "blank" };
  }

  if (line.trim().startsWith("#")) {
    return { type: "directive", label: line.trim().replace(/^#+\s*/, "") };
  }

  const tokens: Array<{ type: "text" | "chord"; value: string }> = [];
  const chordPattern = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match = chordPattern.exec(line);

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: line.slice(lastIndex, match.index),
      });
    }

    tokens.push({
      type: "chord",
      value: match[1],
    });

    lastIndex = chordPattern.lastIndex;
    match = chordPattern.exec(line);
  }

  if (lastIndex < line.length) {
    tokens.push({
      type: "text",
      value: line.slice(lastIndex),
    });
  }

  if (tokens.length === 0) {
    return { type: "content", chordLine: "", lyricLine: line };
  }

  let lyricLine = "";
  let chordLine = "";
  let pendingChords: string[] = [];

  for (const token of tokens) {
    if (token.type === "chord") {
      pendingChords.push(token.value);
      continue;
    }

    if (pendingChords.length > 0) {
      const chordText = pendingChords.join(" ");
      const position = lyricLine.length;

      if (chordLine.length < position) {
        chordLine += " ".repeat(position - chordLine.length);
      } else if (chordLine.length > position) {
        chordLine += " ";
      }

      chordLine += chordText;
      pendingChords = [];
    }

    lyricLine += token.value;
  }

  if (pendingChords.length > 0) {
    const chordText = pendingChords.join(" ");
    const position = lyricLine.length;

    if (chordLine.length < position) {
      chordLine += " ".repeat(position - chordLine.length);
    } else if (chordLine.length > position) {
      chordLine += " ";
    }

    chordLine += chordText;
  }

  return {
    type: "content",
    chordLine: chordLine.trimEnd(),
    lyricLine: lyricLine || stripChordMarkup(line),
  };
}

function parseSongSheet(content?: string): ParsedSongSheetLine[] {
  const normalizedContent = normalizeMultilineText(content);

  if (!normalizedContent) {
    return [];
  }

  return normalizedContent.split("\n").map((line) => {
    if (!line.trim()) {
      return { type: "blank" } satisfies ParsedSongSheetLine;
    }

    return buildAlignedLine(line);
  });
}

export function SongSheetRenderer({
  content,
  showChords = true,
  presentation = "standard",
  scale = "standard",
  emptyMessage = "No song sheet saved yet.",
  className,
}: SongSheetRendererProps) {
  const parsedLines = parseSongSheet(content);

  if (parsedLines.length === 0) {
    return (
      <div className="cu-song-sheet-empty">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={[
        "cu-song-sheet",
        presentation === "perform" ? "cu-song-sheet-perform" : "",
        scale === "large" ? "cu-song-sheet-large" : "",
        scale === "xlarge" ? "cu-song-sheet-xlarge" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {parsedLines.map((line, index) => {
        if (line.type === "blank") {
          return <div key={`line-${index}`} className="cu-song-sheet-spacer" />;
        }

        if (line.type === "directive") {
          return (
            <p key={`line-${index}`} className="cu-song-sheet-directive">
              {line.label}
            </p>
          );
        }

        return (
          <div key={`line-${index}`} className="cu-song-sheet-line">
            {showChords && line.chordLine ? (
              <pre className="cu-song-sheet-chords">{line.chordLine}</pre>
            ) : null}
            <pre className="cu-song-sheet-lyrics">{line.lyricLine}</pre>
          </div>
        );
      })}
    </div>
  );
}
