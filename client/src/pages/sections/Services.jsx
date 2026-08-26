import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';
import ImageUpload from '../../components/ImageUpload.jsx';
import ChangeHistory from '../../components/ChangeHistory.jsx';

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function newService() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return {
    id: Date.now(),
    slug: '',
    title: 'New Service',
    url: '',
    date: now,
    modified: now,
    excerpt: '',
    content: '',
    thumbnail: '',
    meta: { 'ignyte_locations[]': {}, 'home-checkbox': 'no', 'location-model-checkbox': 'no' },
    terms: [],
  };
}

export default function Services() {
  const { profile } = useUser();
  const [services, setServices] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchSection(profile.accountId, 'services')
      .then(({ items, sha }) => { setServices(items); setSha(sha); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveSection(profile.accountId, 'services', services, sha);
      if (result?.sha) setSha(result.sha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const svc = newService();
    const next = [...services, svc];
    setServices(next);
    setSelected(next.length - 1);
  };

  const handleUndone = ({ sha: newSha, items: newItems }) => {
    setServices(newItems);
    setSha(newSha);
    setShowHistory(false);
  };

  const handleDelete = () => {
    if (selected === null) return;
    const next = services.filter((_, i) => i !== selected);
    setServices(next);
    setSelected(null);
  };

  const update = (field, value) => {
    setServices((prev) => {
      const next = [...prev];
      const updated = { ...next[selected], [field]: value };
      if (field === 'title') updated.slug = slugify(value);
      next[selected] = updated;
      return next;
    });
  };

  if (loading) return <div className="text-gray-400">Loading services…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const current = selected !== null ? services[selected] : null;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex justify-end gap-2">
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
    <div className="flex gap-6 flex-1 min-h-0">
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <button
          onClick={handleAdd}
          className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Service
        </button>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          {services.map((svc, i) => (
            <button key={svc.id} onClick={() => setSelected(i)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 text-sm transition-colors ${
                selected === i ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-800'
              }`}>
              <div className="font-medium truncate">{svc.title}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {current ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{current.title}</h3>
              <button onClick={handleDelete}
                className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                Delete
              </button>
            </div>
            <Field label="Title" value={current.title || ''} onChange={(v) => update('title', v)} />
            <Field label="Slug" value={current.slug || ''} onChange={(v) => update('slug', v)} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Image</label>
              <ImageUpload
                accountId={profile.accountId}
                currentPath={current.thumbnail || ''}
                onUploaded={(path) => update('thumbnail', path)}
              />
            </div>
            <Field label="Excerpt" value={current.excerpt || ''} onChange={(v) => update('excerpt', v)} multiline rows={2} />
            <Field label="Content (HTML)" value={current.content || ''} onChange={(v) => update('content', v)} multiline rows={12} mono />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select a service to edit
          </div>
        )}
      </div>
    </div>
    <ChangeHistory
      accountId={profile.accountId}
      section="services"
      onUndone={handleUndone}
      open={showHistory}
      onClose={() => setShowHistory(false)}
    />
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows = 4, mono, placeholder }) {
  const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
          className={`${base} resize-none ${mono ? 'font-mono' : ''}`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
    </div>
  );
}
