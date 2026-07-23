import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deliberately no source alias for `cipa-provider` — this app consumes the
// built package from `../dist` via the `file:..` dependency (AC13), the same
// way any real downstream consumer would.
export default defineConfig({
  plugins: [react()],
});
