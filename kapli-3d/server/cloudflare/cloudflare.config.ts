import { bindings, defineConfig, exports } from 'cf/config';
import * as entrypoint from './src/index.js' with { type: 'cf-worker' };

export default defineConfig({
  worker: {
    name: 'kapli-3d-online-test',
    compatibilityDate: '2026-11-17',
    entrypoint,
    exports: {
      GameRoom: exports.durableObject({ storage: 'sqlite' }),
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.05 },
    },
    env: {
      ROOMS: bindings.durableObject({ worker: entrypoint, exportName: 'GameRoom' }),
      SUPABASE_URL: bindings.secret(),
      SUPABASE_ANON_KEY: bindings.secret(),
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
      ALLOWED_ORIGINS: bindings.text('https://replace-with-your-game-domain.example'),
    },
  },
});
