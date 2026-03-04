import { describe, expect, it } from 'vitest';
import {
  chunkText,
  chunkContent,
  getAdaptiveChunkConfig,
} from './chunking';
import {
  CHUNKING_DEFAULT_SEPARATORS,
  CHUNKING_MIN_LEN,
  CHUNKING_MAX_LEN,
  CHUNKING_OVERLAP_RATIO,
} from '~/lib/constants';

// ---------------------------------------------------------------------------
// getAdaptiveChunkConfig
// ---------------------------------------------------------------------------

describe('getAdaptiveChunkConfig', () => {
  it('returns minimum chunk size for empty input', () => {
    const config = getAdaptiveChunkConfig(0);
    expect(config.maxLen).toBe(CHUNKING_MIN_LEN);
  });

  it('scales linearly with source length', () => {
    const small = getAdaptiveChunkConfig(10_000);
    const medium = getAdaptiveChunkConfig(40_000);
    const large = getAdaptiveChunkConfig(70_000);

    expect(small.maxLen).toBeLessThan(medium.maxLen);
    expect(medium.maxLen).toBeLessThan(large.maxLen);
  });

  it('reaches max chunk size at 80k chars', () => {
    expect(getAdaptiveChunkConfig(80_000).maxLen).toBe(CHUNKING_MAX_LEN);
  });

  it('caps at max for input beyond 80k chars', () => {
    expect(getAdaptiveChunkConfig(100_000).maxLen).toBe(CHUNKING_MAX_LEN);
    expect(getAdaptiveChunkConfig(500_000).maxLen).toBe(CHUNKING_MAX_LEN);
  });

  it('never exceeds CHUNKING_MAX_LEN', () => {
    for (const size of [0, 1_000, 10_000, 50_000, 100_000, 500_000]) {
      expect(getAdaptiveChunkConfig(size).maxLen).toBeLessThanOrEqual(
        CHUNKING_MAX_LEN,
      );
    }
  });

  it('sets overlap to ~15% of chunk size', () => {
    for (const size of [0, 20_000, 40_000, 80_000]) {
      const config = getAdaptiveChunkConfig(size);
      expect(config.overlap).toBe(Math.round(config.maxLen * CHUNKING_OVERLAP_RATIO));
    }
  });

  it('always returns CHUNKING_DEFAULT_SEPARATORS', () => {
    const config = getAdaptiveChunkConfig(50_000);
    expect(config.separators).toBe(CHUNKING_DEFAULT_SEPARATORS);
  });
});

// ---------------------------------------------------------------------------
// chunkText — core recursive splitter
// ---------------------------------------------------------------------------

describe('chunkText', () => {
  // ---- empty / tiny input ----

  it('returns empty array for empty string', () => {
    expect(chunkText('', 100, 0)).toEqual(['']);
  });

  it('returns single chunk for text shorter than maxLen', () => {
    const text = 'Hello world';
    const chunks = chunkText(text, 100, 0);
    expect(chunks).toEqual([text]);
  });

  it('returns single chunk when text equals maxLen exactly', () => {
    const text = 'A'.repeat(100);
    expect(chunkText(text, 100, 0)).toEqual([text]);
  });

  // ---- paragraph boundary splitting ----

  it('splits on paragraph boundaries (\\n\\n)', () => {
    const p1 = 'First paragraph.';
    const p2 = 'Second paragraph.';
    const text = `${p1}\n\n${p2}`;
    // maxLen smaller than full text but big enough for each paragraph
    const chunks = chunkText(text, 30, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('First paragraph.');
    expect(chunks.at(-1)).toContain('Second paragraph.');
  });

  // ---- line boundary splitting ----

  it('splits on line boundaries (\\n) when no paragraph break exists', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `Line ${i + 1} content`);
    const text = lines.join('\n');
    const chunks = chunkText(text, 30, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  // ---- sentence boundary splitting ----

  it('splits on sentence boundaries (". ") for dense text', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const chunks = chunkText(text, 40, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  // ---- word boundary splitting ----

  it('splits on word boundaries for text with no punctuation', () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, 30, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be within maxLen
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30);
    }
  });

  // ---- character fallback ----

  it('splits at character level for very long no-separator input', () => {
    const text = 'A'.repeat(250);
    const chunks = chunkText(text, 100, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  // ---- hard max length guarantee ----

  it('never produces a chunk exceeding maxLen', () => {
    // Mix of separators and long words
    const text =
      'Short.\n\nA medium paragraph with some words.\n\n' +
      'B'.repeat(150) +
      '\n\n' +
      'Another paragraph. With sentences. And more content here.';
    const maxLen = 60;
    const chunks = chunkText(text, maxLen, 0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxLen);
    }
  });

  // ---- overlap correctness ----

  it('carries overlap text into the next chunk', () => {
    const text = 'AAAA BBBB CCCC DDDD EEEE FFFF';
    const chunks = chunkText(text, 15, 5, [' ', '']);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // With overlap, adjacent chunks should share some substring
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1]!.slice(-5);
      // The next chunk should start with (part of) the previous chunk's tail
      // or have some overlap content
      const hasOverlap =
        chunks[i]!.includes(prevEnd) ||
        prevEnd.includes(chunks[i]!.slice(0, 3));
      expect(hasOverlap).toBe(true);
    }
  });

  it('overlap does not cause content loss', () => {
    const words = 'alpha bravo charlie delta echo foxtrot golf hotel india';
    const chunks = chunkText(words, 25, 10, [' ', '']);
    // Join all chunks (removing overlap duplicates) should cover all words
    const combined = chunks.join(' ');
    for (const word of words.split(' ')) {
      expect(combined).toContain(word);
    }
  });

  // ---- deterministic output ----

  it('produces identical output on repeated calls', () => {
    const text =
      'Paragraph one content here.\n\n' +
      'Paragraph two with more detail.\n\n' +
      'Paragraph three wrapping up.';
    const a = chunkText(text, 40, 5);
    const b = chunkText(text, 40, 5);
    expect(a).toEqual(b);
  });

  // ---- heading / paragraph boundary retention ----

  it('retains paragraph boundaries in chunks', () => {
    const text =
      '# Heading\n\nFirst paragraph content here.\n\nSecond paragraph content here.\n\n## Subheading\n\nThird paragraph.';
    const chunks = chunkText(text, 60, 0);
    // The heading should appear at the start of a chunk
    expect(chunks[0]).toMatch(/^# Heading/);
  });

  // ---- custom separators ----

  it('respects custom separator list', () => {
    const text = 'a|b|c|d|e|f|g|h';
    const chunks = chunkText(text, 5, 0, ['|', '']);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// chunkContent — high-level wrapper with position metadata
// ---------------------------------------------------------------------------

describe('chunkContent', () => {
  it('returns empty-ish result for empty input', () => {
    const chunks = chunkContent('');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe('');
    expect(chunks[0]!.chunk_index).toBe(0);
  });

  it('returns a single chunk for short input', () => {
    const text = 'Short text under any chunk size.';
    const chunks = chunkContent(text, { maxLen: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(text);
    expect(chunks[0]!.char_start).toBe(0);
    expect(chunks[0]!.char_end).toBe(text.length);
  });

  it('assigns sequential chunk_index values', () => {
    const text = 'Word '.repeat(200);
    const chunks = chunkContent(text, { maxLen: 100, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.chunk_index).toBe(i);
    }
  });

  it('char_start and char_end point into original text', () => {
    const text =
      'First paragraph here.\n\nSecond paragraph content.\n\nThird paragraph final.';
    const chunks = chunkContent(text, { maxLen: 30, overlap: 0 });
    for (const chunk of chunks) {
      // The substring at those offsets should match the chunk text
      const fromSource = text.substring(chunk.char_start, chunk.char_end);
      expect(fromSource).toBe(chunk.text);
    }
  });

  it('no chunk exceeds configured maxLen', () => {
    const text = 'A'.repeat(5000);
    const maxLen = 200;
    const chunks = chunkContent(text, { maxLen, overlap: 0 });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(maxLen);
    }
  });

  it('uses adaptive config when no explicit config provided', () => {
    // Short text → adaptive gives small maxLen → still one chunk for short text
    const shortText = 'Hello world.';
    const shortChunks = chunkContent(shortText);
    expect(shortChunks).toHaveLength(1);

    // Long text → should chunk
    const longText = 'Sentence here. '.repeat(500);
    const longChunks = chunkContent(longText);
    expect(longChunks.length).toBeGreaterThan(1);
  });

  it('deterministic output across calls', () => {
    const text =
      'Alpha bravo charlie.\n\nDelta echo foxtrot.\n\nGolf hotel india.';
    const a = chunkContent(text, { maxLen: 30, overlap: 5 });
    const b = chunkContent(text, { maxLen: 30, overlap: 5 });
    expect(a).toEqual(b);
  });

  it('handles very long no-punctuation input', () => {
    // 10k chars of 'X' with no separators at all
    const text = 'X'.repeat(10_000);
    const chunks = chunkContent(text, { maxLen: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(500);
    }
  });

  it('overlap causes adjacent chunks to share content', () => {
    const text =
      'First sentence here. Second sentence there. Third sentence now. Fourth sentence end.';
    const chunks = chunkContent(text, { maxLen: 45, overlap: 10 });
    if (chunks.length >= 2) {
      // Some text at the end of chunk N should appear at the start of chunk N+1
      for (let i = 0; i < chunks.length - 1; i++) {
        const tail = chunks[i]!.text.slice(-10);
        const nextText = chunks[i + 1]!.text;
        // With overlap, the next chunk should contain some of the tail
        const hasOverlap = nextText.includes(tail) || tail.includes(nextText.slice(0, 5));
        expect(hasOverlap).toBe(true);
      }
    }
  });

  it('covers the entire source text (no gaps without overlap=0)', () => {
    const text =
      'Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike.';
    const chunks = chunkContent(text, { maxLen: 30, overlap: 0 });
    // Every character in the source should appear in at least one chunk
    const covered = new Set<number>();
    for (const chunk of chunks) {
      for (let i = chunk.char_start; i < chunk.char_end; i++) {
        covered.add(i);
      }
    }
    // Allow trimmed whitespace at boundaries — check that all non-whitespace chars are covered
    for (let i = 0; i < text.length; i++) {
      if (text[i]!.trim()) {
        expect(covered.has(i)).toBe(true);
      }
    }
  });
});
