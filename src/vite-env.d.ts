/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROOF_PROVIDER?: string;
  readonly VITE_MIDNIGHT_NETWORK?: string;
  readonly VITE_MIDNIGHT_INDEXER_URL?: string;
  readonly VITE_MIDNIGHT_NODE_URL?: string;
  readonly VITE_MIDNIGHT_PROOF_SERVER_URL?: string;
  readonly VITE_MIDNIGHT_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
