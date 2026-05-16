/**
 * ENAZIZI TRI/IRT Engine — Latent Ability (Theta) Calculation
 * Implementing the 3-Parameter Logistic Model (3PL).
 */

export interface ItemParameters {
    difficulty: number;      // b (threshold)
    discrimination: number;  // a (slope)
    guessing: number;        // c (asymptote)
}

export interface UserResponse {
    correct: boolean;
    item: ItemParameters;
}

/**
 * Probability of a correct response based on theta.
 * P(theta) = c + (1 - c) / (1 + exp(-a * (theta - b)))
 */
export function calculateProbability(theta: number, item: ItemParameters): number {
    const { discrimination: a, difficulty: b, guessing: c } = item;
    const expTerm = Math.exp(-a * (theta - b));
    return c + (1 - c) / (1 + expTerm);
}

/**
 * Iterative estimation of latent ability (theta) using Maximum Likelihood Estimation (MLE) 
 * or a simplified Newton-Raphson approximation for real-time scale.
 */
export function estimateTheta(responses: UserResponse[], initialTheta = 0): number {
    if (responses.length === 0) return initialTheta;

    let theta = initialTheta;
    const iterations = 5; // Newton-Raphson typically converges fast

    for (let i = 0; i < iterations; i++) {
        let numerator = 0;   // First derivative (Log-likelihood)
        let denominator = 0; // Second derivative (Information)

        for (const res of responses) {
            const P = calculateProbability(theta, res.item);
            const Q = 1 - P;
            const a = res.item.discrimination;
            const c = res.item.guessing;

            // Simplified partial derivatives for 3PL
            const weight = (a * (P - c)) / (P * (1 - c));
            const diff = (res.correct ? 1 : 0) - P;

            numerator += weight * diff;
            denominator += (a * a * (P - c) * (P - c) * Q) / (P * (1 - c) * (1 - c));
        }

        if (Math.abs(denominator) < 0.0001) break; // Avoid division by zero
        
        const delta = numerator / denominator;
        theta += delta;

        // Constraint theta between -4 and 4 (standard TRI scale)
        theta = Math.max(-4, Math.min(4, theta));
    }

    return theta;
}

/**
 * Calculate Adaptive Score (0-100) based on theta.
 * Typically maps -3 to 3 scale to 0-100.
 */
export function thetaToScore(theta: number): number {
    return Math.round(((theta + 3) / 6) * 100);
}
