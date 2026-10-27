export type Role = "trainer" | "backup" | "ueberzaehlig";

export const ROLE_LABEL: Record<Role, string> = {
  trainer: "Trainer",
  backup: "Backup",
  ueberzaehlig: "Überzählig",
};

export type Staffing = { trainersNeeded: number; backupsNeeded: number };

export function capacity(s: Staffing): number {
  return s.trainersNeeded + s.backupsNeeded;
}

function roleForRank(rank: number, s: Staffing): Role {
  if (rank <= s.trainersNeeded) return "trainer";
  if (rank <= capacity(s)) return "backup";
  return "ueberzaehlig";
}

/** Signup order: by position, then createdAt. */
export function sortByPosition<T extends { position: number; createdAt: Date }>(
  signups: T[],
): T[] {
  return [...signups].sort(
    (a, b) =>
      a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/** Derives each signup's role from its 1-based rank in signup order. */
export function rankSignups<T extends { position: number; createdAt: Date }>(
  signups: T[],
  s: Staffing,
): Array<T & { role: Role; rank: number }> {
  return sortByPosition(signups).map((signup, index) => ({
    ...signup,
    rank: index + 1,
    role: roleForRank(index + 1, s),
  }));
}

export type StaffingStatus = "voll" | "backup-fehlt" | "trainer-fehlt";

export function staffingStatus(
  signupCount: number,
  s: Staffing,
): StaffingStatus {
  if (signupCount >= capacity(s)) return "voll";
  if (signupCount >= s.trainersNeeded) return "backup-fehlt";
  return "trainer-fehlt";
}

/** terminId → profileId → role */
export type RoleSnapshot = Map<string, Map<string, Role>>;

export type RoleChange = {
  terminId: string;
  profileId: string;
  from: Role | null;
  to: Role | null;
};

export function diffRoles(
  before: RoleSnapshot,
  after: RoleSnapshot,
): RoleChange[] {
  const changes: RoleChange[] = [];
  const terminIds = new Set([...before.keys(), ...after.keys()]);
  for (const terminId of terminIds) {
    const rolesBefore = before.get(terminId) ?? new Map<string, Role>();
    const rolesAfter = after.get(terminId) ?? new Map<string, Role>();
    const profileIds = new Set([...rolesBefore.keys(), ...rolesAfter.keys()]);
    for (const profileId of profileIds) {
      const from = rolesBefore.get(profileId) ?? null;
      const to = rolesAfter.get(profileId) ?? null;
      if (from !== to) changes.push({ terminId, profileId, from, to });
    }
  }
  return changes;
}

/** The role the next person to sign up would get, or null when the Termin is full. */
export function nextRole(signupCount: number, s: Staffing): Role | null {
  if (signupCount >= capacity(s)) return null;
  return roleForRank(signupCount + 1, s);
}

/** "2 Trainer fehlen", "1 Backup fehlt" or "Voll besetzt". */
export function staffingLabel(
  t: Staffing & {
    status: StaffingStatus;
    trainerCount: number;
    backupCount: number;
  },
): string {
  if (t.status === "trainer-fehlt") {
    const missing = t.trainersNeeded - t.trainerCount;
    return missing === 1 ? "1 Trainer fehlt" : `${missing} Trainer fehlen`;
  }
  if (t.status === "backup-fehlt") {
    const missing = t.backupsNeeded - t.backupCount;
    return missing === 1 ? "1 Backup fehlt" : `${missing} Backups fehlen`;
  }
  return "Voll besetzt";
}
