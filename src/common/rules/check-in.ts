import { CheckInStatus, CheckpointType } from "@prisma/client";

export interface CheckInRecord {
  status: CheckInStatus;
  checkpointId: string;
  checkpoint?: { type: CheckpointType; id: string; orderIndex?: number };
  missReason?: string | null;
  optOutReason?: string | null;
}

export interface RegistrationWithCheckIns {
  isPresent: boolean;
  completed: boolean;
  optOutReason?: string | null;
  cancelledAt?: Date | null;
  checkIns: CheckInRecord[];
}

export function isRiderPresent(
  registration: RegistrationWithCheckIns,
): boolean {
  return registration.checkIns.some(
    (ci) =>
      ci.checkpoint?.type === CheckpointType.START &&
      ci.status === CheckInStatus.CHECKED_IN,
  );
}

export function isRiderCompleted(
  registration: RegistrationWithCheckIns,
): boolean {
  return registration.checkIns.some(
    (ci) =>
      ci.checkpoint?.type === CheckpointType.END &&
      ci.status === CheckInStatus.CHECKED_IN,
  );
}

export function hasFullAttendance(
  registration: RegistrationWithCheckIns,
  checkpointIds: string[],
): boolean {
  return checkpointIds.every((cpId) =>
    registration.checkIns.some(
      (ci) =>
        ci.checkpointId === cpId && ci.status === CheckInStatus.CHECKED_IN,
    ),
  );
}

export function isEligibleForPoints(
  registration: RegistrationWithCheckIns,
): boolean {
  return isRiderPresent(registration) && isRiderCompleted(registration);
}

export interface MissedCheckpointJudgment {
  isMissed: boolean;
  hasExcuse: boolean;
  reason: string;
}

export function judgeMissedCheckpoint(
  checkIn: CheckInRecord | undefined,
  checkpointName: string,
): MissedCheckpointJudgment {
  if (!checkIn) {
    return {
      isMissed: true,
      hasExcuse: false,
      reason: "完全缺席，未产生任何签到记录",
    };
  }

  if (checkIn.status === CheckInStatus.MISSED) {
    const hasReason = checkIn.missReason && checkIn.missReason.trim() !== "";
    return {
      isMissed: true,
      hasExcuse: !!hasReason,
      reason: hasReason ? checkIn.missReason! : "无原因漏签",
    };
  }

  if (checkIn.status === CheckInStatus.PENDING) {
    return {
      isMissed: true,
      hasExcuse: false,
      reason: "未到场签到，状态仍为待处理",
    };
  }

  return { isMissed: false, hasExcuse: false, reason: "" };
}

export function canCheckInAfterPrevious(
  previousCheckInStatus: CheckInStatus | undefined,
): boolean {
  if (!previousCheckInStatus) return false;
  return (
    previousCheckInStatus === CheckInStatus.CHECKED_IN ||
    previousCheckInStatus === CheckInStatus.OPT_OUT
  );
}
