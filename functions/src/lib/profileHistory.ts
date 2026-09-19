export type ProfileHistoryEntry = {
  at: string;
  by: string;
  requestId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
};

/** One entry per approved profile-change request — appended to the technician doc instead of silently overwriting fields, so the change is auditable. */
export function profileHistoryEntry(
  by: string,
  requestId: string,
  changes: ProfileHistoryEntry['changes'],
): ProfileHistoryEntry {
  return { at: new Date().toISOString(), by, requestId, changes };
}
