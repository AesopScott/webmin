import { useRef, useState } from 'react';
import { uploadImage } from '../lib/api.js';

const MAX_BYTES = 900_000; // ~900KB — stay under GitHub's 1MB API limit

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageUpload({ accountId, currentPath, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError(`Image too large (${(file.size / 1024).toFixed(0)} KB). Max ~900 KB.`);
      return;
    }

    setError('');
    setUploading(true);
    try {
      const content = await fileToBase64(file);
      const result = await uploadImage(accountId, file.name, content);
      onUploaded(result.path);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        {currentPath && (
          <img
            src={`https://cmcenters.org${currentPath}`}
            alt=""
            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : currentPath ? 'Replace image' : 'Upload image'}
        </button>
        {currentPath && (
          <span className="text-xs text-gray-400 truncate max-w-xs">{currentPath}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
