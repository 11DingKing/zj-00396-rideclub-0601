import { ViolationType } from "@prisma/client";

export const VIOLATION_POINTS: Record<ViolationType, number> = {
  [ViolationType.NO_LIGHTS_NIGHT_RIDE]: 10,
  [ViolationType.NO_HELMET]: 15,
  [ViolationType.EARLY_QUIT_WITHOUT_REASON]: 5,
  [ViolationType.MISSED_CHECKPOINT]: 3,
};

export function getViolationPoints(type: ViolationType): number {
  return VIOLATION_POINTS[type];
}

export function sumViolationDeductions(
  violations: Array<{ pointsDeducted: number }>,
): number {
  return violations.reduce((sum, v) => sum + v.pointsDeducted, 0);
}
