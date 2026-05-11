
/**
 * IRT (Item Response Theory) Engine
 * Implements 3PL (Three-Parameter Logistic) model for ability estimation (Theta).
 */

export interface IRTItem {
  id: string;
  a: number; // Discrimination
  b: number; // Difficulty
  c: number; // Guessing (pseudo-chance)
}

export interface IRTResponse {
  item: IRTItem;
  correct: boolean;
}

/**
 * Probability of correct response given theta
 */
export function pCorrect(theta: number, item: IRTItem): number {
  const exponent = -1.7 * item.a * (theta - item.b);
  return item.c + (1 - item.c) / (1 + Math.exp(exponent));
}

/**
 * First derivative of P(theta)
 */
export function pFirstDerivative(theta: number, item: IRTItem): number {
  const p = pCorrect(theta, item);
  const q = 1 - p;
  const exponent = Math.exp(-1.7 * item.a * (theta - item.b));
  const inner = (1 - item.c) * 1.7 * item.a * exponent / Math.pow(1 + exponent, 2);
  return inner;
}

/**
 * Estimate Theta using Maximum Likelihood Estimation (MLE) or EAP (Expected A Posteriori)
 * Simplified version: Newton-Raphson for MLE
 */
export function estimateTheta(responses: IRTResponse[], initialTheta: number = 0): number {
  if (responses.length === 0) return initialTheta;

  let theta = initialTheta;
  const maxIterations = 20;
  const tolerance = 0.001;

  for (let i = 0; i < maxIterations; i++) {
    let logLikelihoodFirstDeriv = 0;
    let logLikelihoodSecondDeriv = 0;

    for (const res of responses) {
      const p = pCorrect(theta, res.item);
      const q = 1 - p;
      const dp = pFirstDerivative(theta, res.item);
      
      // MLE derivative components
      const weight = dp / (p * q);
      const diff = (res.correct ? 1 : 0) - p;
      
      logLikelihoodFirstDeriv += weight * diff;
      // Approximation of second derivative (Fisher Information)
      logLikelihoodSecondDeriv -= Math.pow(dp, 2) / (p * q);
    }

    if (Math.abs(logLikelihoodSecondDeriv) < 1e-9) break;

    const delta = logLikelihoodFirstDeriv / logLikelihoodSecondDeriv;
    theta -= delta;

    if (Math.abs(delta) < tolerance) break;
  }

  // Cap theta between -4 and 4
  return Math.max(-4, Math.min(4, theta));
}
