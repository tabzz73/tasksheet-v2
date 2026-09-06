/**
 * App-wide registry of "is some editor currently dirty" flags, used to
 * guard navigation that would otherwise silently discard an in-progress
 * edit (UI-UX-SPEC.md §7: "Cancel, close, Escape, backdrop dismissal,
 * navigation and normal application close must protect dirty ...
 * editors"). Dialog-scoped drafts already guard themselves via
 * useDirtyGuard; this registry exists for full-page editors like the
 * Settings > Facility & Locale form, which has no dialog wrapper of its
 * own to intercept a sidebar nav click or a Settings category switch.
 */
const dirtyIds = new Set<string>();

export function setDirty(id: string, dirty: boolean): void {
  if (dirty) dirtyIds.add(id);
  else dirtyIds.delete(id);
}

export function isAnyDirty(): boolean {
  return dirtyIds.size > 0;
}

/** Used only by the discard confirmation once the user has explicitly chosen to discard. */
export function clearAllDirty(): void {
  dirtyIds.clear();
}
