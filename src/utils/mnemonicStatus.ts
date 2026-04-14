/**
 * Mnemonic score/status helpers.
 */

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  return "text-red-500";
}

export function getScoreBg(score: number): string {
  if (score >= 90) return "bg-green-500/10 border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
}

export function getApprovalLabel(approved: boolean): string {
  return approved ? "Aprovado" : "Reprovado";
}

export function getApprovalVariant(approved: boolean): "default" | "destructive" {
  return approved ? "default" : "destructive";
}

export function formatScore(score: number): string {
  return `${Math.round(score)}/100`;
}
