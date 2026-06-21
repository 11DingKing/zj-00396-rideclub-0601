export interface GroupRiskInput {
  totalRiders: number;
  totalCheckIns: number;
  totalViolations: number;
  totalMissed: number;
  totalOptOut: number;
  avgSafetyScore: number;
  avgRiderLevel: number;
}

export function calculateGroupRiskScore(input: GroupRiskInput): number {
  const {
    totalRiders,
    totalCheckIns,
    totalViolations,
    totalMissed,
    totalOptOut,
    avgSafetyScore,
    avgRiderLevel,
  } = input;

  const violationRate =
    totalRiders > 0 ? (totalViolations / totalRiders) * 100 : 0;
  const missedRate =
    totalCheckIns > 0 ? (totalMissed / totalCheckIns) * 100 : 0;
  const optOutRate = totalRiders > 0 ? (totalOptOut / totalRiders) * 100 : 0;

  let riskScore = 0;
  riskScore += (100 - avgSafetyScore) * 0.4;
  riskScore += violationRate * 2;
  riskScore += missedRate * 1.5;
  riskScore += optOutRate * 2;
  riskScore += (10 - avgRiderLevel) * 2;

  return Math.min(100, Math.max(0, riskScore));
}

export function getRiskLevel(riskScore: number): "LOW" | "MEDIUM" | "HIGH" {
  if (riskScore >= 70) return "HIGH";
  if (riskScore >= 40) return "MEDIUM";
  return "LOW";
}
