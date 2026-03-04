/**
 * Recursive boundary-aware content chunker.
 *
 * Ported from milkpod's `chunkSegmentText` with adaptations for
 * article/web content (CHUNK-2, CHUNK-3 from prd.md).
 */

import {
  CHUNKING_DEFAULT_MAX_LEN,
  CHUNKING_DEFAULT_OVERLAP,
  CHUNKING_DEFAULT_SEPARATORS,
} from '~/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkConfig {
  /** Maximum characters per chunk. */
  maxLen: number;
  /** Number of overlap characters carried into the next chunk. */
  overlap: number;
  /** Ordered separator list (coarsest → finest). Must end with ''. */
  separators: string[];
}

export interface ContentChunk {
  /** Zero-based index of this chunk. */
  chunk_index: number;
  /** Character offset where this chunk starts in the source text. */
  char_start: number;
  /** Character offset where this chunk ends (exclusive) in the source text. */
  char_end: number;
  /** The chunk text. */
  text: string;
}

// ---------------------------------------------------------------------------
// Core recursive splitter
// ---------------------------------------------------------------------------

/**
 * Recursively splits `text` using the first separator that appears in the
 * text, falling back to finer separators when a fragment still exceeds
 * `maxLen`. The separator list **must** end with `''` (character-level
 * fallback) to guarantee every chunk fits within `maxLen`.
 */
export function chunkText(
  text: string,
  maxLen: number = CHUNKING_DEFAULT_MAX_LEN,
  overlap: number = CHUNKING_DEFAULT_OVERLAP,
  separators: string[] = CHUNKING_DEFAULT_SEPARATORS,
): string[] {
  if (text.length <= maxLen) return [text];

  // Find the coarsest separator that exists in this text.
  // The list ends with '' which always matches.
  const sep = separators.find((s) => (s === '' ? true : text.includes(s))) ?? '';
  const remaining = separators.slice(separators.indexOf(sep) + 1);

  // Split on the chosen separator, re-attaching it to each fragment
  // so we don't lose paragraph/sentence boundaries.
  const splits =
    sep === ''
      ? [...text]
      : text
          .split(sep)
          .flatMap((part, i, arr) =>
            i < arr.length - 1 ? [part + sep] : [part],
          );

  const chunks: string[] = [];
  let current = '';

  for (const piece of splits) {
    if (current.length + piece.length > maxLen && current.length > 0) {
      // If accumulated text still exceeds maxLen, recurse with finer seps.
      if (current.length > maxLen && remaining.length > 0) {
        chunks.push(
          ...chunkText(current.trim(), maxLen, overlap, remaining),
        );
      } else {
        chunks.push(current.trim());
      }

      // Carry overlap into the next chunk.
      if (overlap > 0 && current.length > overlap) {
        current = current.slice(-overlap);
      } else {
        current = '';
      }
    }
    current += piece;
  }

  // Flush remainder.
  if (current.trim().length > 0) {
    if (current.length > maxLen && remaining.length > 0) {
      chunks.push(
        ...chunkText(current.trim(), maxLen, overlap, remaining),
      );
    } else {
      chunks.push(current.trim());
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// High-level wrapper with position metadata
// ---------------------------------------------------------------------------

/**
 * Chunks source text and annotates each chunk with character offsets
 * relative to the original input.
 */
export function chunkContent(
  text: string,
  config?: Partial<ChunkConfig>,
): ContentChunk[] {
  const maxLen = config?.maxLen ?? CHUNKING_DEFAULT_MAX_LEN;
  const overlap = config?.overlap ?? CHUNKING_DEFAULT_OVERLAP;
  const separators = config?.separators ?? CHUNKING_DEFAULT_SEPARATORS;

  const rawChunks = chunkText(text, maxLen, overlap, separators);

  const result: ContentChunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const pos = text.indexOf(chunk, searchFrom);
    const charStart = pos >= 0 ? pos : searchFrom;
    const charEnd = charStart + chunk.length;

    result.push({
      chunk_index: i,
      char_start: charStart,
      char_end: charEnd,
      text: chunk,
    });

    // Advance past the start of this chunk to handle overlap correctly.
    if (pos >= 0) searchFrom = pos + 1;
  }

  return result;
}
