export type KbVisibilityConfig = {
  scope: "tenant" | "restricted";
  roles?: string[];
  departments?: string[];
};

export type KbIngestDocumentInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
  title?: string;
  externalId?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  visibility?: KbVisibilityConfig;
};

export type KbDocumentRow = {
  id: string;
  sourceProvider: string;
  externalId: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  permissions: KbVisibilityConfig | Record<string, unknown>;
  departmentId: string | null;
  updatedAt: string;
  indexedAt?: string | null;
  indexStatus: "pending" | "indexing" | "ready" | "failed" | string;
  chunkCount: number;
  lastIndexedAt: string | null;
  indexError: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

export type KbIngestResultItem = {
  filename: string;
  id?: string;
  title?: string;
  sourceProvider?: string;
  chunkCount?: number;
  indexStatus: "ready" | "failed";
  message: string;
};

export type KbIngestResult = {
  results: KbIngestResultItem[];
  summary: {
    total: number;
    failed: number;
    ready: number;
  };
};
