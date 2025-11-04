import * as React from 'react';

type Props = {
  selection: any;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

export function PropertiesPanel({ selection }: Props) {
  if (!selection) return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Properties</div>
      <div>No selection</div>
    </div>
  );

  // shape
  if (selection.type === 'shape') {
    const p = selection.position || {};
    const r = selection.rotation || {};
    const s = selection.scale || {};
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Properties</div>
        <Row label="Name">{selection.name || selection.type}</Row>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#444' }}>Position</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input defaultValue={p.x} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, position: { x: isNaN(val) ? p.x : val } } }));
              }} />
              <input defaultValue={p.y} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, position: { y: isNaN(val) ? p.y : val } } }));
              }} />
              <input defaultValue={p.z} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, position: { z: isNaN(val) ? p.z : val } } }));
              }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#444' }}>Rotation</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input defaultValue={r.x} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, rotation: { x: isNaN(val) ? r.x : val } } }));
              }} />
              <input defaultValue={r.y} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, rotation: { y: isNaN(val) ? r.y : val } } }));
              }} />
              <input defaultValue={r.z} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, rotation: { z: isNaN(val) ? r.z : val } } }));
              }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#444' }}>Scale</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input defaultValue={s.x} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, scale: { x: isNaN(val) ? s.x : val } } }));
              }} />
              <input defaultValue={s.y} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, scale: { y: isNaN(val) ? s.y : val } } }));
              }} />
              <input defaultValue={s.z} type="number" step="0.01" onChange={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                window.dispatchEvent(new CustomEvent('cad-set-transform', { detail: { id: selection.id, scale: { z: isNaN(val) ? s.z : val } } }));
              }} />
            </div>
          </div>
        </div>
        <Row label="Type">{selection.kind || '-'}</Row>
      </div>
    );
  }

  if (selection.type === 'face') {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Face</div>
        <Row label="Area">{selection.area ? selection.area.toFixed?.(4) ?? selection.area : '-'}</Row>
        <Row label="Normal">{selection.normal ? `x:${selection.normal.x.toFixed(2)} y:${selection.normal.y.toFixed(2)} z:${selection.normal.z.toFixed(2)}` : '-'}</Row>
      </div>
    );
  }

  if (selection.type === 'edge') {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Edge</div>
        <Row label="Length">{selection.length ? (selection.length as number).toFixed?.(4) ?? selection.length : '-'}</Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Properties</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selection, null, 2)}</pre>
    </div>
  );
}


