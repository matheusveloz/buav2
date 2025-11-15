export const DEFAULT_PROFILE = {
  plan: 'free',
  credits: 150,
  extraCredits: 0,
} as const;

export type Profile = {
  plan: string;
  credits: number;
  extraCredits: number;
};

type ProfileRow = {
  plano?: string | null;
  creditos?: number | null;
  creditos_extras?: number | null;
} | null;

export function buildInitialProfile(row: ProfileRow): Profile {
  return {
    plan: typeof row?.plano === 'string' && row.plano.trim() ? row.plano : DEFAULT_PROFILE.plan,
    credits: typeof row?.creditos === 'number' ? row.creditos : DEFAULT_PROFILE.credits,
    extraCredits:
      typeof row?.creditos_extras === 'number' ? row.creditos_extras : DEFAULT_PROFILE.extraCredits,
  };
}

// Alias para compatibilidade
export const normalizeProfile = buildInitialProfile;
