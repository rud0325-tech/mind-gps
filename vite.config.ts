import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// This edition's default data mode. VITE_DATA_MODE in the environment or an env file still wins.
const appMode = JSON.parse(readFileSync(path.resolve(__dirname, 'app-mode.json'), 'utf8')) as {dataMode?: string};
const appsScriptDeployment = JSON.parse(
  readFileSync(path.resolve(__dirname, 'services/apps-script/deployment.json'), 'utf8')
) as {webAppUrl?: string};

export default defineConfig(({mode}) => {
  const env = {...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env};
  const target = JSON.parse(readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8'));
  const scriptUrl = (env.VITE_GOOGLE_SCRIPT_URL || appsScriptDeployment.webAppUrl || '').trim();
  return {
    plugins: [react(), tailwindcss(), {
      name: 'mindgps-deployment-state',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'deployment-state.json', source: JSON.stringify({
          version: '2026-10-12-class-quick-start-v12', builtAt: new Date().toISOString(),
          dataMode: env.VITE_DATA_MODE ?? appMode.dataMode ?? 'demo',
          emulator: env.VITE_FIREBASE_EMULATOR === 'true', projectId: target.projectId,
          mailConfigured: /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl),
        }, null, 2) });
      },
    }],
    define: {
      __DEFAULT_DATA_MODE__: JSON.stringify(appMode.dataMode ?? 'demo'),
      __DEFAULT_GOOGLE_SCRIPT_URL__: JSON.stringify((appsScriptDeployment.webAppUrl ?? '').trim()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
