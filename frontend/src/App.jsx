import { useEffect, useState } from 'react';
import TagView from './components/TagView.jsx';

const API_BASE = '/api';

const DEFAULT_TREE = {
  name: 'root',
  children: [
    {
      name: 'child1',
      children: [
        { name: 'child1-child1', data: 'c1-c1 Hello' },
        { name: 'child1-child2', data: 'c1-c2 JS' },
      ],
    },
    { name: 'child2', data: 'c2 World' },
  ],
};

// Recursively strip everything except name/children/data so the exported
// payload only contains the canonical tree shape.
function sanitize(node) {
  if (Array.isArray(node.children)) {
    return { name: node.name, children: node.children.map(sanitize) };
  }
  return { name: node.name, data: node.data ?? '' };
}

function TreeCard({ record, isNew, onChange, onSaved, onDelete }) {
  const [exported, setExported] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    const clean = sanitize(record.tree);
    const json = JSON.stringify(clean);
    setExported(json);
    setError('');
    setStatus('Saving...');

    try {
      const isExisting = typeof record.id === 'number';
      const url = isExisting ? `${API_BASE}/trees/${record.id}` : `${API_BASE}/trees`;
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: clean }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      setStatus(isExisting ? `Saved (id=${saved.id})` : `Created (id=${saved.id})`);
      onSaved(saved);
    } catch (err) {
      setError(`Save failed: ${err.message}`);
      setStatus('');
    }
  };

  const handleDelete = async () => {
    if (typeof record.id !== 'number') {
      onDelete();
      return;
    }
    if (!confirm('Delete this tree?')) return;
    try {
      const res = await fetch(`${API_BASE}/trees/${record.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      onDelete();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="tree-card">
      <div className="tree-card-header">
        <span>{isNew ? 'Unsaved tree' : `Tree #${record.id}`}</span>
        {!isNew && record.updated_at && (
          <span>Updated: {new Date(record.updated_at).toLocaleString()}</span>
        )}
      </div>

      <TagView node={record.tree} onChange={(next) => onChange({ ...record, tree: next })} />

      <div className="tree-actions">
        <button type="button" onClick={handleExport}>Export</button>
        <button type="button" className="delete-btn" onClick={handleDelete}>
          {isNew ? 'Discard' : 'Delete'}
        </button>
      </div>

      {status && <div className="status">{status}</div>}
      {error && <div className="status error">{error}</div>}
      {exported && <div className="export-output">{exported}</div>}
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchTrees = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/trees`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.length === 0) {
        setRecords([{ id: null, tree: DEFAULT_TREE }]);
      } else {
        setRecords(data);
      }
    } catch (err) {
      setLoadError(`Could not reach backend (${err.message}). Showing default tree.`);
      setRecords([{ id: null, tree: DEFAULT_TREE }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrees();
  }, []);

  const updateRecord = (idx, next) => {
    setRecords((rs) => rs.map((r, i) => (i === idx ? next : r)));
  };

  const replaceRecord = (idx, saved) => {
    setRecords((rs) => rs.map((r, i) => (i === idx ? saved : r)));
  };

  const removeRecord = (idx) => {
    setRecords((rs) => rs.filter((_, i) => i !== idx));
  };

  const addNewTree = () => {
    setRecords((rs) => [
      ...rs,
      { id: null, tree: { name: 'root', children: [{ name: 'New Child', data: 'Data' }] } },
    ]);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Nested Tags Tree</h1>
        <button type="button" onClick={addNewTree}>+ New Tree</button>
      </div>

      {loading && <div className="status">Loading trees...</div>}
      {loadError && <div className="status error">{loadError}</div>}

      {records.map((record, idx) => (
        <TreeCard
          key={record.id ?? `new-${idx}`}
          record={record}
          isNew={record.id == null}
          onChange={(next) => updateRecord(idx, next)}
          onSaved={(saved) => replaceRecord(idx, saved)}
          onDelete={() => removeRecord(idx)}
        />
      ))}

      {!loading && records.length === 0 && (
        <div className="status">No trees yet. Click "+ New Tree" to start.</div>
      )}
    </div>
  );
}
