import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../contexts/UserContext.jsx';
import { getHtmlFiles, getHtmlFile, saveHtmlFile, fetchSettings } from '../lib/api.js';

// -- File tree helpers ---------------------------------------------------------

function buildTree(files) {
  const root = {};
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node[dir]) node[dir] = { __files: [] };
      node = node[dir];
    }
    if (!node.__files) node.__files = [];
    node.__files.push(file);
  }
  return root;
}

function FileTree({ node, depth = 0, selectedPath, onSelect, search }) {
  const indent = depth * 12;
  const dirs = Object.keys(node).filter((k) => k !== '__files').sort();
  const files = (node.__files || []).filter(
    (f) => !search || f.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {dirs.map((dir) => (
        <FolderNode
          key={dir}
          name={dir}
          node={node[dir]}
          depth={depth}
          selectedPath={selectedPath}
          onSelect={onSelect}
          search={search}
        />
      ))}
      {files.map((file) => (
        <button
          key={file.path}
          onClick={() => onSelect(file.path)}
          title={file.path}
          style={{ paddingLeft: indent + 8 }}
          className={`w-full text-left py-1.5 pr-3 text-xs truncate transition-colors rounded ${
            selectedPath === file.path
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="mr-1 opacity-50">F</span>
          {file.path.split('/').pop()}
        </button>
      ))}
    </>
  );
}

function FolderNode({ name, node, depth, selectedPath, onSelect, search }) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 12;
  const hasMatch =
    !search || JSON.stringify(node).toLowerCase().includes(search.toLowerCase());
  if (!hasMatch) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ paddingLeft: indent + 4 }}
        className="w-full text-left py-1.5 pr-3 text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1"
      >
        <span>{open ? 'v' : '>'}</span>
        {name}/
      </button>
      {open && (
        <FileTree
          node={node}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          search={search}
        />
      )}
    </div>
  );
}

// -- Visual Astro editing helpers ---------------------------------------------

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function splitFrontmatter(source) {
  const normalized = normalizeLineEndings(source);
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return { frontmatter: '', body: normalized };
  return {
    frontmatter: match[0],
    body: normalized.slice(match[0].length),
  };
}

function extractStyleTags(source) {
  const styles = [];
  const withoutStyles = source.replace(/\n*<style\b[\s\S]*?<\/style>\s*/gi, (match) => {
    styles.push(match.trim());
    return '\n';
  });
  return { withoutStyles, styles: styles.join('\n') };
}

function hasAstroTemplateSyntax(fragment) {
  return /{[\s\S]*?}|<slot\b|<\/?[A-Z][A-Za-z0-9_.:-]*\b|set:[A-Za-z-]+=/.test(fragment);
}

function stripAstroForPreview(fragment) {
  return fragment
    .replace(/{[\s\S]*?}/g, '')
    .replace(/<\/?[A-Z][A-Za-z0-9_.:-]*\b[^>]*>/g, '')
    .replace(/<slot\b[^>]*\/?>/g, '')
    .trim();
}

function createAstroDocument(source) {
  const { frontmatter, body } = splitFrontmatter(source);
  const openMatch = body.match(/<Base\b[^>]*>/i);
  const closeIndex = body.lastIndexOf('</Base>');

  if (openMatch && closeIndex > openMatch.index) {
    const editableStart = openMatch.index + openMatch[0].length;
    const before = frontmatter + body.slice(0, editableStart);
    const inner = body.slice(editableStart, closeIndex);
    const after = body.slice(closeIndex);
    const { withoutStyles, styles } = extractStyleTags(inner);
    const afterStyles = extractStyleTags(after).styles;
    const fragment = withoutStyles.trim();
    const canEdit = !hasAstroTemplateSyntax(fragment);

    return {
      type: 'astro',
      canEdit,
      fragment: canEdit ? fragment : stripAstroForPreview(fragment),
      before,
      after,
      styles: [styles, afterStyles].filter(Boolean).join('\n'),
    };
  }

  const { withoutStyles, styles } = extractStyleTags(body);

  return {
    type: 'astro',
    canEdit: false,
    fragment: stripAstroForPreview(withoutStyles),
    before: source,
    after: '',
    styles,
  };
}

function buildPreviewDocument(fragment, styles, siteUrl, canEdit) {
  const base = siteUrl ? `<base href="${siteUrl.replace(/\/$/, '')}/">` : '';
  const readonlyStyle = canEdit ? '' : 'body{background:#f8fafc;color:#334155;}';
  const notice = canEdit
    ? ''
    : '<div class="webmin-readonly-note">This page is driven by templates or data. Use its section editor for content changes.</div>';

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  ${base}
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#111827;background:#fff;line-height:1.55;}
    a{color:#2563eb;text-decoration:underline;}
    img{max-width:100%;height:auto;}
    .webmin-readonly-note{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:14px;}
    ${readonlyStyle}
  </style>
  ${styles || ''}
</head>
<body>${notice}${fragment || ''}</body>
</html>`;
}

function serializeAstroDocument(doc, editedFragment) {
  const fragment = editedFragment.trim();
  return `${doc.before}\n\n${fragment}\n\n${doc.after.replace(/^\n+/, '')}`;
}

function isAstroPath(path) {
  return String(path || '').toLowerCase().endsWith('.astro');
}

// -- Main page ----------------------------------------------------------------

export default function HtmlEditor() {
  const { profile } = useUser();
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [fileError, setFileError] = useState('');
  const [search, setSearch] = useState('');
  const [siteUrl, setSiteUrl] = useState('');

  const [selectedPath, setSelectedPath] = useState(null);
  const [editorDoc, setEditorDoc] = useState(null);
  const [sha, setSha] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef(null);

  useEffect(() => {
    if (!profile?.accountId) return;
    Promise.all([
      getHtmlFiles(profile.accountId),
      fetchSettings(profile.accountId),
    ])
      .then(([{ files: f }, settings]) => {
        setFiles(f);
        setSiteUrl(settings.siteUrl || '');
      })
      .catch((err) => setFileError(err.message))
      .finally(() => setLoadingFiles(false));
  }, [profile?.accountId]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      doc.body.contentEditable = editorDoc?.canEdit ? 'true' : 'false';
      doc.body.spellcheck = true;
      doc.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (a) e.preventDefault();
      });
      if (editorDoc?.canEdit) {
        doc.addEventListener('input', () => setDirty(true));
      }
      setIframeReady(true);
    } catch (_) {}
  }, [editorDoc?.canEdit]);

  const loadFile = useCallback(async (path) => {
    if (!profile?.accountId) return;
    setLoadingFile(true);
    setSaveStatus('');
    setDirty(false);
    setIframeReady(false);
    try {
      const { content, sha: fileSha, path: returnedPath } = await getHtmlFile(profile.accountId, path);
      const resolvedPath = returnedPath || path;
      const doc = isAstroPath(resolvedPath)
        ? createAstroDocument(content)
        : { type: 'html', canEdit: true, fragment: content, before: '', after: '', styles: '' };

      setEditorDoc(doc);
      setSha(fileSha);
      setSelectedPath(resolvedPath);
    } catch (err) {
      setFileError(err.message);
    } finally {
      setLoadingFile(false);
    }
  }, [profile?.accountId]);

  const handleSelectFile = (path) => {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
    loadFile(path);
  };

  const handleSave = async () => {
    if (!iframeRef.current || !selectedPath || !sha || !editorDoc?.canEdit) return;
    setSaving(true);
    setSaveStatus('');
    try {
      const doc = iframeRef.current.contentDocument;
      const editedFragment = doc.body.innerHTML;
      const cleaned = editorDoc.type === 'astro'
        ? serializeAstroDocument(editorDoc, editedFragment)
        : editedFragment;
      const { sha: newSha } = await saveHtmlFile(profile.accountId, selectedPath, cleaned, sha);
      setSha(newSha);
      setEditorDoc(isAstroPath(selectedPath)
        ? createAstroDocument(cleaned)
        : { type: 'html', canEdit: true, fragment: cleaned, before: '', after: '', styles: '' });
      setDirty(false);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Admin access required.
      </div>
    );
  }

  const srcdoc = editorDoc
    ? buildPreviewDocument(editorDoc.fragment, editorDoc.styles, siteUrl, editorDoc.canEdit)
    : '';
  const tree = buildTree(files);

  return (
    <div className="flex flex-col h-full -m-8">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Page Editor</h1>
          {selectedPath && (
            <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedPath}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!siteUrl && selectedPath && (
            <span className="text-xs text-amber-500">Set Site URL in Settings for full preview</span>
          )}
          {saveStatus && (
            <span className={`text-xs ${saveStatus.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {saveStatus}
            </span>
          )}
          {dirty && !saving && (
            <span className="text-xs text-amber-500">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !selectedPath || !dirty || !iframeReady || !editorDoc?.canEdit}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : 'Save to GitHub'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-2 border-b border-gray-200">
            <input
              type="search"
              placeholder="Filter files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingFiles && <p className="text-xs text-gray-400 px-2 py-2">Loading files...</p>}
            {fileError && <p className="text-xs text-red-500 px-2 py-2">{fileError}</p>}
            {!loadingFiles && files.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-2">No editable page files found.</p>
            )}
            <FileTree
              node={tree}
              selectedPath={selectedPath}
              onSelect={handleSelectFile}
              search={search}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {loadingFile ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Loading...
            </div>
          ) : !selectedPath ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a page file from the left to begin editing
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={srcdoc}
              onLoad={handleIframeLoad}
              sandbox="allow-same-origin"
              title="Page editor"
              className="flex-1 w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
