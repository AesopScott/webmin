import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';

export default function Services() {
  const [services, setServices] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSection('services')
      .then(({ content, sha }) => { setServices(content); setSha(sha); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await saveSection('services', services, sha); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const update = (field, value) => {
    setServices(prev => {
      const next = [...prev];
      next[selected] = { ...next[selected], [field]: value };
      return next;
    });
  };

  if (loading) return <div className="text-gray-400">Loading services...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const current = selected !== null ? services[selected] : null;

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 overflow-y-auto space-y-1">
        {services.map((svc, i) => (
          <button
            key={svc.id}
            onClick={() => setSelected(i)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              selected === i ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className="font-medium truncate">{svc.title}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {current ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{current.title}</h3>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Publishing...' : 'Publish'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
              <textarea
                value={current.excerpt || ''}
                onChange={e => update('excerpt', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={current.content || ''}
                onChange={e => update('content', e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select a service to edit
          </div>
        )}
      </div>
    </div>
  );
}
