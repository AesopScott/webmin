import { useEffect, useState } from 'react';
import { fetchContactPage, saveContactPage } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';
import ChangeHistory from '../../components/ChangeHistory.jsx';

const EMPTY_CARD = { title: '', rows: [] };
const EMPTY_ROW = { label: '', value: '', href: '' };

export default function Contact() {
  const { profile } = useUser();
  const [data, setData] = useState({ cards: [] });
  const [sha, setSha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchContactPage(profile.accountId)
      .then(({ items, sha }) => {
        setData(items || { cards: [] });
        setSha(sha);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const updateCard = (index, patch) => {
    setData((current) => {
      const cards = [...(current.cards || [])];
      cards[index] = { ...cards[index], ...patch };
      return { ...current, cards };
    });
  };

  const updateRow = (cardIndex, rowIndex, patch) => {
    setData((current) => {
      const cards = [...(current.cards || [])];
      const card = { ...cards[cardIndex] };
      const rows = [...(card.rows || [])];
      rows[rowIndex] = { ...rows[rowIndex], ...patch };
      cards[cardIndex] = { ...card, rows };
      return { ...current, cards };
    });
  };

  const addCard = () => {
    setData((current) => ({ ...current, cards: [...(current.cards || []), { ...EMPTY_CARD }] }));
  };

  const removeCard = (index) => {
    setData((current) => ({
      ...current,
      cards: (current.cards || []).filter((_, i) => i !== index),
    }));
  };

  const addRow = (cardIndex) => {
    setData((current) => {
      const cards = [...(current.cards || [])];
      const card = { ...cards[cardIndex] };
      cards[cardIndex] = { ...card, rows: [...(card.rows || []), { ...EMPTY_ROW }] };
      return { ...current, cards };
    });
  };

  const removeRow = (cardIndex, rowIndex) => {
    setData((current) => {
      const cards = [...(current.cards || [])];
      const card = { ...cards[cardIndex] };
      cards[cardIndex] = {
        ...card,
        rows: (card.rows || []).filter((_, i) => i !== rowIndex),
      };
      return { ...current, cards };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveContactPage(profile.accountId, data, sha);
      if (result?.sha) setSha(result.sha);
      if (result?.items) setData(result.items);
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

  if (loading) return <div className="text-gray-400">Loading contact page...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contact Us</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit the cards shown at /contact/.</p>
        </div>
        <div className="flex gap-2">
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
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="space-y-4">
        {(data.cards || []).map((card, cardIndex) => (
          <div key={cardIndex} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Card {cardIndex + 1}</span>
              <button onClick={() => removeCard(cardIndex)} className="text-xs text-red-500 hover:text-red-700">
                Remove
              </button>
            </div>

            <Field
              label="Card title"
              value={card.title || ''}
              onChange={(value) => updateCard(cardIndex, { title: value })}
              placeholder="Administration"
            />

            <div className="space-y-3">
              {(card.rows || []).map((row, rowIndex) => (
                <div key={rowIndex} className="border border-gray-100 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">Detail {rowIndex + 1}</span>
                    <button onClick={() => removeRow(cardIndex, rowIndex)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="Label"
                      value={row.label || ''}
                      onChange={(value) => updateRow(cardIndex, rowIndex, { label: value })}
                      placeholder="Phone"
                    />
                    <Field
                      label="Value"
                      value={row.value || ''}
                      onChange={(value) => updateRow(cardIndex, rowIndex, { value })}
                      placeholder="(209) 373-2800"
                    />
                    <Field
                      label="Link"
                      value={row.href || ''}
                      onChange={(value) => updateRow(cardIndex, rowIndex, { href: value })}
                      placeholder="tel:2093732800"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => addRow(cardIndex)}
                className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add detail
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addCard}
        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add contact card
      </button>

      <ChangeHistory
        accountId={profile.accountId}
        section="contact"
        onUndone={handleUndone}
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
