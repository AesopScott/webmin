import { useState } from 'react';
import { undoChange } from '../lib/api.js';

function diffSummary(before, after) {
  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeIds = new Set(before.map((i) => i?.id).filter(Boolean));
    const afterIds = new Set(after.map((i) => i?.id).filter(Boolean));
    const added = [...afterIds].filter((id) => !beforeIds.has(id)).length;
    const removed = [...beforeIds].filter((id) => !afterIds.has(id)).length;
    const common = [...beforeIds].filter((id) => afterIds.has(id));
    const modified = common.filter((id) => {
      const b = before.find((i) => i?.id === id);
      const a = after.find((i) => i?.id === id);
      return JSON.stringify(b) !== JSON.stringify(a);
    }).length;
    const parts = [];
    if (added) parts.push(`${added} added`);
    if (removed) parts.push(`${removed} removed`);
    if (modified) parts.push(`${modified} modified`);
    return parts.length ? parts.join(', ') : 'No changes detected';
  }
  return JSON.stringify(before) !== JSON.stringify(after) ? 'Section data will be modified' : 'No changes detected';
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UndoConfirmation({ change, detail, accountId, onUndone, onClose }) {
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState('');

  const handleUndo = async () => {
    setUndoing(true);
    setError('');
    try {
      const result = await undoChange(accountId, change.id);
      onUndone(result);
    } catch (err) {
      setError(err.message);
      setUndoing(false);
    }
  };

  const revertingTo = detail?.beforeItems;
  const revertingFrom = detail?.afterItems;
  const summary = revertingTo != null && revertingFrom != null
    ? diffSummary(revertingFrom, revertingTo)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Undo change?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {change.section} · {relativeTime(change.timestamp)} · by {change.userName || change.userEmail}
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {summary && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              This will revert: <span className="font-medium">{summary}</span>
            </div>
          )}
          <p className="text-sm text-gray-600">
            This restores the section to the state it was in <strong>before</strong> this change.
            The undo will appear as a new entry in the activity log.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={undoing}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {undoing ? 'Undoing…' : 'Undo Change'}
          </button>
        </div>
      </div>
    </div>
  );
}
