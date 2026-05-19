
/**
 * Splits a pedagogical message into sections based on the 15-block structure.
 */
export function splitPedagogicalSections(markdown: string): string[] {
  if (!markdown) return [];

  // Match headers like "1. 🎯 Missão Clínica" or "1. Missão Clínica"
  // The regex looks for a number followed by a dot at the start of a line or after a newline.
  const sectionRegex = /\n?\d+\.\s+[\uD800-\uDBFF\uDC00-\uDFFF\w\s]+:/g;
  
  // Actually, the headers in the prompt are like "1. 🎯 Missão Clínica:"
  // But they might not have the colon.
  
  const sections: string[] = [];
  let lastIndex = 0;
  
  // We want to find the positions of the headers
  const headerPositions: number[] = [];
  const headerRegex = /(?:^|\n)\d+\.\s+[\u2000-\u32FF\uD83C-\uD83E\uDC00-\uDFFF]?\s*[^:\n]+:?/g;
  
  let match;
  while ((match = headerRegex.exec(markdown)) !== null) {
    headerPositions.push(match.index);
  }
  
  if (headerPositions.length === 0) {
    return [markdown];
  }
  
  // Split the text based on header positions
  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i];
    const end = i < headerPositions.length - 1 ? headerPositions[i + 1] : markdown.length;
    sections.push(markdown.slice(start, end).trim());
  }
  
  // If there's content before the first header, add it as a section
  if (headerPositions[0] > 0) {
    const intro = markdown.slice(0, headerPositions[0]).trim();
    if (intro) {
      sections.unshift(intro);
    }
  }
  
  return sections;
}
