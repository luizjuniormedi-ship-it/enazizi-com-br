
function sanitizeForPostgres(obj) {
  if (typeof obj === "string") {
    return obj
      .replace(/\0/g, "")
      .replace(/\u0000/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
  }
  return obj;
}

const badString = "Texto com null byte \u0000 e controle \x01";
const cleanString = sanitizeForPostgres(badString);

console.log("Original length:", badString.length);
console.log("Cleaned length:", cleanString.length);
console.log("Contains null byte:", cleanString.includes("\0") || cleanString.includes("\u0000"));
console.log("Cleaned string:", cleanString);
