import { createApp } from './app.js';
import { env, validateEnv } from './config/env.js';

const envCheck = validateEnv();
if (!envCheck.ok) {
  console.warn('[env] Missing required variables:', envCheck.missing.join(', '));
  console.warn('[env] Copy .env.example → .env and add OPENROUTER_API_KEY');
}
if (envCheck.warnings.length) {
  envCheck.warnings.forEach(w => console.warn('[env]', w));
}

const app = createApp();

app.listen(env.port, () => {
  console.log(`InvestAI API → http://localhost:${env.port}`);
  console.log(`Health   → http://localhost:${env.port}/api/health`);
  if (env.isOpenRouterConfigured()) {
    console.log(`AI primary  → ${env.openRouterModelPrimary}`);
    console.log(`AI fallback → ${env.openRouterModelFallback}`);
  }
});
