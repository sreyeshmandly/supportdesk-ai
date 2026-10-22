const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

function chunkText(
  text,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP
) {
  if (typeof text !== 'string') {
    throw new TypeError('Text must be a string');
  }

  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError('Chunk size must be a positive integer');
  }

  if (
    !Number.isInteger(overlap) ||
    overlap < 0 ||
    overlap >= chunkSize
  ) {
    throw new RangeError(
      'Overlap must be a non-negative integer smaller than chunk size'
    );
  }

  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalizedText) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalizedText.length) {
    let end = Math.min(start + chunkSize, normalizedText.length);

    if (end < normalizedText.length) {
      const minimumBoundary = start + Math.floor(chunkSize * 0.6);
      const section = normalizedText.slice(minimumBoundary, end);

      const paragraphBoundary = section.lastIndexOf('\n\n');
      const sentenceBoundary = Math.max(
        section.lastIndexOf('. '),
        section.lastIndexOf('? '),
        section.lastIndexOf('! ')
      );
      const wordBoundary = section.lastIndexOf(' ');

      let boundary = -1;

      if (paragraphBoundary >= 0) {
        boundary = minimumBoundary + paragraphBoundary + 2;
      } else if (sentenceBoundary >= 0) {
        boundary = minimumBoundary + sentenceBoundary + 2;
      } else if (wordBoundary >= 0) {
        boundary = minimumBoundary + wordBoundary + 1;
      }

      if (boundary > start) {
        end = boundary;
      }
    }

    const chunk = normalizedText.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalizedText.length) {
      break;
    }

    const nextStart = Math.max(0, end - overlap);

    if (nextStart <= start) {
      throw new Error('Unable to advance while creating text chunks');
    }

    start = nextStart;
  }

  return chunks;
}

module.exports = { chunkText };
