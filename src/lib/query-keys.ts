// One place for every query key, so invalidation after a mutation is precise.
export const qk = {
  me: ["auth", "me"] as const,
  lookups: ["lookups"] as const,
  doctors: {
    all: ["doctors"] as const,
    list: (params: object) => ["doctors", "list", params] as const,
    detail: (id: string) => ["doctors", "detail", id] as const,
    options: (search: string) => ["doctors", "options", search] as const,
  },
  patients: {
    all: ["patients"] as const,
    list: (params: object) => ["patients", "list", params] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params: object) => ["users", "list", params] as const,
  },
  stats: (range: { from: string; to: string }) => ["stats", range] as const,
};
