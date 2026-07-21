/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON: string;
  readonly VITE_SUPABASE_FUNCTIONS: string;
  readonly VITE_LOJA_INTEGRADA_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
