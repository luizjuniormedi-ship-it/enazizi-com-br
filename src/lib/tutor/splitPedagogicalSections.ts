
/**
 * Splits a pedagogical message into sections based on the 15-block structure.
 * Handles both numbered sections and emoji-prefixed sections.
 */
export function splitPedagogicalSections(markdown: string): string[] {
  if (!markdown) return [];

  const sections: string[] = [];
  
  // Regex to find headers: 
  // 1. Matches "1. 🎯 Title" or "1. Title" or "🔄 Title"
  // 2. Looks for start of string or newline
  // 3. Optional number + dot OR specific emojis like 🔄
  const headerRegex = /(?:^|\n)(?:\d+\.|\uD83D\uDD04|🔄)\s+[\u2000-\u32FF\uD83C-\uD83E\uDC00-\uDFFF]*\s*[^:\n]{2,}/g;
  
  const headerPositions: number[] = [];
  let match;
  
  // Use a copy of the regex to avoid state issues if it were global and reused elsewhere
  const regex = new RegExp(headerRegex);
  
  while ((match = regex.exec(markdown)) !== null) {
    headerPositions.push(match.index);
  }
  
  if (headerPositions.length === 0) {
    // If no clear headers found, try splitting by double newlines as a fallback
    // but only if it's long
    if (markdown.length > 500) {
      return markdown.split(/\n\n+/).filter(Boolean);
    }
    return [markdown];
  }
  
  // Split the text based on header positions
  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i];
    const end = i < headerPositions.length - 1 ? headerPositions[i + 1] : markdown.length;
    let chunk = markdown.slice(start, end).trim();
    if (chunk) sections.push(chunk);
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
