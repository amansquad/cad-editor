import * as React from 'react';
import type { ToolMode } from '../App';

type Props = {
  tool: ToolMode;
  onChangeTool: (t: ToolMode) => void;
  selectionTarget: 'shape' | 'face' | 'edge';
  onChangeSelectionTarget: (t: 'shape' | 'face' | 'edge') => void;
};

export function Toolbar({ tool, onChangeTool, selectionTarget, onChangeSelectionTarget }: Props) {
  const makeBtn = (id: ToolMode, label: string) => (
    <button
      key={id}
      onClick={() => onChangeTool(id)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        background: tool === id ? '#eef' : 'transparent',
        border: 'none',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ padding: 12, borderBottom: '1px solid #ddd', fontWeight: 600 }}>Tools</div>
      {makeBtn('select', 'Select (1)')}
      {makeBtn('translate', 'Move (W)')}
      {makeBtn('rotate', 'Rotate (E)')}
      {makeBtn('scale', 'Scale (R)')}
      <div style={{ padding: 12, borderTop: '1px solid #ddd' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Selection Target</div>
        <select
          value={selectionTarget}
          onChange={(e) => onChangeSelectionTarget(e.target.value as any)}
          style={{ width: '100%', padding: '6px 8px' }}
        >
          <option value="shape">Shape</option>
          <option value="face">Face</option>
          <option value="edge">Edge</option>
        </select>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #ddd', fontWeight: 600 }}>Primitives</div>
      {makeBtn('create-box', 'Box (B)')}
      {makeBtn('create-sphere', 'Sphere (S)')}
      {makeBtn('create-cylinder', 'Cylinder (C)')}
      <div style={{ padding: 12, borderTop: '1px solid #ddd', fontWeight: 600 }}>Sketch</div>
      {makeBtn('sketch-rectangle', 'Rectangle (K)')}
      {makeBtn('sketch-circle', 'Circle (L)')}
      <div style={{ padding: 12, display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '8px 12px' }} onClick={() => {
          const ev = new CustomEvent('cad-extrude');
          window.dispatchEvent(ev);
        }}>Extrude (X)</button>
        <button style={{ flex: 1, padding: '8px 12px' }} onClick={() => {
          const ev = new CustomEvent('cad-clear-sketch');
          window.dispatchEvent(ev);
        }}>Clear Sketch (Del)</button>
      </div>
      <div style={{ padding: 12 }}>
        <button style={{ width: '100%', padding: '8px 12px' }} onClick={() => {
          const ev = new CustomEvent('cad-delete-selected');
          window.dispatchEvent(ev);
        }}>Delete Selected</button>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #ddd' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" defaultChecked onChange={(e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            window.dispatchEvent(new CustomEvent('cad-snap', { detail: { enabled, step: 0.1 } }));
          }} />
          <span style={{ fontSize: 13 }}>Snap to grid (0.1m)</span>
        </label>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #ddd' }}>
        <button style={{ width: '100%', padding: '8px 12px' }} onClick={() => {
          const ev = new CustomEvent('cad-export');
          window.dispatchEvent(ev);
        }}>Export JSON</button>
        
        <label style={{ display: 'block', marginTop: 8 }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Import JSON</span>
          <input type="file" accept="application/json" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const ev = new CustomEvent('cad-import', { detail: reader.result });
              window.dispatchEvent(ev);
            };
            reader.readAsText(file);
          }} />
        </label>
      </div>
    </div>
  );
}


