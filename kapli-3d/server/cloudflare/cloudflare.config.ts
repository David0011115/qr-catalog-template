import { bindings, defineConfig, exports } from 'cf/config';
import * as entrypoint from './src/index.js' with { type: 'cf-worker' };

export default defineConfig({
  worker: {
    name: 'kapli-3d-online-test',
    compatibilityDate: '2026-11-17',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: false,
    previewUrls: false,
    entrypoint,

    exports: {
      GameRoom: exports.durableObject({ storage: 'sqlite' }),
    },

    observability: {
      enabled: false,
    },

    env: {
      ROOMS: bindings.durableObject({
        worker: 'kapli-3d-online-test',
        exportName: 'GameRoom',
      }),
      SUPABASE_URL: bindings.secret(),
      SUPABASE_ANON_KEY: bindings.secret(),
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
      ALLOWED_ORIGINS: bindings.secret(),
    },
  },
});
