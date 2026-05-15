export function sanitizeForPostgres(obj: any): any {
  if (typeof obj === "string") {
    // Remove null bytes and other common characters that cause "unsupported Unicode escape sequence" (22P05)
    return obj.replace(/\0/g, "").replace(/\u0000/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
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
