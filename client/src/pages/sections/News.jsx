import { useState, useEffect, useRef } from 'react';
import { fetchSection, saveSection } from '../../lib/api.js';
import { useUser } from '../../contexts/UserContext.jsx';

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function newPost() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return {
    id: Date.now(),
    slug: '',
    title: 'New Post',
    url: '',
    date: now,
    modified: now,
    excerpt: '',
    content: '',
    thumbnail: '',
    meta: {},
    terms: { category: [] },
  };
}

export default function News() {
  const { profile } = useUser();
  const [posts, setPosts] = useState([]);
  const [sha, setSha] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile?.accountId) return;
    fetchSection(profile.accountId, 'posts')
      .then(({ items, sha }) => { setPosts(items); setSha(sha); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.accountId]);

  const filtered = posts.filter((p) =>
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveSection(profile.accountId, 'posts', posts, sha);
      if (result?.sha) setSha(result.sha);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const post = newPost();
    const next = [post, ...posts];
    setPosts(next);
    setSelected(0);
    setSearch('');
  };

  const handleDelete = () => {
    if (selected === null) return;
    if (!confirm('Delete this post?')) return;
    const next = posts.filter((_, i) => i !== selected);
    setPosts(next);
    setSelected(null);
  };

  const update = (field, value) => {
    setPosts((prev) => {
      const next = [...prev];
      const updated = { ...next[selected], [field]: value };
      if (field === 'title') updated.slug = slugify(value);
      next[selected] = updated;
      return next;
    });
  };

  const updateCategory = (value) => {
    const cats = value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    setPosts((prev) => {
      const next = [...prev];
      next[selected] = {
        ...next[selected],
        terms: { ...next[selected].terms, category: cats },
      };
      return next;
    });
  };

  const [listWidth, setListWidth] = useState(432);
  const dragStart = useRef(null);
  const dragStartWidth = useRef(null);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragStart.current === null) return;
      const delta = e.clientX - dragStart.current;
      setListWidth(Math.min(Math.max(200, dragStartWidth.current + delta), 700));
    };
    const onMouseUp = () => { dragStart.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const startDrag = (e) => {
    dragStart.current = e.clientX;
    dragStartWidth.current = listWidth;
  };

  if (loading) return <div className="text-gray-400">Loading posts…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const current = selected !== null ? posts[selected] : null;

  return (
    <div className="flex h-full">
      <div style={{ width: listWidth }} className="shrink-0 flex flex-col gap-3 pr-3">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search posts…"
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
          {filtered.map((post) => {
            const idx = posts.indexOf(post);
            return (
              <button key={post.id} onClick={() => setSelected(idx)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 text-sm transition-colors ${
                  selected === idx ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-800'
                }`}>
                <div className="font-medium truncate">{post.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{post.date?.slice(0, 10)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        onMouseDown={startDrag}
        className="w-1.5 shrink-0 cursor-col-resize rounded bg-gray-200 hover:bg-blue-400 transition-colors mx-1"
      />

      <div className="flex-1 overflow-y-auto pl-3">
        {current ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 truncate pr-4">{current.title}</h3>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleDelete}
                  className="px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                  Delete
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
            <Field label="Title" value={current.title || ''} onChange={(v) => update('title', v)} />
            <Field label="Slug" value={current.slug || ''} onChange={(v) => update('slug', v)} />
            <Field label="Date" value={current.date || ''} onChange={(v) => update('date', v)} placeholder="2024-04-17 19:11:08" />
            <Field label="Thumbnail path" value={current.thumbnail || ''} onChange={(v) => update('thumbnail', v)} placeholder="/img/filename.jpg" />
            <Field
              label="Categories (comma-separated)"
              value={(current.terms?.category || []).join(', ')}
              onChange={updateCategory}
              placeholder="PATIENT STORIES, NEWS"
            />
            <Field label="Excerpt" value={current.excerpt || ''} onChange={(v) => update('excerpt', v)} multiline rows={3} />
            <Field label="Content (HTML)" value={current.content || ''} onChange={(v) => update('content', v)} multiline rows={16} mono />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select a post to edit
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows = 4, mono, placeholder }) {
  const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
            className={`${base} resize-y ${mono ? 'font-mono' : ''}`} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      }
    </div>
  );
}
