import type { SongDraft } from "./models";

type LegacySongSheetLike = {
  songSheet?: string;
  lyrics?: string;
  chords?: string;
};

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
  songLike: Pick<SongDraft, "songSheet"> & LegacySongSheetLike,
): string | undefined {
  const songSheet = normalizeMultilineText(songLike.songSheet);

  if (songSheet) {
    return songSheet || undefined;
  }

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
