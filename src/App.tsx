import React, { useEffect, useState } from 'react';
import { Canvas3D } from '@/components/Canvas3D';
import { Toolbar } from '@/components/Toolbar';
import { PropertiesPanel } from '@/components/PropertiesPanel';

export type ToolMode =
  | 'select'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'create-box'
  | 'create-sphere'
  | 'create-cylinder'
  | 'sketch-rectangle'
  | 'sketch-circle';

export default function App() {
  const [tool, setTool] = useState<ToolMode>('select');
  const [selectionInfo, setSelectionInfo] = useState<any>(null);
  const [selectionTarget, setSelectionTarget] = useState<'shape' | 'face' | 'edge'>('shape');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === '1') { setTool('select'); }
      else if (k === 'w') { setTool('translate'); }
      else if (k === 'e') { setTool('rotate'); }
      else if (k === 'r') { setTool('scale'); }
      else if (k === 'b') { setTool('create-box'); }
      else if (k === 's') { setTool('create-sphere'); }
      else if (k === 'c') { setTool('create-cylinder'); }
      else if (k === 'k') { setTool('sketch-rectangle'); }
      else if (k === 'l') { setTool('sketch-circle'); }
      else if (k === 'x') { window.dispatchEvent(new CustomEvent('cad-extrude')); }
      else if (k === 'delete' || k === 'backspace') { window.dispatchEvent(new CustomEvent('cad-clear-sketch')); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', height: '100vh' }}>
      <div style={{ borderRight: '1px solid #ddd' }}>
        <Toolbar
          tool={tool}
          onChangeTool={setTool}
          selectionTarget={selectionTarget}
          onChangeSelectionTarget={setSelectionTarget}
        />
      </div>
      <div>
        <Canvas3D tool={tool} selectionTarget={selectionTarget} onSelectionChange={setSelectionInfo} />
      </div>
      <div style={{ borderLeft: '1px solid #ddd' }}>
        <PropertiesPanel selection={selectionInfo} />
      </div>
    </div>
  );
}

