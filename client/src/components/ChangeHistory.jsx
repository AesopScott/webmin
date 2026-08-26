import { useState } from 'react';
import { getChangeDetail } from '../lib/api.js';
import { useChangeHistory } from '../hooks/useChangeHistory.js';
import UndoConfirmation from './UndoConfirmation.jsx';

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

function sectionLabel(section) {
  return section ? section[0].toUpperCase() + section.slice(1) : '';
}

export default function ChangeHistory({ accountId, section, onUndone, open, onClose }) {
  const { changes, loading, error, reload } = useChangeHistory(accountId, section);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);

  if (!open) return null;

  const handleRowClick = async (change) => {
    if (detail?.id === change.id) { setDetail(null); return; }
    setLoadingDetail(true);
    try {
      const d = await getChangeDetail(accountId, change.id);
      setDetail(d);
    } catch (_) {}
    setLoadingDetail(false);
  };

  const handleUndone = (result) => {
    setConfirmChange(null);
    setDetail(null);
    reload();
    onUndone?.(result);
  };

  return (
    <>
      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-40 flex">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20" onClick={onClose} />

        <div className="relative ml-auto w-96 bg-white shadow-xl flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              {section ? `${sectionLabel(section)} History` : 'Activity Log'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>
            )}
            {error && (
              <p className="px-5 py-4 text-sm text-red-500">{error}</p>
            )}
            {!loading && changes.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">No changes recorded yet.</p>
            )}
            {changes.map((change) => (
              <div key={change.id}>
                <button
                  onClick={() => handleRowClick(change)}
                  className={`w-full text-left px-5 py-3 border-b border-gray-100 transition-colors ${
                    detail?.id === change.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {change.section}
                      {change.isUndo && (
                        <span className="ml-1.5 text-amber-600">↩ undo</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{relativeTime(change.timestamp)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {change.userName || change.userEmail} · {change.affectedCount} item{change.affectedCount !== 1 ? 's' : ''}
                  </div>
                </button>

                {detail?.id === change.id && (
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                    {loadingDetail ? (
                      <p className="text-xs text-gray-400">Loading detail…</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">By:</span> {detail.userName} ({detail.userEmail})
                        </div>
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">When:</span>{' '}
                          {detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}
                        </div>
                        {!change.isUndo && (
                          <button
                            onClick={() => setConfirmChange(change)}
                            className="mt-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Undo this change
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmChange && (
        <UndoConfirmation
          change={confirmChange}
          detail={detail}
          accountId={accountId}
          onUndone={handleUndone}
          onClose={() => setConfirmChange(null)}
        />
      )}
    </>
  );
}
