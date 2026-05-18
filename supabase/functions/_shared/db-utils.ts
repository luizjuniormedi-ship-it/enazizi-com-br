export function sanitizeForPostgres(obj: any): any {
  if (typeof obj === "string") {
    // 1. Remove null bytes (\u0000) which are forbidden in Postgres text/jsonb
    // 2. Remove other non-printable control characters that can cause 22P05 or encoding issues
    // 3. Keep \n, \r, \t
    return obj
      .replace(/\0/g, "")
      .replace(/\u0000/g, "")
      // \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F (non-printable ASCII control chars)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Broadly remove other potential dangerous Unicode control characters if needed
      // but let's stick to the core ones that cause 22P05 first.
      .trim();
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForPostgres);
  }
  if (typeof obj === "object" && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = sanitizeForPostgres(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function generateStatementHash(statement: string): string {
  if (!statement) return "empty_hash";
  const clean = statement.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 100);
  const length = statement.length;
  // Simple unique-ish string
  return `${length}_${clean.length}_${clean.slice(0, 40)}`;
}
