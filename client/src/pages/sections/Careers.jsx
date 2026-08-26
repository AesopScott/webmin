import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';
import ChangeHistory from '../../components/ChangeHistory.jsx';

export default function Careers() {
  const { profile } = useUser();
  const [data, setData] = useState({ benefits: [], faqs: [] });
  const [sha, setSha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('benefits');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchSection(profile.accountId, 'careers')
      .then(({ items, sha }) => { setData(items); setSha(sha); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveSection(profile.accountId, 'careers', data, sha);
      if (result?.sha) setSha(result.sha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUndone = ({ sha: newSha, items: newItems }) => {
    setData(newItems);
    setSha(newSha);
    setShowHistory(false);
  };

  const updateBenefit = (i, field, value) =>
    setData((d) => { const b = [...d.benefits]; b[i] = { ...b[i], [field]: value }; return { ...d, benefits: b }; });

  const addBenefit = () =>
    setData((d) => ({ ...d, benefits: [...d.benefits, { title: '', desc: '' }] }));

  const deleteBenefit = (i) =>
    setData((d) => ({ ...d, benefits: d.benefits.filter((_, idx) => idx !== i) }));

  const updateFaq = (i, field, value) =>
    setData((d) => { const f = [...d.faqs]; f[i] = { ...f[i], [field]: value }; return { ...d, faqs: f }; });

  const addFaq = () =>
    setData((d) => ({ ...d, faqs: [...d.faqs, { q: '', a: '', list: false }] }));

  const deleteFaq = (i) =>
    setData((d) => ({ ...d, faqs: d.faqs.filter((_, idx) => idx !== i) }));

  if (loading) return <div className="text-gray-400">Loading careers…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['benefits', 'faqs'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            History
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {tab === 'benefits' && (
        <div className="space-y-4">
          {data.benefits.map((b, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Benefit {i + 1}</span>
                <button onClick={() => deleteBenefit(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
              <Field label="Title" value={b.title} onChange={(v) => updateBenefit(i, 'title', v)} />
              <Field label="Description" value={b.desc} onChange={(v) => updateBenefit(i, 'desc', v)} multiline rows={2} />
            </div>
          ))}
          <button onClick={addBenefit}
            className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
            + Add benefit
          </button>
        </div>
      )}

      {tab === 'faqs' && (
        <div className="space-y-4">
          {data.faqs.map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">FAQ {i + 1}</span>
                <button onClick={() => deleteFaq(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
              <Field label="Question" value={f.q} onChange={(v) => updateFaq(i, 'q', v)} />
              <Field label="Answer" value={f.a} onChange={(v) => updateFaq(i, 'a', v)} multiline rows={4} />
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={!!f.list} onChange={(e) => updateFaq(i, 'list', e.target.checked)} className="rounded" />
                Render answer as list (line-break separated)
              </label>
            </div>
          ))}
          <button onClick={addFaq}
            className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
            + Add FAQ
          </button>
        </div>
      )}
    <ChangeHistory
      accountId={profile.accountId}
      section="careers"
      onUndone={handleUndone}
      open={showHistory}
      onClose={() => setShowHistory(false)}
    />
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows = 3 }) {
  const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${cls} resize-y`} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      }
    </div>
  );
}
