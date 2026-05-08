import { useState, useEffect } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSection('locations')
      .then(({ content, sha }) => { setLocations(content); setSha(sha); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await saveSection('locations', locations, sha); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading locations...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const location = selected !== null ? locations[selected] : null;

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl overflow-y-auto">
        {locations.map((loc, i) => (
          <button
            key={loc.id}
            onClick={() => setSelected(i)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 text-sm transition-colors ${
              selected === i ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-800'
            }`}
          >
            {loc.title}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {location ? (
          <LocationEditor
            location={location}
            onChange={updated => {
              const next = [...locations];
              next[selected] = updated;
              setLocations(next);
            }}
            onSave={handleSave}
            saving={saving}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
            Select a location to edit
          </div>
        )}
      </div>
    </div>
  );
}

function LocationEditor({ location, onChange, onSave, saving }) {
  const meta = location.meta || {};
  const set = (field, value) => onChange({ ...location, meta: { ...meta, [field]: value } });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{location.title}</h3>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      <Field label="Phone" value={meta['ignyte_location_phone'] || ''} onChange={v => set('ignyte_location_phone', v)} />
      <Field label="Address" value={meta['ignyte_location_address'] || ''} onChange={v => set('ignyte_location_address', v)} />
      <Field label="Description" value={location.excerpt || ''} onChange={v => onChange({ ...location, excerpt: v })} multiline />
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      )}
    </div>
  );
}
