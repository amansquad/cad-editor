import * as React from 'react';
const useEffect = React.useEffect;
const useRef = React.useRef;
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import type { ToolMode } from '../App';

type Props = {
  tool: ToolMode;
  selectionTarget: 'shape' | 'face' | 'edge';
  onSelectionChange: (info: any) => void;
};

export function Canvas3D({ tool, selectionTarget, onSelectionChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionCbRef = useRef(onSelectionChange);
  useEffect(() => { selectionCbRef.current = onSelectionChange; }, [onSelectionChange]);
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const selectionTargetRef = useRef(selectionTarget);
  useEffect(() => { selectionTargetRef.current = selectionTarget; }, [selectionTarget]);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    transform: TransformControls;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    grid: THREE.GridHelper;
    axes: THREE.AxesHelper;
    selection: {
      object: THREE.Object3D | null;
      type: 'shape' | 'face' | 'edge' | null;
      faceIndex?: number;
    };
    highlight: THREE.Object3D | null;
    snapEnabled?: boolean;
    snapStep?: number;
  history?: Array<any>;
  historyIndex?: number;
    sketch: {
      active: boolean;
      mode: 'rectangle' | 'circle' | null;
      start?: THREE.Vector3;
      preview?: THREE.Object3D;
      shapeData?: any;
      previews?: Array<{ preview: THREE.Object3D; shapeData: any }>;
    };
    lastPointerDownAt?: number;
    justCreated?: boolean;
    downOnCanvas?: boolean;
    _pendingDrag?: any;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(6, 6, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.enabled = false;
      transform.addEventListener('dragging-changed', (e: any) => {
        orbit.enabled = !e.value;
      });
      // Debug and interaction events to capture rotate/scale/translate operations
      // We'll record drag start state and push changes into history on objectChange
      (transform as any).addEventListener('mouseDown', () => {
        try { console.debug('[cad] transform: mouseDown'); } catch {}
        if (!threeRef.current) return;
        const sel = threeRef.current.selection;
        if (sel && sel.object) {
          const o: any = sel.object;
          threeRef.current!._pendingDrag = {
            id: (o.userData && o.userData.id) || o.uuid,
            before: {
              position: o.position.toArray(),
              rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
              scale: o.scale.toArray(),
            },
          };
        }
      });
      (transform as any).addEventListener('mouseUp', () => {
        try { console.debug('[cad] transform: mouseUp'); } catch {}
        // cleanup pending drag if still present
        if (threeRef.current && (threeRef.current as any)._pendingDrag) {
          delete (threeRef.current as any)._pendingDrag;
        }
      });
      (transform as any).addEventListener('objectChange', () => {
        try { console.debug('[cad] transform: objectChange'); } catch {}
        if (!threeRef.current) return;
        const pending = (threeRef.current as any)._pendingDrag;
        // find attached object
        const obj = (transform as any).object as THREE.Object3D | undefined;
        if (!obj) return;
        const id = (obj as any).userData?.id || obj.uuid;
        const entry = {
          id,
          position: obj.position.toArray(),
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: obj.scale.toArray(),
        };
        // If we had a pending drag with a before state, push that before state first
        if (pending && pending.id === id && pending.before) {
          pushHistory({ id, position: pending.before.position, rotation: pending.before.rotation, scale: pending.before.scale });
          // then push the after state
          pushHistory(entry);
          // reset pending drag
          delete (threeRef.current as any)._pendingDrag;
        } else {
          // no pending recorded (e.g., programmatic transform) - just push current
          pushHistory(entry);
        }
        // update selection callback with new values
        if (threeRef.current.selection && threeRef.current.selection.object === obj) {
          selectionCbRef.current(buildSelectionInfo(obj, threeRef.current.selection.type || 'shape'));
        }
      });
      (transform as any).addEventListener('change', () => {
        try { /* keep console quiet normally */ } catch {}
      });
    // Default space and size for visibility
    const modeNow = (toolRef.current as any) || 'translate';
    const space = (modeNow === 'rotate' || modeNow === 'scale') ? 'local' : 'world';
    transform.setSpace(space);
  transform.setSize(1.2);
    // TransformControls may not itself be a direct THREE.Object3D in some builds.
    // Prefer adding its helper root (getHelper()) if present, otherwise add the object if it's an Object3D.
    let _transformAddedRoot: any = null;
    try {
      if (typeof (transform as any).getHelper === 'function') {
        const helper = (transform as any).getHelper();
        if (helper && (helper as any).isObject3D !== false) {
          scene.add(helper as unknown as THREE.Object3D);
          _transformAddedRoot = helper;
        }
      }
    } catch {}
    if (!_transformAddedRoot) {
      try {
        // fallback: if transform itself looks like an Object3D, add it
        if ((transform as any) && typeof (transform as any).add === 'function') {
          scene.add(transform as unknown as THREE.Object3D);
          _transformAddedRoot = transform;
        }
      } catch (err) {
        console.warn('[cad] failed to add transform to scene', err, transform);
      }
    }
    // Ensure gizmo materials render on top and are visible
    const applyTransformAppearance = (t: any) => {
      try {
        if (!t) {
          console.warn('[cad] applyTransformAppearance: no object passed');
          return;
        }
        // If this is a TransformControls instance, prefer its helper root
        try {
          if (typeof t.getHelper === 'function') {
            const helper = t.getHelper();
            if (helper) {
              if (typeof helper.traverse === 'function') {
                helper.traverse((o: any) => {
                  if (o && o.material) {
                    try { o.material.depthTest = false; } catch {}
                    try { o.material.needsUpdate = true; } catch {}
                  }
                  try { if (o) o.renderOrder = 1000; } catch {}
                });
                return;
              }
              // fallback to children on helper
              if (Array.isArray(helper.children) && helper.children.length) {
                const stack = [helper];
                while (stack.length) {
                  const node: any = stack.pop();
                  if (!node) continue;
                  if (node.material) {
                    try { node.material.depthTest = false; } catch {}
                    try { node.material.needsUpdate = true; } catch {}
                  }
                  try { node.renderOrder = 1000; } catch {}
                  if (Array.isArray(node.children) && node.children.length) stack.push(...node.children);
                }
                return;
              }
            }
          }
        } catch (err) {
          // non-fatal
        }
        // Prefer traverse if available on the passed object
        if (typeof t.traverse === 'function') {
          t.traverse((o: any) => {
            if (o && o.material) {
              try { o.material.depthTest = false; } catch {}
              try { o.material.needsUpdate = true; } catch {}
            }
            try { if (o) o.renderOrder = 1000; } catch {}
          });
          return;
        }
        // Fallback: iterate children recursively if children present
        if (Array.isArray(t.children) && t.children.length) {
          const stack = [t];
          while (stack.length) {
            const node: any = stack.pop();
            if (!node) continue;
            if (node.material) {
              try { node.material.depthTest = false; } catch {}
              try { node.material.needsUpdate = true; } catch {}
            }
            try { node.renderOrder = 1000; } catch {}
            if (Array.isArray(node.children) && node.children.length) stack.push(...node.children);
          }
          return;
        }
        // Finally, attempt property scan to find nested Object3D-like objects
        const seen = new Set<any>();
        const stackProps: any[] = [t];
        while (stackProps.length) {
          const node = stackProps.pop();
          if (!node || seen.has(node)) continue;
          seen.add(node);
          if (node.material) {
            try { node.material.depthTest = false; } catch {}
            try { node.material.needsUpdate = true; } catch {}
          }
          try { node.renderOrder = 1000; } catch {}
          if (Array.isArray(node.children) && node.children.length) stackProps.push(...node.children);
          try {
            for (const k of Object.keys(node)) {
              try {
                const v = (node as any)[k];
                if (!v || typeof v !== 'object') continue;
                if (v.material || Array.isArray(v.children) || typeof v.traverse === 'function') stackProps.push(v);
                if (Array.isArray(v)) for (const it of v) if (it && typeof it === 'object') stackProps.push(it);
              } catch {}
            }
          } catch {}
        }
        try { console.warn('[cad] applyTransformAppearance: scanned properties; cannot find traverse/children, typeof=', typeof t, 'constructor=', t && t.constructor && t.constructor.name); } catch {}
      } catch (err) { console.warn('[cad] applyTransformAppearance failed', err); }
    };
    try { applyTransformAppearance(transform); } catch {}

    const grid = new THREE.GridHelper(100, 100, 0xcccccc, 0xeeeeee);
    grid.position.y = 0;
    scene.add(grid);
    const axes = new THREE.AxesHelper(2);
    scene.add(axes);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    threeRef.current = {
      renderer,
      scene,
      camera,
      orbit,
      transform,
      raycaster,
      mouse,
      grid,
      axes,
      selection: { object: null, type: null },
      highlight: null,
  sketch: { active: false, mode: null, previews: [] },
      // snapping defaults
      snapEnabled: true,
      snapStep: 0.1,
      lastPointerDownAt: 0,
      justCreated: false,
      downOnCanvas: false,
      // simple undo/redo stacks
      history: [],
      historyIndex: -1,
      _pendingDrag: undefined,
    };

  // Expose core objects for debugging in the browser console
  try { (window as any).__cad = { scene, camera, renderer, orbit, transform }; } catch {}

    // history helpers
    const pushHistory = (entry: any) => {
      if (!threeRef.current) return;
      const h = threeRef.current;
      const hi = h.historyIndex ?? -1;
      const hist = h.history || [];
      // cut off any redo entries
      hist.splice(hi + 1);
      hist.push(entry);
      h.history = hist;
      h.historyIndex = hi + 1;
    };
    const undo = () => {
      if (!threeRef.current) return;
      const h = threeRef.current;
      const idx = (h.historyIndex || -1) - 1;
      if (idx < 0) return;
      const entry = (h.history || [])[idx];
      if (!entry) return;
      // find object and apply previous state
      let found: any = null;
      h.scene.traverse((o: any) => { if (!found && o.userData && o.userData.id === entry.id) found = o; });
      if (found) {
        found.position.fromArray(entry.position);
        found.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2]);
        found.scale.fromArray(entry.scale);
        h.historyIndex = idx;
        if (h.selection && h.selection.object === found) selectionCbRef.current(buildSelectionInfo(found, h.selection.type || 'shape'));
      }
    };
  // Undo is available via Ctrl+Z; keep local helper removed from global event wiring
    const redo = () => {
      if (!threeRef.current) return;
      const h = threeRef.current;
      const idx = (h.historyIndex || -1) + 1;
      if (idx >= (h.history || []).length) return;
      const entry = (h.history || [])[idx];
      if (!entry) return;
      let found: any = null;
      h.scene.traverse((o: any) => { if (!found && o.userData && o.userData.id === entry.id) found = o; });
      if (found) {
        found.position.fromArray(entry.position);
        found.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2]);
        found.scale.fromArray(entry.scale);
        h.historyIndex = idx;
        if (h.selection && h.selection.object === found) selectionCbRef.current(buildSelectionInfo(found, h.selection.type || 'shape'));
      }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.ctrlKey && ev.key.toLowerCase() === 'z') { undo(); }
      if (ev.ctrlKey && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) { redo(); }
    };
    window.addEventListener('keydown', onKeyDown as any);

    const onResize = () => {
      if (!threeRef.current) return;
      const { camera, renderer } = threeRef.current;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!threeRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      handleSketchMove();
    };
    function snap(v: number) {
      if (!threeRef.current) return v;
      if (!threeRef.current.snapEnabled) return v;
      const step = threeRef.current.snapStep || 0.1;
      return Math.round(v / step) * step;
    }
    const onSnapEvent = (e: any) => {
      if (!threeRef.current) return;
      if (typeof e.detail === 'boolean') {
        threeRef.current.snapEnabled = e.detail;
      } else if (e.detail && typeof e.detail.enabled === 'boolean') {
        threeRef.current.snapEnabled = e.detail.enabled;
        if (typeof e.detail.step === 'number') threeRef.current.snapStep = e.detail.step;
      }
    };
    window.addEventListener('cad-snap', onSnapEvent as any);
    function rayToPlaneXZ(): THREE.Vector3 | null {
      if (!threeRef.current) return null;
      const { camera, raycaster, mouse } = threeRef.current;
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, pt);
      return pt;
    }
  function handleSketchMove() {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      if (!ctx.sketch.active || !ctx.sketch.mode || !ctx.sketch.start) return;
      const p = rayToPlaneXZ();
      if (!p) return;
      const sp = ctx.sketch.start;
      const x = snap(p.x), z = snap(p.z);
      const sx = snap(sp.x), sz = snap(sp.z);
      if (ctx.sketch.preview) {
        // move existing preview into previews array so it stays visible
        try {
          const prev = ctx.sketch.preview;
          const sdat = ctx.sketch.shapeData;
          // clone geometry and material so the saved preview doesn't get mutated by later updates
          try {
            if ((prev as any).geometry && (prev as any).geometry.clone) {
              (prev as any).geometry = (prev as any).geometry.clone();
            }
            if ((prev as any).material && (prev as any).material.clone) {
              (prev as any).material = (prev as any).material.clone();
            }
          } catch {}
          if (!ctx.sketch.previews) ctx.sketch.previews = [];
          ctx.sketch.previews.push({ preview: prev, shapeData: sdat });
        } catch (err) { console.warn('[cad] save preview failed', err); }
      }
      if (ctx.sketch.mode === 'rectangle') {
        const shape = new THREE.Shape();
        shape.moveTo(sx, sz);
        shape.lineTo(x, sz);
        shape.lineTo(x, z);
        shape.lineTo(sx, z);
        shape.closePath();
  const pts = shape.getPoints(32).map((pt: { x: number; y: number }) => new THREE.Vector3(pt.x, 0.01, pt.y));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x5555ff });
        mat.depthTest = false;
        const line = new THREE.LineLoop(geo, mat);
        (line as any).userData = { helper: true };
        line.renderOrder = 998;
        ctx.scene.add(line);
        ctx.sketch.preview = line;
        ctx.sketch.shapeData = { type: 'rectangle', shape: shape.toJSON() };
      } else if (ctx.sketch.mode === 'circle') {
        const center = new THREE.Vector2(sx, sz);
        const r = Math.max(0.01, center.distanceTo(new THREE.Vector2(x, z)));
        const shape = new THREE.Shape();
        shape.absarc(sx, sz, r, 0, Math.PI * 2, false);
  const pts = new THREE.Path().absarc(sx, sz, r, 0, Math.PI * 2, false).getSpacedPoints(64).map((pt: { x: number; y: number }) => new THREE.Vector3(pt.x, 0.01, pt.y));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x55aa55 });
        mat.depthTest = false;
        const line = new THREE.LineLoop(geo, mat);
        (line as any).userData = { helper: true };
        line.renderOrder = 998;
        ctx.scene.add(line);
        ctx.sketch.preview = line;
        ctx.sketch.shapeData = { type: 'circle', shape: shape.toJSON() };
      }
    }
    const onPointerDown = (ev: PointerEvent) => {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      // update mouse from event to ensure correct ray even without prior move
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const now = performance.now();
      ctx.lastPointerDownAt = now;
      ctx.downOnCanvas = true;
  // Debug: log pointer down coords
  try { console.debug('[cad] pointerdown', ev.clientX, ev.clientY); } catch {}
  // Creation mode: place primitives where you click on the grid
      const toolNow = toolRef.current;
      if (toolNow === 'create-box' || toolNow === 'create-sphere' || toolNow === 'create-cylinder') {
        // Do not create if clicking on an existing pickable object (prevents duplicates when clicking shapes)
        raycaster.setFromCamera(mouse, camera);
        const preHits = raycaster
          .intersectObjects(ctx.scene.children, true)
          .filter(i => i.object.userData?.pickable && !i.object.userData?.helper);
        if (preHits.length > 0) {
          return; // clicking an existing shape; skip creation
        }
        const p = rayToPlaneXZ();
        if (!p) return;
        const x = snap(p.x), z = snap(p.z);
        if (toolNow === 'create-box') {
          const w = 1, h = 1, d = 1;
          const geo = new THREE.BoxGeometry(w, h, d);
          const mat = new THREE.MeshStandardMaterial({ color: 0x77aaff, metalness: 0.0, roughness: 0.8 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x + w/2, h/2, z + d/2);
          mesh.userData.pickable = true;
          mesh.userData.kind = 'box';
          mesh.userData.id = mesh.uuid;
          mesh.userData.params = { w, h, d };
          ctx.scene.add(mesh);
          addEdges(mesh);
          ctx.justCreated = true;
          return;
        }
        if (toolNow === 'create-sphere') {
          const r = 0.6;
          const geo = new THREE.SphereGeometry(r, 32, 16);
          const mat = new THREE.MeshStandardMaterial({ color: 0xaaff77, metalness: 0.0, roughness: 0.9 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, r, z);
          mesh.userData.pickable = true;
          mesh.userData.kind = 'sphere';
          mesh.userData.id = mesh.uuid;
          mesh.userData.params = { r };
          ctx.scene.add(mesh);
          addEdges(mesh);
          ctx.justCreated = true;
          return;
        }
        if (toolNow === 'create-cylinder') {
          const r = 0.5, h = 1.2;
          const geo = new THREE.CylinderGeometry(r, r, h, 24);
          const mat = new THREE.MeshStandardMaterial({ color: 0xffaa77, metalness: 0.0, roughness: 0.9 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, h/2, z);
          mesh.userData.pickable = true;
          mesh.userData.kind = 'cylinder';
          mesh.userData.id = mesh.uuid;
          mesh.userData.params = { r, h };
          ctx.scene.add(mesh);
          addEdges(mesh);
          ctx.justCreated = true;
          return;
        }
      }
      if (toolNow === 'sketch-rectangle' || toolNow === 'sketch-circle') {
        const p = rayToPlaneXZ();
        if (!p) return;
        ctx.sketch.active = true;
        ctx.sketch.mode = toolNow === 'sketch-rectangle' ? 'rectangle' : 'circle';
        ctx.sketch.start = new THREE.Vector3(p.x, 0, p.z);
      }
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      // update mouse from event for selection ray
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      if (ctx.sketch.active) {
        ctx.sketch.active = false;
        // keep preview visible; do not clear
        ctx.downOnCanvas = false;
        return;
      } else {
        // if we just created a primitive on pointerdown, skip selection on this pointerup
        if (ctx.justCreated) {
          ctx.justCreated = false;
          ctx.downOnCanvas = false;
          return;
        }
        handleSelectClick();
        ctx.downOnCanvas = false;
      }
    };
    function clearAnyHighlight() {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      if (ctx.highlight) {
        ctx.scene.remove(ctx.highlight);
        ctx.highlight = null;
      }
    }
    function findPickable(obj: THREE.Object3D | null): THREE.Object3D | null {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if ((cur as any).userData && (cur as any).userData.pickable) return cur;
        cur = cur.parent as any;
      }
      return null;
    }
    function isTransformChild(obj: THREE.Object3D, transformRoot: any) {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (cur === transformRoot) return true;
        cur = cur.parent as any;
      }
      return false;
    }
    function handleSelectClick() {
      if (!threeRef.current) return;
      const { scene, camera, raycaster, mouse, transform } = threeRef.current;
      raycaster.setFromCamera(mouse, camera);
      // Filter out helper objects and invisible objects to get meaningful hits
      const raw = raycaster.intersectObjects(scene.children, true);
      const intersects = raw.filter((i: any) => {
        try {
          if (!i.object) return false;
          // ignore helper visuals
          if (i.object.userData && i.object.userData.helper) return false;
          // ignore invisible
          if (i.object.visible === false) return false;
          return true;
        } catch { return false; }
      });
      try {
        console.debug('[cad] select click mouse', mouse.x.toFixed(3), mouse.y.toFixed(3), 'hits', intersects.length);
        for (const h of intersects.slice(0,5)) {
          try { console.debug('[cad] hit object', h.object.type, (h.object as any).userData?.kind, (h.object as any).userData?.id || h.object.uuid); } catch {}
        }
      } catch {}
      const selectionTargetNow = selectionTargetRef.current;
      if (selectionTargetNow === 'edge') {
        // prefer intersects that are LineSegments or have edgeOf metadata
        const hitEdge = intersects.find(i => (i.object.type === 'LineSegments' || (i.object.userData && i.object.userData.edgeOf)));
        if (hitEdge) {
          const edgeParent = hitEdge.object.userData?.edgeOf || (hitEdge.object.parent ? hitEdge.object.parent : null);
          const info = edgeInfoFromIntersection(hitEdge);
          if (edgeParent) selectObject(edgeParent, 'edge');
          // highlight as red segment (use world-space endpoints)
          clearAnyHighlight();
          const lineGeom = new THREE.BufferGeometry().setFromPoints([info.a, info.b]);
          const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 2 }));
          line.renderOrder = 999;
          (line as any).material.depthTest = false;
          threeRef.current!.highlight = line;
          scene.add(line);
          selectionCbRef.current({ type: 'edge', length: info.length, id: edgeParent?.userData?.id || edgeParent?.uuid, kind: edgeParent?.userData?.kind });
          return;
        }
      }
      if (selectionTargetNow === 'face') {
        // prefer mesh hits with face info
        const hitFace = intersects.find(i => (i.object as any).isMesh && i.face);
        if (hitFace) {
          const faceProps = faceInfoFromIntersection(hitFace) as any;
          selectObject(hitFace.object, 'face');
          // highlight as translucent triangle using world-space vertices
          clearAnyHighlight();
          const a = (faceProps.a as THREE.Vector3);
          const b = (faceProps.b as THREE.Vector3);
          const c = (faceProps.c as THREE.Vector3);
          const triGeom = new THREE.BufferGeometry().setFromPoints([a, b, c]);
          triGeom.setIndex([0,1,2]);
          triGeom.computeVertexNormals();
          const triMat = new THREE.MeshBasicMaterial({ color: 0x33aaff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthTest: false });
          const tri = new THREE.Mesh(triGeom, triMat);
          tri.renderOrder = 999;
          tri.matrixAutoUpdate = false;
          threeRef.current!.highlight = tri;
          scene.add(tri);
          selectionCbRef.current({ type: 'face', normal: faceProps.normal, area: faceProps.area, id: (hitFace.object as any).userData?.id || (hitFace.object as any).uuid, kind: (hitFace.object as any).userData?.kind });
          return;
        }
      }
      const hit = intersects.find(i => findPickable(i.object));
      if (hit) {
        const obj = findPickable(hit.object)!;
        selectObject(obj, 'shape');
        // shape highlight: box helper
        clearAnyHighlight();
        const helper = new THREE.BoxHelper(obj as THREE.Object3D, 0x00aaee);
        const hm = (helper.material as THREE.LineBasicMaterial);
        hm.depthTest = false;
        helper.renderOrder = 999;
        threeRef.current!.highlight = helper;
        scene.add(helper);
      selectionCbRef.current(buildSelectionInfo(obj, 'shape'));
      } else {
        clearSelection();
      }
      function selectObject(obj: THREE.Object3D, type: 'shape' | 'face' | 'edge') {
          threeRef.current!.selection = { object: obj, type };
          (obj as any).visible = true;
          // Ensure the object is part of the current scene graph. If not, try to resolve by id/uuid.
          const resolveInScene = (candidate: THREE.Object3D) => {
            if (!threeRef.current) return null;
            let cur: THREE.Object3D | null = candidate;
            while (cur) {
              if (cur === threeRef.current.scene) return candidate;
              cur = cur.parent as any;
            }
            // try to find by userData.id or uuid
            let found: THREE.Object3D | null = null;
            threeRef.current.scene.traverse((o: any) => {
              if (found) return;
              if (o === candidate) found = o;
              else if (candidate && (candidate as any).userData && (candidate as any).userData.id && o.userData && o.userData.id === (candidate as any).userData.id) found = o;
              else if (o.uuid === (candidate as any).uuid) found = o;
            });
            return found;
          };
        try {
          console.debug('[cad] selectObject: attaching transform to', (obj as any).userData?.id || obj.uuid, 'kind', (obj as any).userData?.kind);
        } catch {}
        // attach only if object is in the scene; otherwise resolve a scene instance
        try {
          const toAttach = resolveInScene(obj);
          if (toAttach) {
            (transform as any).attach(toAttach as THREE.Object3D);
          } else {
            console.warn('[cad] selectObject: object not in scene, skipping attach', obj);
          }
        } catch (err) {
          console.warn('[cad] transform.attach failed', err);
        }
        // ensure transform is visible and usable
        try {
          if ((transform as any).updateMatrixWorld) (transform as any).updateMatrixWorld(true);
        } catch (err) {
          console.warn('[cad] transform.updateMatrixWorld failed', err);
        }
        try {
          (transform as any).visible = true;
          (transform as any).enabled = true;
          const modeNow = (toolRef.current as any) || 'translate';
          const space = (modeNow === 'rotate' || modeNow === 'scale') ? 'local' : 'world';
          try { (transform as any).setSpace?.(space); } catch {}
          // keep the gizmo at a readable size
          try { (transform as any).setSize?.(1.0); } catch {}
          try { applyTransformAppearance(transform); } catch {}
          console.debug('[cad] transform attached; mode=', modeNow, 'space=', space, 'enabled=', (transform as any).enabled, 'visible=', (transform as any).visible);
        } catch (err) {
          console.warn('[cad] failed to finalize transform attach', err);
        }
        // Enable gizmo only for transform tools
        const t = toolRef.current;
        if (t === 'translate' || t === 'rotate' || t === 'scale') {
          (transform as any).setMode(t);
          (transform as any).enabled = true;
          (transform as any).visible = true;
        } else {
          // If not in a transform tool, default to translate so gizmo appears
          (transform as any).setMode('translate');
          (transform as any).enabled = true;
          (transform as any).visible = true;
        }
      }
      function clearSelection() {
        threeRef.current!.selection = { object: null, type: null };
    (transform as any).detach();
    (transform as any).enabled = false;
        selectionCbRef.current(null);
      }
    }

    const onSetTransform = (ev: any) => {
      if (!threeRef.current) return;
      const d = ev.detail || {};
      if (!d.id) return;
      let found: THREE.Object3D | null = null;
      threeRef.current.scene.traverse((o: any) => {
        if (found) return;
        if (o.userData && o.userData.id === d.id) found = o;
      });
      if (!found) return;
      const f: any = found as any;
      if (d.position) f.position.set(d.position.x ?? f.position.x, d.position.y ?? f.position.y, d.position.z ?? f.position.z);
      if (d.rotation) f.rotation.set(d.rotation.x ?? f.rotation.x, d.rotation.y ?? f.rotation.y, d.rotation.z ?? f.rotation.z);
      if (d.scale) f.scale.set(d.scale.x ?? f.scale.x, d.scale.y ?? f.scale.y, d.scale.z ?? f.scale.z);
      // update selection info if this is the selected object
      const sel = threeRef.current.selection;
      if (sel && sel.object === found) {
        selectionCbRef.current(buildSelectionInfo(found, sel.type || 'shape'));
      }
    };
    window.addEventListener('cad-set-transform', onSetTransform as any);

    const onExport = () => {
      if (!threeRef.current) return;
      const { scene } = threeRef.current;
      const items: any[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && m.userData && m.userData.pickable) {
          const t = m.userData.kind || 'mesh';
          const params = m.userData.params || {};
          items.push({
            kind: t,
            params,
            position: m.position.toArray(),
            rotation: [m.rotation.x, m.rotation.y, m.rotation.z],
            scale: m.scale.toArray(),
          });
        }
      });
      const sel = threeRef.current.selection;
      const selectionOut = sel && sel.object && (sel.object as any).userData ? { id: (sel.object as any).userData.id || null, type: sel.type } : null;
  const blob = new Blob([JSON.stringify({ items, selection: selectionOut }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cad-scene.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const onImport = (e: any) => {
      if (!threeRef.current) return;
      const { scene } = threeRef.current;
      try {
        const data = JSON.parse(e.detail || '{}');
        if (!data.items) return;
        // Clear existing pickable meshes
        const toRemove: THREE.Object3D[] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if ((m as any).isMesh && m.userData && m.userData.pickable) toRemove.push(m);
        });
        toRemove.forEach((o) => o.parent?.remove(o));
        // Recreate
        for (const it of data.items) {
          let mesh: THREE.Mesh | null = null;
          if (it.kind === 'box') {
            const { w = 1, h = 1, d = 1 } = it.params || {};
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x77aaff }));
          } else if (it.kind === 'sphere') {
            const { r = 0.6 } = it.params || {};
            mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshStandardMaterial({ color: 0xaaff77 }));
          } else if (it.kind === 'cylinder') {
            const { r = 0.5, h = 1.2 } = it.params || {};
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), new THREE.MeshStandardMaterial({ color: 0xffaa77 }));
          } else if (it.kind === 'extrude') {
            const shape = new THREE.Shape().fromJSON(it.params.shape);
            const geo = new THREE.ExtrudeGeometry(shape, it.params.extrudeOptions || { depth: 1, bevelEnabled: false });
            mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xccccff }));
          }
          if (!mesh) continue;
          mesh.userData.pickable = true;
          mesh.userData.kind = it.kind;
          mesh.userData.params = it.params || {};
          mesh.userData.id = it.id || mesh.uuid;
          mesh.position.fromArray(it.position || [0, 0, 0]);
          const rot = it.rotation || [0, 0, 0];
          mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
          mesh.scale.fromArray(it.scale || [1, 1, 1]);
          scene.add(mesh);
          addEdges(mesh);
        }
        // If selection info present, try to restore selection
        if (data.selection && data.selection.id) {
          const selId = data.selection.id;
          let found: THREE.Object3D | null = null;
          scene.traverse((o) => {
            if (found) return;
            if ((o as any).userData && (o as any).userData.id === selId) found = o;
          });
          if (found) {
            threeRef.current!.selection = { object: found, type: data.selection.type || 'shape' };
            (threeRef.current!.transform as any).attach(found);
            (threeRef.current!.transform as any).enabled = true;
          }
        }
      } catch {}
    };

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
      const onExtrude = () => {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      // Prefer current active shapeData, otherwise fall back to the last saved preview
      let shapeData = ctx.sketch.shapeData;
      if (!shapeData && ctx.sketch.previews && ctx.sketch.previews.length) {
        shapeData = ctx.sketch.previews[ctx.sketch.previews.length - 1].shapeData;
      }
      if (!shapeData) return;
      const shape = new THREE.Shape().fromJSON(shapeData.shape);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
      const mat = new THREE.MeshStandardMaterial({ color: 0xccccff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.pickable = true;
      mesh.userData.kind = 'extrude';
      mesh.userData.params = { shape: shape.toJSON(), extrudeOptions: { depth: 1, bevelEnabled: false, steps: 1 } };
      ctx.scene.add(mesh);
      addEdges(mesh);
    };
  window.addEventListener('cad-extrude', onExtrude as any);
    const onClearSketch = () => {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      if (ctx.sketch.preview) {
        try { ctx.scene.remove(ctx.sketch.preview); } catch {}
        ctx.sketch.preview = undefined;
      }
      if (ctx.sketch.previews) {
        for (const p of ctx.sketch.previews) {
          try { ctx.scene.remove(p.preview); } catch {}
        }
        ctx.sketch.previews = [];
      }
      ctx.sketch.shapeData = undefined;
      ctx.sketch.active = false;
      ctx.sketch.mode = null;
    };
    window.addEventListener('cad-clear-sketch', onClearSketch as any);
    window.addEventListener('cad-export', onExport as any);
    window.addEventListener('cad-import', onImport as any);
    // Delete selected primitive event
    const onDeleteSelected = () => {
      if (!threeRef.current) return;
      const ctx = threeRef.current;
      const sel = ctx.selection;
      if (!sel || !sel.object) return;
      try {
        // remove any highlight
        if (ctx.highlight) {
          try { ctx.scene.remove(ctx.highlight); } catch {}
          ctx.highlight = null;
        }
        const obj = sel.object;
        // remove from parent (handles nested edges as children)
        if (obj.parent) obj.parent.remove(obj);
        else ctx.scene.remove(obj);
      } catch (err) { console.warn('[cad] delete selected failed', err); }
      // clear transform and selection state
      try { (ctx.transform as any).detach(); } catch {}
      try { (ctx.transform as any).enabled = false; (ctx.transform as any).visible = false; } catch {}
      ctx.selection = { object: null, type: null };
      selectionCbRef.current(null);
    };
    window.addEventListener('cad-delete-selected', onDeleteSelected as any);
  // snap event already added above; ensure cleanup

    let raf = 0;
    const tick = () => {
      // Validate that TransformControls' attached object is still part of the scene graph.
      try {
        const t: any = (threeRef.current && threeRef.current.transform) || transform;
        const ctx = threeRef.current;
        if (t && ctx) {
          const attached: THREE.Object3D | null | undefined = t.object as any;
          if (attached) {
            // climb parents to check membership
            let cur: THREE.Object3D | null = attached as any;
            let inScene = false;
            while (cur) {
              if (cur === ctx.scene) { inScene = true; break; }
              cur = cur.parent as any;
            }
            if (!inScene) {
              // try to resolve by id/uuid in the scene and re-attach, otherwise detach safely
              let found: THREE.Object3D | null = null;
              try {
                ctx.scene.traverse((o: any) => {
                  if (found) return;
                  if (attached && (attached as any).userData && (attached as any).userData.id && o.userData && o.userData.id === (attached as any).userData.id) found = o;
                  else if (o.uuid === (attached as any).uuid) found = o;
                });
              } catch (err) {}
              if (found) {
                try { t.attach(found); } catch (err) { try { t.detach(); t.enabled = false; t.visible = false; } catch {} }
              } else {
                try { t.detach(); t.enabled = false; t.visible = false; } catch (err) {}
                // clear selection state since attached object is gone
                try { ctx.selection = { object: null, type: null }; selectionCbRef.current(null); } catch {}
              }
            }
          }
        }
      } catch (err) {
        console.warn('[cad] transform attach validation failed', err);
      }

      orbit.update();
      // keep box helper in sync
      if (threeRef.current?.highlight && (threeRef.current.highlight as any).isBoxHelper) {
        const bh = threeRef.current.highlight as any;
        if (bh.update) bh.update();
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('cad-export', onExport as any);
      window.removeEventListener('cad-import', onImport as any);
      window.removeEventListener('cad-extrude', onExtrude as any);
      window.removeEventListener('cad-clear-sketch', onClearSketch as any);
    window.removeEventListener('cad-delete-selected', onDeleteSelected as any);
  window.removeEventListener('cad-set-transform', onSetTransform as any);
      window.removeEventListener('cad-snap', onSnapEvent as any);
  window.removeEventListener('keydown', onKeyDown as any);
      try { delete (window as any).__cad; } catch {}
      // Remove transform root we added, if any
      try {
        if (_transformAddedRoot && _transformAddedRoot.parent) _transformAddedRoot.parent.remove(_transformAddedRoot);
      } catch {}
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!threeRef.current) return;
    const { transform, selection } = threeRef.current;
    if (tool === 'translate') {
      transform.setMode('translate');
    } else if (tool === 'rotate') {
      transform.setMode('rotate');
    } else if (tool === 'scale') {
      transform.setMode('scale');
    }
     const spaceDefault = (tool === 'rotate' || tool === 'scale') ? 'local' : 'world';
     transform.setSpace(spaceDefault);
  transform.setSize(1.2);
     console.debug('[cad] tool change -> mode=', tool, 'space=', spaceDefault);
    // Attach to current selection if present
  if (selection.object) {
    // ensure the selected object is part of the scene graph before attaching
    const selObj = selection.object as THREE.Object3D;
    const isInScene = (() => {
      let cur: THREE.Object3D | null = selObj;
      while (cur) {
        if (cur === threeRef.current!.scene) return true;
        cur = cur.parent as any;
      }
      return false;
    })();
    if (!isInScene) {
      // try to find by id in the scene
      let found: THREE.Object3D | null = null;
      threeRef.current!.scene.traverse((o: any) => {
        if (found) return;
        if (o.userData && o.userData.id && (selObj as any).userData && (selObj as any).userData.id === o.userData.id) found = o;
        else if (o.uuid === (selObj as any).uuid) found = o;
      });
      if (found) {
        try { (transform as any).attach(found); } catch (err) { console.warn('[cad] attach fallback failed', err); }
      } else {
        console.warn('[cad] selected object not in scene, skipping attach', selObj);
      }
    } else {
      try { (transform as any).attach(selection.object as THREE.Object3D); } catch (err) { console.warn('[cad] attach failed', err); }
    }
      // Keep gizmo visible even in Select mode
      const isTransformTool = tool === 'translate' || tool === 'rotate' || tool === 'scale';
      transform.enabled = true;
      (transform as any).visible = true;
      if (!isTransformTool) {
        // default to translate for visibility in Select mode without changing selection
        transform.setMode('translate');
      }
      // Ensure gizmo renders on top
      (threeRef.current.transform as any).traverse?.((o: any) => {
        if (o.material && o.material.depthTest !== undefined) {
          o.material.depthTest = false;
          o.material.needsUpdate = true;
        }
        o.renderOrder = 1000;
      });
    } else {
  (transform as any).enabled = false;
  (transform as any).visible = false;
    }
    // Keep sketch previews persistent when switching tools
    const ctx = threeRef.current;
    ctx.sketch.active = false; // end any active drag, but do not remove preview
  }, [tool]);

  useEffect(() => {
    // creation moved to pointer handling; this effect no longer creates shapes
  }, [tool]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function buildSelectionInfo(obj: THREE.Object3D, type: 'shape' | 'face' | 'edge') {
  const e: any = { type };
  e.name = obj.name || obj.type;
  e.id = (obj as any).userData?.id || (obj as any).uuid;
  e.kind = (obj as any).userData?.kind;
  if ((obj as any).position) {
    const p = (obj as any).position as THREE.Vector3;
    e.position = { x: p.x, y: p.y, z: p.z };
  }
  if ((obj as any).rotation) {
    const r = (obj as any).rotation as THREE.Euler;
    e.rotation = { x: r.x, y: r.y, z: r.z };
  }
  if ((obj as any).scale) {
    const s = (obj as any).scale as THREE.Vector3;
    e.scale = { x: s.x, y: s.y, z: s.z };
  }
  return e;
}

function addEdges(mesh: THREE.Mesh) {
  const edgesGeo = new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry);
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  edges.userData.edgeOf = mesh;
  mesh.add(edges);
}

function edgeInfoFromIntersection(hit: THREE.Intersection) {
  // Robust edge endpoint calculation: find nearest vertex in the LineSegments geometry
  const line = hit.object as THREE.LineSegments;
  const geom = line.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position');
  if (!pos) return { length: 0 };
  const count = pos.count;
  if (!hit.point) return { length: 0 };
  const hitPoint = (hit.point as THREE.Vector3).clone();
  // Transform points to world coords
  let nearestIdx = 0;
  let nearestDist = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    v.applyMatrix4(line.matrixWorld);
    const d = v.distanceToSquared(hitPoint);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }
  // pair vertex index (LineSegments stores segments as pairs: 0-1,2-3,...)
  const aIdx = nearestIdx % 2 === 0 ? nearestIdx : nearestIdx - 1;
  const bIdx = Math.min(count - 1, aIdx + 1);
  const a = new THREE.Vector3(pos.getX(aIdx), pos.getY(aIdx), pos.getZ(aIdx)).applyMatrix4(line.matrixWorld);
  const b = new THREE.Vector3(pos.getX(bIdx), pos.getY(bIdx), pos.getZ(bIdx)).applyMatrix4(line.matrixWorld);
  return { a, b, length: a.distanceTo(b) };
}

function faceInfoFromIntersection(hit: THREE.Intersection) {
  const mesh = hit.object as THREE.Mesh;
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position');
  const idxAttr = geom.getIndex();
  const faceIndex = (hit.faceIndex || 0);
  let ia = 0, ib = 1, ic = 2;
  if (idxAttr) {
    const base = faceIndex * 3;
    ia = idxAttr.getX(base);
    ib = idxAttr.getX(base + 1);
    ic = idxAttr.getX(base + 2);
  } else {
    const base = faceIndex * 3;
    ia = base + 0;
    ib = base + 1;
    ic = base + 2;
  }
  const a = new THREE.Vector3(pos.getX(ia), pos.getY(ia), pos.getZ(ia)).applyMatrix4(mesh.matrixWorld);
  const b = new THREE.Vector3(pos.getX(ib), pos.getY(ib), pos.getZ(ib)).applyMatrix4(mesh.matrixWorld);
  const c = new THREE.Vector3(pos.getX(ic), pos.getY(ic), pos.getZ(ic)).applyMatrix4(mesh.matrixWorld);
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const nVec = new THREE.Vector3().crossVectors(ab, ac);
  const normal = new THREE.Vector3().copy(nVec).normalize();
  const area = nVec.length() * 0.5;
  return { a, b, c, normal: { x: normal.x, y: normal.y, z: normal.z }, area };
}


