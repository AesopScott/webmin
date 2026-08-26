import { useState } from 'react';
import { useUser } from '../contexts/UserContext.jsx';
import { getChangeDetail } from '../lib/api.js';
import { useChangeHistory } from '../hooks/useChangeHistory.js';
import UndoConfirmation from '../components/UndoConfirmation.jsx';

const SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news', 'contact'];

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

export default function ActivityLog() {
  const { profile } = useUser();
  const [filterSection, setFilterSection] = useState('');
  const { changes, loading, error, reload } = useChangeHistory(profile?.accountId, filterSection || undefined);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);

  const handleSelect = async (change) => {
    if (selected?.id === change.id) { setSelected(null); setDetail(null); return; }
    setSelected(change);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const d = await getChangeDetail(profile.accountId, change.id);
      setDetail(d);
    } catch (_) {}
    setLoadingDetail(false);
  };

  const handleUndone = () => {
    setConfirmChange(null);
    setSelected(null);
    setDetail(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All content changes for this account</p>
        </div>
        <button
          onClick={reload}
          className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Section filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterSection('')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            filterSection === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilterSection(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-colors ${
              filterSection === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && changes.length === 0 && (
        <div className="flex items-center justify-center h-48 bg-white border border-gray-200 rounded-xl text-gray-400 text-sm">
          No changes recorded yet.
        </div>
      )}

      {changes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {changes.map((change) => (
            <div key={change.id}>
              <button
                onClick={() => handleSelect(change)}
                className={`w-full text-left px-5 py-4 border-b border-gray-100 last:border-0 transition-colors ${
                  selected?.id === change.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 capitalize">{change.section}</span>
                      {change.isUndo && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">↩ undo</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {change.userName || change.userEmail}
                      {' · '}
                      {change.affectedCount} item{change.affectedCount !== 1 ? 's' : ''} affected
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">{relativeTime(change.timestamp)}</span>
                </div>
              </button>

              {selected?.id === change.id && (
                <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                  {loadingDetail ? (
                    <p className="text-sm text-gray-400">Loading detail…</p>
                  ) : detail ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="text-gray-500">Changed by</div>
                        <div className="text-gray-800">{detail.userName} <span className="text-gray-400">({detail.userEmail})</span></div>
                        <div className="text-gray-500">When</div>
                        <div className="text-gray-800">{detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}</div>
                        <div className="text-gray-500">Section</div>
                        <div className="text-gray-800 capitalize">{detail.section}</div>
                        <div className="text-gray-500">Items affected</div>
                        <div className="text-gray-800">{detail.affectedCount}</div>
                      </div>
                      {!change.isUndo && (
                        <button
                          onClick={() => setConfirmChange(change)}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Undo this change
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmChange && (
        <UndoConfirmation
          change={confirmChange}
          detail={detail}
          accountId={profile.accountId}
          onUndone={handleUndone}
          onClose={() => setConfirmChange(null)}
        />
      )}
    </div>
  );
}
