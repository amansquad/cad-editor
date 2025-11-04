# CAD Editor (React + Three.js)

A minimal browser-based CAD editor using React + plain Three.js (no R3F).

## Features

- Primitive creation: Box, Sphere, Cylinder
- Selection targets: shape, face, edge (raycasting)
- Transform controls: move, rotate, scale
- Sketch mode on XZ-plane: Rectangle, Circle with snap-to-grid and live preview
- Extrusion via Three.js ExtrudeGeometry
- Import/Export full scene to JSON (geometry params, transforms, metadata)

## Getting Started

1. Install deps

```bash
npm install
```

2. Run dev

```bash
npm run dev
```

3. Build

```bash
npm run build && npm run preview
```

## Usage

- Use toolbar to pick tools. Selection target dropdown controls shape/face/edge picking.
- Primitives: click the tool to add one at origin area.
- Sketch: choose Rectangle or Circle, click-drag on grid; click Extrude to create a solid.
- Transform: choose Move/Rotate/Scale; click an object to attach gizmo.
- Export: downloads `cad-scene.json`. Import: choose a JSON file to restore.

Example scene: `examples/example-scene.json` is included with the repo and can be used to import a starting scene.

## Notes

- Face selection reports triangle normal and area; edge selection reports segment length.
- Edges are derived from `EdgesGeometry` and are raycastable for edge picking.
- Imported objects behave like newly created ones (pickable, transformable, exportable).

## Deployment

- Deploy to GitHub Pages, Netlify, or Vercel by serving the `dist/` build.

## Known limitations

- Face highlight is info-only; visual per-face highlight can be extended if needed.
- Sketches are not persisted once extruded (keeps last sketch in memory for extrusion).
- Export now includes basic object IDs and transforms; selection is serialized as part of the exported data if set (import will attempt to restore selection on load).

## License

MIT

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
