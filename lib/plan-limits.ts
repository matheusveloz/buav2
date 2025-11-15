export type PlanLimits = {
  maxDurationVideoSeg: number;
  maxUploadsAvatars: number | null;
  maxProcessamentos: number;
  processamentoPrioritario: boolean;
  acessoAvataresPadrao: boolean;
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxDurationVideoSeg: 30,
    maxUploadsAvatars: 3,
    maxProcessamentos: 1,
    processamentoPrioritario: false,
    acessoAvataresPadrao: true,
  },
  pro: {
    maxDurationVideoSeg: 180,
    maxUploadsAvatars: null, // ilimitado
    maxProcessamentos: 4,
    processamentoPrioritario: false,
    acessoAvataresPadrao: true,
  },
  premium: {
    maxDurationVideoSeg: 600,
    maxUploadsAvatars: null, // ilimitado
    maxProcessamentos: 8,
    processamentoPrioritario: true,
    acessoAvataresPadrao: true,
  },
  unlimited: {
    maxDurationVideoSeg: 600,
    maxUploadsAvatars: null, // ilimitado
    maxProcessamentos: 12,
    processamentoPrioritario: true,
    acessoAvataresPadrao: true,
  },
};

export function getPlanLimits(planSlug: string): PlanLimits {
  return PLAN_LIMITS[planSlug] || PLAN_LIMITS.free;
}

export function canProcessVideos(planSlug: string, currentProcessing: number): boolean {
  const limits = getPlanLimits(planSlug);
  return currentProcessing < limits.maxProcessamentos;
}

export function canUploadAvatar(planSlug: string, currentUploads: number): boolean {
  const limits = getPlanLimits(planSlug);
  if (limits.maxUploadsAvatars === null) return true;
  return currentUploads < limits.maxUploadsAvatars;
}

export function getMaxVideoDuration(planSlug: string): number {
  const limits = getPlanLimits(planSlug);
  return limits.maxDurationVideoSeg;
}


