/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TREASURY_PUBLIC_KEY: string;
  readonly VITE_TREASURY_SECRET_KEY: string;
  readonly VITE_AGENT_SECRET_KEY: string;
  readonly VITE_CONTRACT_ID: string;
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
