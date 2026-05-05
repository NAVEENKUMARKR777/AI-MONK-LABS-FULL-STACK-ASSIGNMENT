import { useState } from 'react';

export default function TagView({ node, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(node.name);

  const updateChild = (index, nextChild) => {
    if (nextChild === null) {
      const next = node.children.filter((_, i) => i !== index);
      onChange({ ...node, children: next });
      return;
    }
    const next = node.children.map((c, i) => (i === index ? nextChild : c));
    onChange({ ...node, children: next });
  };

  const handleAddChild = () => {
    const newChild = { name: 'New Child', data: 'Data' };
    if (Array.isArray(node.children)) {
      onChange({ ...node, children: [...node.children, newChild] });
    } else {
      // Replace data with children array containing one new child
      const { data, ...rest } = node;
      onChange({ ...rest, children: [newChild] });
    }
    setCollapsed(false);
  };

  const handleDataChange = (e) => {
    onChange({ ...node, data: e.target.value });
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      onChange({ ...node, name: trimmed });
    } else {
      setDraftName(node.name);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitName();
    } else if (e.key === 'Escape') {
      setDraftName(node.name);
      setEditingName(false);
    }
  };

  return (
    <div className="tag">
      <div className="tag-header">
        <button
          type="button"
          className="tag-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '>' : 'v'}
        </button>

        {editingName ? (
          <input
            className="tag-name-input"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={commitName}
          />
        ) : (
          <span
            className="tag-name"
            onClick={() => {
              setDraftName(node.name);
              setEditingName(true);
            }}
            title="Click to rename"
          >
            {node.name}
          </span>
        )}

        <button type="button" className="tag-add-child" onClick={handleAddChild}>
          Add Child
        </button>
      </div>

      {!collapsed && Array.isArray(node.children) && (
        <div className="tag-body">
          {node.children.map((child, idx) => (
            <TagView
              key={idx}
              node={child}
              onChange={(next) => updateChild(idx, next)}
            />
          ))}
        </div>
      )}

      {!collapsed && typeof node.data === 'string' && (
        <div className="tag-data-row">
          <label>Data</label>
          <input value={node.data} onChange={handleDataChange} />
        </div>
      )}
    </div>
  );
}
