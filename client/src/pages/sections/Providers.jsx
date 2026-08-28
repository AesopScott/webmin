import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';
import ImageUpload from '../../components/ImageUpload.jsx';
import ChangeHistory from '../../components/ChangeHistory.jsx';

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function newProvider() {
  return {
    id: `provider-${Date.now()}`,
    title: '',
    slug: '',
    url: '',
    excerpt: '',
    thumbnail: '',
    meta: {
      'ignyte-provider-fname': '',
      'ignyte-provider-lname': '',
      'ignyte-provider-position': '',
    },
  };
}

export default function Providers() {
  const { profile } = useUser();
  const [providers, setProviders] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);

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
    setError('');
    try {
      const { sha: newSha, items: savedItems } = await saveSection(profile.accountId, 'providers', providers, sha);
      if (newSha) setSha(newSha);
      if (savedItems) setProviders(savedItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const p = newProvider();
    const next = [...providers, p];
    setProviders(next);
    setSelected(next.length - 1);
    setSearch('');
  };

  const handleUndone = ({ sha: newSha, items: newItems }) => {
    setProviders(newItems);
    setSha(newSha);
    setShowHistory(false);
  };

  const handleDelete = () => {
    if (selected === null) return;
    const next = providers.filter((_, i) => i !== selected);
    setProviders(next);
    setSelected(null);
  };

  const handleChange = (updated) => {
    const fname = updated.meta?.['ignyte-provider-fname'] || '';
    const lname = updated.meta?.['ignyte-provider-lname'] || '';
    const title = [fname, lname].filter(Boolean).join(' ') || 'New Provider';
    const next = [...providers];
    const slug = updated.slug || slugify(title);
    next[selected] = {
      ...updated,
      title,
      slug,
      url: updated.url || (slug ? `https://cmcenters.org/health-care-provider/${slug}/` : ''),
    };
    setProviders(next);
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading providers…</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const provider = selected !== null ? providers[selected] : null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowHistory(true)}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          History
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    <div className="flex gap-6 flex-1 min-h-0">
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search providers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add
          </button>
        </div>
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
                <div className="font-medium">{p.title || 'New Provider'}</div>
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
            onChange={handleChange}
            onDelete={handleDelete}
            accountId={profile.accountId}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
            Select a provider to edit
          </div>
        )}
      </div>
    </div>
    <ChangeHistory
      accountId={profile.accountId}
      section="providers"
      onUndone={handleUndone}
      open={showHistory}
      onClose={() => setShowHistory(false)}
    />
    </div>
  );
}

function ProviderEditor({ provider, onChange, onDelete, accountId }) {
  const meta = provider.meta || {};
  const set = (field, value) => onChange({ ...provider, meta: { ...meta, [field]: value } });
  const setProvider = (field, value) => onChange({ ...provider, [field]: value });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{provider.title || 'New Provider'}</h3>
        <button
          onClick={onDelete}
          className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" value={meta['ignyte-provider-fname'] || ''} onChange={(v) => set('ignyte-provider-fname', v)} />
        <Field label="Last Name" value={meta['ignyte-provider-lname'] || ''} onChange={(v) => set('ignyte-provider-lname', v)} />
      </div>
      <Field label="Credentials / Position" value={meta['ignyte-provider-position'] || ''} onChange={(v) => set('ignyte-provider-position', v)} />
      <Field label="Slug" value={provider.slug || ''} onChange={(v) => setProvider('slug', slugify(v))} />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Photo</label>
        <ImageUpload
          accountId={accountId}
          currentPath={provider.thumbnail || meta.thumbnail || ''}
          onUploaded={(path) => setProvider('thumbnail', path)}
        />
      </div>
      <Field label="Excerpt / Bio" value={provider.excerpt || ''} onChange={(v) => onChange({ ...provider, excerpt: v })} multiline />
    </div>
  );
}

function Field({ label, value, onChange, multiline, placeholder }) {
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
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
