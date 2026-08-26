import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';
import ChangeHistory from '../../components/ChangeHistory.jsx';

const TABS = ['insurance', 'forms', 'rights'];

export default function Patients() {
  const { profile } = useUser();
  const [data, setData] = useState({ insurance: [], forms: [], rights: [], responsibilities: [] });
  const [sha, setSha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('insurance');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchSection(profile.accountId, 'patients')
      .then(({ items, sha }) => { setData(items); setSha(sha); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveSection(profile.accountId, 'patients', data, sha);
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

  if (loading) return <div className="text-gray-400">Loading patients…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {TABS.map((t) => (
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

      {tab === 'insurance' && (
        <StringListEditor
          label="Accepted insurance plans"
          items={data.insurance || []}
          onChange={(v) => setData((d) => ({ ...d, insurance: v }))}
        />
      )}

      {tab === 'forms' && (
        <FormsEditor
          forms={data.forms || []}
          onChange={(v) => setData((d) => ({ ...d, forms: v }))}
        />
      )}

      {tab === 'rights' && (
        <div className="space-y-6">
          <StringListEditor
            label="Patient rights"
            items={data.rights || []}
            onChange={(v) => setData((d) => ({ ...d, rights: v }))}
          />
          <StringListEditor
            label="Patient responsibilities"
            items={data.responsibilities || []}
            onChange={(v) => setData((d) => ({ ...d, responsibilities: v }))}
          />
        </div>
      )}
    <ChangeHistory
      accountId={profile.accountId}
      section="patients"
      onUndone={handleUndone}
      open={showHistory}
      onClose={() => setShowHistory(false)}
    />
    </div>
  );
}

function StringListEditor({ label, items, onChange }) {
  const update = (i, v) => { const n = [...items]; n[i] = v; onChange(n); };
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input type="text" value={item} onChange={(e) => update(i, e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => remove(i)} className="px-2 text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      ))}
      <button onClick={add}
        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
        + Add item
      </button>
    </div>
  );
}

function FormsEditor({ forms, onChange }) {
  const update = (i, field, value) => {
    const next = [...forms];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };
  const add = () => onChange([...forms, { title: '', eng: '', spa: '' }]);
  const remove = (i) => onChange(forms.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {forms.map((form, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Form {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>
          <Field label="Title" value={form.title || ''} onChange={(v) => update(i, 'title', v)} />
          <Field label="English PDF URL" value={form.eng || ''} onChange={(v) => update(i, 'eng', v)} placeholder="https://…" />
          <Field label="Spanish PDF URL" value={form.spa || ''} onChange={(v) => update(i, 'spa', v)} placeholder="https://…" />
          <Field label="JotForm URL (optional)" value={form.jotform || ''} onChange={(v) => update(i, 'jotform', v)} placeholder="https://form.jotform.com/…" />
        </div>
      ))}
      <button onClick={add}
        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
        + Add form
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
