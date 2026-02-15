# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Desarrollo local

- **`npm run dev`** — Solo Vite. La sección de rutas usa OSRM como fallback si el proxy de ORS no está disponible (p. ej. en local sin API).
- **`npm run dev:full`** — Requiere [Vercel CLI](https://vercel.com/docs/cli). Ejecuta `vercel dev` para servir la app y el API `/api/ors-directions` (necesitas `ORS_API_KEY` en `.env`). Así evitas el 404 del proxy y usas ORS con “evitar ferries” en rutas alternativas.

Copia `.env.example` a `.env.local` y configura las variables que necesites; ver comentarios en ese archivo.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
