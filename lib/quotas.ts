export const QUOTAS = {
  free: {
    uploads: 5,
    analyses: 3,
    renders: 5,
    connections: 1,
    scheduled: 5,
  },
  pro: {
    uploads: 100, // Representing high limit / virtually unlimited
    analyses: 100,
    renders: 100,
    connections: 6,
    scheduled: 9999,
  },
} as const;

export type PlanType = "free" | "pro";
