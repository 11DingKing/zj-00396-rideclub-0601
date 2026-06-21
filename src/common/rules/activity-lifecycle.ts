import { ActivityStatus } from "@prisma/client";

export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  [ActivityStatus.DRAFT]: [ActivityStatus.PUBLISHED, ActivityStatus.CANCELLED],
  [ActivityStatus.PUBLISHED]: [
    ActivityStatus.IN_PROGRESS,
    ActivityStatus.REGISTRATION_CLOSED,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.REGISTRATION_CLOSED]: [
    ActivityStatus.IN_PROGRESS,
    ActivityStatus.CANCELLED,
  ],
  [ActivityStatus.IN_PROGRESS]: [
    ActivityStatus.PAUSED,
    ActivityStatus.COMPLETED,
  ],
  [ActivityStatus.PAUSED]: [
    ActivityStatus.IN_PROGRESS,
    ActivityStatus.COMPLETED,
  ],
  [ActivityStatus.COMPLETED]: [],
  [ActivityStatus.CANCELLED]: [],
};

export function canTransitionTo(
  from: ActivityStatus,
  to: ActivityStatus,
): boolean {
  return ACTIVITY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function requireTransition(
  from: ActivityStatus,
  to: ActivityStatus,
  message?: string,
): void {
  if (!canTransitionTo(from, to)) {
    throw new Error(message || `活动状态不能从 ${from} 变更为 ${to}`);
  }
}

export const EDITABLE_STATUSES: ActivityStatus[] = [
  ActivityStatus.DRAFT,
  ActivityStatus.PUBLISHED,
];

export const ACTIVE_STATUSES: ActivityStatus[] = [
  ActivityStatus.IN_PROGRESS,
  ActivityStatus.PAUSED,
];

export const CANCELLABLE_STATUSES: ActivityStatus[] = [
  ActivityStatus.DRAFT,
  ActivityStatus.PUBLISHED,
  ActivityStatus.REGISTRATION_CLOSED,
];
