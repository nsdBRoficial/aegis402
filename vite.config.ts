import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Configuração Vite para o Aegis402 / Vite configuration for Aegis402
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // base: '/' — raiz do domínio no Vercel (sem subpasta)
    // base: '/' — domain root on Vercel (no sub-folder needed)
    // NOTA: Removido '/aegis402/' que era específico do Hostinger.
    // NOTE: Removed '/aegis402/' which was Hostinger-specific.

    plugins: [react(), tailwindcss(), nodePolyfills()],
    define: {
      // Injeta a chave da API Gemini no bundle do cliente / Injects Gemini API key into client bundle
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // Atalho '@' aponta para a raiz do projeto / '@' alias points to project root
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR desabilitado no AI Studio via DISABLE_HMR / HMR disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',

      // Proxy de desenvolvimento: redireciona /api/* → localhost:3001 (Express local)
      // Dev proxy: forwards /api/* → localhost:3001 (local Express server)
      //
      // Por que isso funciona / Why this works:
      //   - Em dev:  Vite intercepta /api/data e envia para localhost:3001/api/data
      //   - Em prod: Vercel roteia /api/data direto para a Serverless Function
      //   - O API_BASE='/api/data' nos services nunca precisa mudar — é sempre relativo
      //   - Como o proxy torna a req same-origin, o browser NÃO filtra WWW-Authenticate
      //     (resolve o hash error do L402 challenge no interceptor MPP V2)
      //
      //   - In dev:  Vite intercepts /api/data and forwards to localhost:3001/api/data
      //   - In prod: Vercel routes /api/data directly to the Serverless Function
      //   - API_BASE='/api/data' in services never changes — always relative
      //   - Proxy makes req same-origin, so browser does NOT strip WWW-Authenticate
      //     (fixes the L402 challenge hash error in the MPP V2 interceptor)
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          // Não reescreve o path — /api/data permanece /api/data no backend
          // Does NOT rewrite path — /api/data stays /api/data on the backend
          rewrite: (path) => path,
        },
      },
    },

  };
});
