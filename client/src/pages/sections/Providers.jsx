import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';

export default function Providers() {
  const { profile } = useUser();
  const [providers, setProviders] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchSection(profile.accountId, 'providers')
      .then(({ items, sha }) => { setProviders(items); setSha(sha); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const filtered = providers.filter((p) =>
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection(profile.accountId, 'providers', providers, sha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading providers…</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const provider = selected !== null ? providers[selected] : null;

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <input
          type="search"
          placeholder="Search providers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          {filtered.map((p) => {
            const idx = providers.indexOf(p);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(idx)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 text-sm transition-colors ${
                  selected === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.meta?.['ignyte-provider-position'] || ''}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        {provider ? (
          <ProviderEditor
            provider={provider}
            onChange={(updated) => {
              const next = [...providers];
              next[selected] = updated;
              setProviders(next);
            }}
            onSave={handleSave}
            saving={saving}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
            Select a provider to edit
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderEditor({ provider, onChange, onSave, saving }) {
  const meta = provider.meta || {};
  const set = (field, value) => onChange({ ...provider, meta: { ...meta, [field]: value } });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{provider.title}</h3>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" value={meta['ignyte-provider-fname'] || ''} onChange={(v) => set('ignyte-provider-fname', v)} />
        <Field label="Last Name" value={meta['ignyte-provider-lname'] || ''} onChange={(v) => set('ignyte-provider-lname', v)} />
      </div>
      <Field label="Credentials / Position" value={meta['ignyte-provider-position'] || ''} onChange={(v) => set('ignyte-provider-position', v)} />
      <Field label="Excerpt / Bio" value={provider.excerpt || ''} onChange={(v) => onChange({ ...provider, excerpt: v })} multiline />
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
