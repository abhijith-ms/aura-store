/**
 * updateNotifier.js — Pure diffing logic for background update notifications.
 *
 * Kept separate from App.jsx (and from the Notification API / timers) so the
 * "which updates are newly available" logic is unit-testable without waiting
 * on a real 30-minute interval or a browser notification permission.
 */

/**
 * @param {Set<string>|null} previousNames - Package names known from the last
 *   check, or null if no baseline has been established yet (first run).
 * @param {Array<{name: string}>} freshUpdates - Latest update list from the API.
 * @returns {string[]} Names present in freshUpdates but not in previousNames.
 *   Always empty when previousNames is null — the first check only
 *   establishes a baseline, it never has anything "new" to report.
 */
export function diffNewlyAvailableUpdates(previousNames, freshUpdates) {
  const freshNames = (freshUpdates || []).map(u => u.name);
  if (previousNames === null) return [];
  return freshNames.filter(n => !previousNames.has(n));
}

/**
 * Formats a desktop notification body for a list of newly-available updates.
 */
export function formatUpdateNotificationBody(newlyAvailable) {
  if (newlyAvailable.length === 1) return `Update available: ${newlyAvailable[0]}`;
  const preview = newlyAvailable.slice(0, 3).join(', ');
  const suffix = newlyAvailable.length > 3 ? '…' : '';
  return `${newlyAvailable.length} package updates available: ${preview}${suffix}`;
}
