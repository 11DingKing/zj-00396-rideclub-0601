import { RouteLevel } from "@prisma/client";

export const FULL_ATTENDANCE_BONUS = 10;

export const DIFFICULTY_BONUS: Record<string, number> = {
  [RouteLevel.ADVANCED]: 15,
  [RouteLevel.EXPERT]: 30,
};

export const LEVEL_THRESHOLDS: Array<{ minMileage: number; level: number }> = [
  { minMileage: 10000, level: 10 },
  { minMileage: 5000, level: 9 },
  { minMileage: 3000, level: 8 },
  { minMileage: 2000, level: 7 },
  { minMileage: 1000, level: 6 },
  { minMileage: 500, level: 5 },
  { minMileage: 200, level: 4 },
  { minMileage: 100, level: 3 },
  { minMileage: 50, level: 2 },
  { minMileage: 0, level: 1 },
];

export function calculateBasePoints(mileage: number): number {
  return Math.floor(mileage);
}

export function calculateDifficultyBonus(routeLevel: string): number {
  return DIFFICULTY_BONUS[routeLevel] ?? 0;
}

export function calculateLevel(totalMileage: number): number {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalMileage >= threshold.minMileage) {
      return threshold.level;
    }
  }
  return 1;
}

export interface PointsCalculationInput {
  mileage: number;
  routeLevel: string;
  hasFullAttendance: boolean;
  totalViolationDeduction: number;
}

export function calculateFinalPoints(input: PointsCalculationInput): number {
  let points = calculateBasePoints(input.mileage);

  if (input.hasFullAttendance) {
    points += FULL_ATTENDANCE_BONUS;
  }

  points += calculateDifficultyBonus(input.routeLevel);

  points -= input.totalViolationDeduction;

  return Math.max(0, points);
}
