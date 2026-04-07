/**
 * Global Search API — permission-aware search across unified entities, indexed documents,
 * activity logs, and report templates. Autosuggest, AI summarization (OpenAI), document upsert, index status.
 * Client: supabase.functions.invoke('search-api', { body: { op, ... } }).
 * Secrets: OPENAI_API_KEY optional for AI summaries; standard Supabase env.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const filterSchema = z
  .object({
    types: z.array(z.enum(["Entity", "Document", "Activity", "Report"])).optional(),
    sources: z.array(z.string()).optional(),
    departmentId: z.string().optional(),
    departmentIds: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    owner: z.string().optional(),
    owners: z.array(z.string()).optional(),
    permissionScope: z.enum(["all", "restricted"]).optional(),
    aiSummarize: z.boolean().optional(),
  })
  .optional();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const KB_BUCKET = "knowledge-base";

const kbVisibilitySchema = z.object({
  scope: z.enum(["tenant", "restricted"]).default("tenant"),
  roles: z.array(z.string().min(1).max(80)).optional(),
  departments: z.array(z.string().min(1).max(120)).optional(),
});

function asUuidOrNull(v: string | undefined): string | null {
  if (!v || !UUID_RE.test(v)) return null;
  return v;
}

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("search.global"),
    query: z.string(),
    filters: filterSchema.optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(100).optional(),
    includeAI: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("search.autosuggest"),
    q: z.string(),
    limit: z.number().int().positive().max(20).optional(),
  }),
  z.object({
    op: z.literal("search.aiSummarize"),
    contextItems: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          type: z.enum(["Entity", "Document", "Activity", "Report"]),
          source: z.string().optional(),
        }),
      )
      .min(1)
      .max(24),
    requiredPermissions: z.array(z.string()).optional(),
  }),
  z.object({
    op: z.literal("search.indexDocument"),
    documentId: z.string().uuid().optional(),
    provider: z.string().min(1),
    externalId: z.string().optional(),
    tenantId: z.string().uuid().optional(),
    content: z.string().optional(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    permissions: z.record(z.unknown()).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    embeddings: z.array(z.number()).optional(),
  }),
  z.object({
    op: z.literal("search.indexStatus"),
  }),
  z.object({
    op: z.literal("kb.documents.ingestBulk"),
    documents: z
      .array(
        z.object({
          filename: z.string().min(1).max(260),
          mimeType: z.string().min(1).max(160),
          sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
          base64: z.string().min(1),
          title: z.string().max(240).optional(),
          externalId: z.string().max(240).optional(),
          provider: z.string().max(80).optional(),
          metadata: z.record(z.unknown()).optional(),
          visibility: kbVisibilitySchema.optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    op: z.literal("kb.documents.list"),
    limit: z.number().int().positive().max(200).optional(),
    sourceFilter: z.string().max(80).optional(),
    statusFilter: z.enum(["pending", "indexing", "ready", "failed"]).optional(),
  }),
  z.object({
    op: z.literal("kb.documents.delete"),
    documentId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("kb.documents.reindex"),
    documentId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("search.savedList"),
  }),
  z.object({
    op: z.literal("search.savedCreate"),
    name: z.string().min(1).max(160),
    query: z.string(),
    filters: filterSchema.optional(),
  }),
  z.object({
    op: z.literal("search.savedDelete"),
    id: z.string().uuid(),
  }),
  z.object({
    op: z.literal("search.preview"),
    compositeId: z.string().min(3).max(200),
    generateAi: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("search.export"),
    query: z.string(),
    filters: filterSchema.optional(),
    format: z.enum(["csv", "json"]),
    fields: z.array(z.string()).max(24).optional(),
    maxRows: z.number().int().positive().max(500).optional(),
  }),
]);

type SearchHit = {
  id: string;
  type: "Entity" | "Document" | "Activity" | "Report";
  subType?: string;
  title: string;
  snippet: string;
  source: string;
  date: string;
  owner?: string;
  departmentId?: string | null;
  permissions?: unknown;
  href?: string;
};

async function requireUser(
  req: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { supabase, userId: user.id };
}

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ company_id: string | null; roles: string[]; department: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, roles, department")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const roles = Array.isArray(data?.roles) ? (data!.roles as string[]) : [];
  return {
    company_id: data?.company_id ?? null,
    roles,
    department: typeof data?.department === "string" ? data.department : null,
  };
}

function assertCompany(companyId: string | null): asserts companyId is string {
  if (!companyId) {
    throw new Response(JSON.stringify({ error: "No tenant context" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function normalizeRoles(roles: string[]): Set<string> {
  return new Set((roles ?? []).map((r) => r.toLowerCase()));
}

function canMutateIndex(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("owner") ||
    r.has("executive") ||
    r.has("manager") ||
    r.has("builder") ||
    r.has("integrator")
  );
}

function isElevatedRole(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.has("admin") || r.has("company admin") || r.has("owner") || r.has("executive") || r.has("manager");
}

/** AI search summaries: block viewer-only accounts. */
function canUseSearchAi(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  if (r.size === 0) return true;
  if (r.size === 1 && r.has("viewer")) return false;
  return true;
}

function hitTypeFromEntityType(entityType: string): SearchHit["type"] {
  if (entityType === "Document" || entityType === "Activity" || entityType === "Report") {
    return entityType;
  }
  return "Entity";
}

function docVisible(
  permissions: unknown,
  userRoles: string[],
  userDepartment?: string | null,
): boolean {
  const p = permissions as Record<string, unknown> | null;
  if (!p || p.scope === "tenant") return true;
  if (isElevatedRole(userRoles)) return true;
  const roles = Array.isArray(p.roles) ? (p.roles as string[]) : [];
  const ur = normalizeRoles(userRoles);
  const rolesAllowed = roles.length === 0 || roles.some((role) => ur.has(String(role).toLowerCase()));
  if (!rolesAllowed) return false;

  const depts = Array.isArray(p.departments) ? (p.departments as string[]) : [];
  if (depts.length === 0) return true;
  const d = (userDepartment ?? "").trim().toLowerCase();
  if (!d) return false;
  return depts.some((dep) => String(dep).trim().toLowerCase() === d);
}

function payloadTitle(payload: Record<string, unknown>, fallback: string): string {
  const t = payload.title ?? payload.name ?? payload.subject;
  return typeof t === "string" && t.length > 0 ? t : fallback;
}

function payloadOwner(payload: Record<string, unknown>): string | undefined {
  const o = payload.owner ?? payload.assignee ?? payload.owner_email;
  return typeof o === "string" ? o : undefined;
}

function snippetFrom(str: string | null | undefined, max = 180): string {
  if (!str) return "";
  const s = str.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function parseHitDate(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function applyFilters(
  hits: SearchHit[],
  filters: z.infer<typeof filterSchema>,
  q: string,
): SearchHit[] {
  const f = filters ?? {};
  let out = hits;

  if (Array.isArray(f.types) && f.types.length > 0) {
    const set = new Set(f.types);
    out = out.filter((h) => set.has(h.type));
  }
  if (Array.isArray(f.sources) && f.sources.length > 0) {
    const set = new Set(f.sources.map((s) => s.toLowerCase()));
    out = out.filter((h) => set.has(h.source.toLowerCase()));
  }
  const deptList = Array.isArray(f.departmentIds)
    ? f.departmentIds.map((d) => asUuidOrNull(d)).filter((x): x is string => Boolean(x))
    : [];
  const dept = asUuidOrNull(f.departmentId);
  if (deptList.length > 0) {
    const set = new Set(deptList);
    out = out.filter((h) => (h.departmentId ? set.has(h.departmentId) : false));
  } else if (dept) {
    out = out.filter((h) => h.departmentId === dept);
  }
  if (f.owner && f.owner.trim()) {
    const o = f.owner.toLowerCase();
    out = out.filter((h) => (h.owner ?? "").toLowerCase().includes(o));
  }
  const ownerFrags = Array.isArray(f.owners)
    ? f.owners.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
    : [];
  if (ownerFrags.length > 0) {
    out = out.filter((h) => {
      const o = (h.owner ?? "").toLowerCase();
      return ownerFrags.some((frag) => o.includes(frag));
    });
  }
  if (f.dateFrom) {
    const from = Date.parse(f.dateFrom);
    if (!Number.isNaN(from)) {
      out = out.filter((h) => parseHitDate(h.date) >= from);
    }
  }
  if (f.dateTo) {
    const to = Date.parse(f.dateTo);
    if (!Number.isNaN(to)) {
      out = out.filter((h) => parseHitDate(h.date) <= to);
    }
  }
  if (f.permissionScope === "restricted") {
    out = out.filter((h) => {
      const p = h.permissions as Record<string, unknown> | undefined;
      return Array.isArray(p?.roles) && (p!.roles as unknown[]).length > 0;
    });
  }

  if (q.trim()) {
    const needle = q.toLowerCase();
    out = out.filter(
      (h) =>
        h.title.toLowerCase().includes(needle) ||
        h.snippet.toLowerCase().includes(needle) ||
        h.source.toLowerCase().includes(needle),
    );
  }

  return out;
}

function sanitizeIlikePattern(q: string): string {
  return q.replace(/%/g, "").replace(/_/g, "").replace(/,/g, "").trim();
}

function facetsFrom(hits: SearchHit[]): {
  types: Record<string, number>;
  sources: Record<string, number>;
} {
  const types: Record<string, number> = {};
  const sources: Record<string, number> = {};
  for (const h of hits) {
    types[h.type] = (types[h.type] ?? 0) + 1;
    sources[h.source] = (sources[h.source] ?? 0) + 1;
  }
  return { types, sources };
}

type KbVisibility = z.infer<typeof kbVisibilitySchema>;
type KbIngestDocumentInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
  title?: string;
  externalId?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  visibility?: KbVisibility;
};

function sanitizeFileName(name: string): string {
  const base = name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const clean = base.replace(/_+/g, "_");
  if (!clean) return "document";
  return clean.slice(0, 120);
}

function extFromName(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const normalized = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeEscapedPdfString(input: string): string {
  return input
    .replace(/\\([nrtbf()\\])/g, (_m, p1: string) => {
      if (p1 === "n") return "\n";
      if (p1 === "r") return "\r";
      if (p1 === "t") return "\t";
      if (p1 === "b") return "\b";
      if (p1 === "f") return "\f";
      return p1;
    })
    .replace(/\\\d{3}/g, "")
    .replace(/\\x[0-9a-fA-F]{2}/g, "");
}

function extractPdfTextSimple(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const acc: string[] = [];

  for (const m of raw.matchAll(/\(([^()]*)\)\s*Tj/g)) {
    const content = decodeEscapedPdfString(m[1]);
    if (content.trim()) acc.push(content);
  }
  for (const m of raw.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const body = m[1];
    for (const inner of body.matchAll(/\(([^()]*)\)/g)) {
      const content = decodeEscapedPdfString(inner[1]);
      if (content.trim()) acc.push(content);
    }
  }

  const joined = acc.join(" ").replace(/\s+/g, " ").trim();
  return joined.slice(0, 250_000);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  const xml = await file.async("text");
  const text = xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 250_000);
}

async function extractTextFromDocument(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = extFromName(filename);
  const mt = mimeType.toLowerCase();
  const isText =
    mt.startsWith("text/") || ext === "txt" || ext === "md" || ext === "csv";
  if (isText) {
    return new TextDecoder().decode(bytes).replace(/\u0000/g, "").trim().slice(0, 300_000);
  }

  if (mt.includes("officedocument.wordprocessingml.document") || ext === "docx") {
    return await extractDocxText(bytes);
  }

  if (mt === "application/pdf" || ext === "pdf") {
    return extractPdfTextSimple(bytes);
  }

  return new TextDecoder().decode(bytes).replace(/\u0000/g, "").trim().slice(0, 300_000);
}

function approxTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function chunkText(
  text: string,
  chunkSize = 1400,
  overlap = 220,
): string[] {
  const src = text.replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  if (src.length <= chunkSize) return [src];
  const out: string[] = [];
  let start = 0;
  while (start < src.length) {
    const end = Math.min(src.length, start + chunkSize);
    const slice = src.slice(start, end).trim();
    if (slice) out.push(slice);
    if (end >= src.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out.slice(0, 200);
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v.toFixed(8))).join(",")}]`;
}

function normalizeVisibility(visibility: KbVisibility | undefined): Record<string, unknown> {
  const scope = visibility?.scope === "restricted" ? "restricted" : "tenant";
  if (scope === "tenant") return { scope: "tenant" };

  const roles = Array.isArray(visibility?.roles)
    ? visibility.roles.map((r) => r.trim()).filter(Boolean).slice(0, 50)
    : [];
  const departments = Array.isArray(visibility?.departments)
    ? visibility.departments.map((d) => d.trim()).filter(Boolean).slice(0, 50)
    : [];
  return { scope, roles, departments };
}

async function embedTexts(
  apiKey: string,
  texts: string[],
): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Embedding request failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const json = await res.json() as {
      data?: Array<{ embedding?: number[] }>;
    };
    const rows = Array.isArray(json.data) ? json.data : [];
    for (const row of rows) {
      const emb = Array.isArray(row.embedding) ? row.embedding : [];
      if (emb.length !== EMBEDDING_DIM) {
        throw new Error(`Unexpected embedding dimension ${emb.length}`);
      }
      all.push(emb);
    }
  }
  return all;
}

async function uploadKnowledgeFile(
  supabase: SupabaseClient,
  companyId: string,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<string> {
  const safeName = sanitizeFileName(filename);
  const storagePath = `${companyId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(KB_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return storagePath;
}

async function runIndexingForDocument(params: {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  apiKey: string | null;
  input: KbIngestDocumentInput;
  bytes: Uint8Array;
  storagePath: string | null;
  existingDocumentId?: string;
}): Promise<{
  id: string;
  title: string;
  sourceProvider: string;
  indexStatus: "ready" | "failed";
  chunkCount: number;
  message: string;
}> {
  const provider = (params.input.provider ?? "uploads").trim() || "uploads";
  const text = await extractTextFromDocument(
    params.bytes,
    params.input.mimeType,
    params.input.filename,
  );
  const title = params.input.title?.trim() || params.input.filename;
  const externalId =
    params.input.externalId?.trim() || `${provider}:${params.storagePath ?? crypto.randomUUID()}`;
  const metadata =
    params.input.metadata && typeof params.input.metadata === "object"
      ? params.input.metadata
      : {};
  const permissions = normalizeVisibility(params.input.visibility);
  const nowIso = new Date().toISOString();

  const baseRow = {
    company_id: params.companyId,
    source_provider: provider,
    external_id: externalId,
    title,
    full_text: text || null,
    snippet: snippetFrom(text, 320),
    indexed_at: nowIso,
    metadata: {
      ...metadata,
      filename: params.input.filename,
      kbManaged: true,
    },
    permissions,
    updated_at: nowIso,
    index_status: "indexing",
    chunk_count: 0,
    last_indexed_at: null as string | null,
    index_error: null as string | null,
    storage_path: params.storagePath,
    mime_type: params.input.mimeType,
    file_size: params.input.sizeBytes,
  };

  let docId = params.existingDocumentId;
  if (docId) {
    const { data, error } = await params.supabase
      .from("indexed_documents")
      .update(baseRow)
      .eq("id", docId)
      .eq("company_id", params.companyId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    docId = data.id;
  } else {
    const { data, error } = await params.supabase
      .from("indexed_documents")
      .upsert(baseRow, { onConflict: "company_id,source_provider,external_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    docId = data.id;
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await params.supabase
      .from("indexed_documents")
      .update({
        index_status: "failed",
        index_error: "No extractable text found in document",
        last_indexed_at: nowIso,
        chunk_count: 0,
      })
      .eq("id", docId)
      .eq("company_id", params.companyId);

    return {
      id: docId,
      title,
      sourceProvider: provider,
      indexStatus: "failed",
      chunkCount: 0,
      message: "No extractable text found in document",
    };
  }

  const embeddings = params.apiKey ? await embedTexts(params.apiKey, chunks) : [];
  await params.supabase
    .from("indexed_document_chunks")
    .delete()
    .eq("document_id", docId)
    .eq("company_id", params.companyId);

  const chunkRows = chunks.map((chunk, idx) => ({
    document_id: docId,
    company_id: params.companyId,
    chunk_index: idx,
    chunk_text: chunk,
    token_count: approxTokenCount(chunk),
    embedding: embeddings[idx] ? toVectorLiteral(embeddings[idx]) : null,
    metadata: {
      source: provider,
      title,
      hasEmbedding: Boolean(embeddings[idx]),
    },
  }));

  const { error: chunkErr } = await params.supabase.from("indexed_document_chunks").insert(chunkRows);
  if (chunkErr) {
    await params.supabase
      .from("indexed_documents")
      .update({
        index_status: "failed",
        index_error: chunkErr.message,
        last_indexed_at: nowIso,
        chunk_count: 0,
      })
      .eq("id", docId)
      .eq("company_id", params.companyId);
    throw new Error(chunkErr.message);
  }

  const indexStatus = "ready";
  const message = params.apiKey
    ? `Indexed ${chunks.length} chunks with embeddings`
    : `Indexed ${chunks.length} chunks without embeddings (OPENAI_API_KEY missing)`;

  await params.supabase
    .from("indexed_documents")
    .update({
      index_status: indexStatus,
      index_error: null,
      last_indexed_at: nowIso,
      chunk_count: chunks.length,
      indexed_at: nowIso,
    })
    .eq("id", docId)
    .eq("company_id", params.companyId);

  await params.supabase.from("search_index_jobs").insert({
    company_id: params.companyId,
    status: "ok",
    provider,
    message: `kb index ${docId} (${chunks.length} chunks)`,
  });

  await logActivity(
    params.supabase,
    params.companyId,
    params.userId,
    "kb.document.indexed",
    { documentId: docId, chunks: chunks.length, provider },
  );

  return {
    id: docId,
    title,
    sourceProvider: provider,
    indexStatus,
    chunkCount: chunks.length,
    message,
  };
}

async function buildSearchHits(
  supabase: SupabaseClient,
  companyId: string,
  profile: { roles: string[]; department: string | null },
  q: string,
  entityDeptFilter: string | null,
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];

  const { data: entities, error: eErr } = await supabase.rpc("search_unified_entities", {
    p_search: q,
    p_entity_type: null,
    p_department_id: entityDeptFilter,
    p_limit: 55,
  });
  if (!eErr && Array.isArray(entities)) {
    for (const row of entities) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const ht = hitTypeFromEntityType(row.entity_type);
      hits.push({
        id: row.id,
        type: ht,
        subType: ht === "Entity" ? row.entity_type : undefined,
        title: payloadTitle(payload, row.entity_type),
        snippet: snippetFrom(JSON.stringify(payload)),
        source: "unified",
        date: row.updated_at ?? row.created_at,
        owner: payloadOwner(payload),
        departmentId: row.department_id ?? null,
        permissions: { scope: "tenant" },
        href:
          row.department_id
            ? `/dashboard/departments/${row.department_id}`
            : "/dashboard/departments",
      });
    }
  }

  const safe = sanitizeIlikePattern(q);
  const like = safe.length >= 2 ? `%${safe}%` : null;
  if (like) {
    const { data: docs, error: dErr } = await supabase
      .from("indexed_documents")
      .select("*")
      .eq("company_id", companyId)
      .or(`title.ilike.${like},full_text.ilike.${like},snippet.ilike.${like}`)
      .order("indexed_at", { ascending: false })
      .limit(40);
    if (!dErr && Array.isArray(docs)) {
      for (const d of docs) {
        if (!docVisible(d.permissions, profile.roles, profile.department)) continue;
        hits.push({
          id: d.id,
          type: "Document",
          title: d.title || d.source_provider,
          snippet: snippetFrom(d.snippet || d.full_text),
          source: d.source_provider,
          date: d.indexed_at,
          departmentId: d.department_id ?? null,
          permissions: d.permissions,
          href: undefined,
        });
      }
    }
  }

  const { data: actsRaw, error: aErr } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(120);
  const ql = q.toLowerCase();
  const acts = !aErr && Array.isArray(actsRaw)
    ? actsRaw.filter((a) => {
        const et = (a.event_type ?? "").toLowerCase();
        const pj = JSON.stringify(a.payload ?? {}).toLowerCase();
        return et.includes(ql) || pj.includes(ql);
      }).slice(0, 22)
    : [];
  if (acts.length > 0) {
    for (const a of acts) {
      const pl = (a.payload ?? {}) as Record<string, unknown>;
      hits.push({
        id: a.id,
        type: "Activity",
        title: `${a.event_type}`,
        snippet: snippetFrom(JSON.stringify(pl)),
        source: "activity_log",
        date: a.created_at,
        owner: undefined,
        departmentId: (a as { department_id?: string | null }).department_id ?? null,
        permissions: { scope: "tenant" },
        href: "/dashboard/activity",
      });
    }
  }

  if (like) {
    const { data: reps, error: rErr } = await supabase
      .from("report_templates")
      .select("*")
      .eq("company_id", companyId)
      .ilike("name", like)
      .order("updated_at", { ascending: false })
      .limit(18);
    if (!rErr && Array.isArray(reps)) {
      for (const r of reps) {
        hits.push({
          id: r.id,
          type: "Report",
          title: r.name,
          snippet: snippetFrom(JSON.stringify(r.definition ?? {})),
          source: "report_templates",
          date: r.updated_at ?? r.created_at,
          departmentId: r.department_id ?? null,
          permissions: { scope: "tenant" },
          href: "/reports",
        });
      }
    }
  }

  return hits;
}

function parseCompositeId(raw: string): { type: SearchHit["type"]; id: string } | null {
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const typeStr = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!UUID_RE.test(id)) return null;
  const t = typeStr as SearchHit["type"];
  if (t !== "Entity" && t !== "Document" && t !== "Activity" && t !== "Report") return null;
  return { type: t, id };
}

const EXPORT_FIELD_DEFAULTS = [
  "id",
  "type",
  "title",
  "snippet",
  "source",
  "date",
  "owner",
  "departmentId",
] as const;

function exportRowsToCsv(rows: Record<string, unknown>[], keys: string[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => esc(row[k])).join(","));
  }
  return lines.join("\n");
}

async function loadSearchHitForPreview(
  supabase: SupabaseClient,
  companyId: string,
  profile: { roles: string[]; department: string | null },
  type: SearchHit["type"],
  id: string,
): Promise<SearchHit | null> {
  if (type === "Entity") {
    const { data: row } = await supabase
      .from("unified_entities")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("is_deleted", false)
      .maybeSingle();
    if (!row) return null;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const ht = hitTypeFromEntityType(row.entity_type);
    return {
      id: row.id,
      type: ht,
      subType: ht === "Entity" ? row.entity_type : undefined,
      title: payloadTitle(payload, row.entity_type),
      snippet: snippetFrom(JSON.stringify(payload)),
      source: "unified",
      date: row.updated_at ?? row.created_at,
      owner: payloadOwner(payload),
      departmentId: row.department_id ?? null,
      permissions: { scope: "tenant" },
      href: row.department_id
        ? `/dashboard/departments/${row.department_id}`
        : "/dashboard/departments",
    };
  }
  if (type === "Document") {
    const { data: doc } = await supabase
      .from("indexed_documents")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (doc) {
      if (!docVisible(doc.permissions, profile.roles, profile.department)) return null;
      return {
        id: doc.id,
        type: "Document",
        title: doc.title || doc.source_provider,
        snippet: snippetFrom(doc.snippet || doc.full_text),
        source: doc.source_provider,
        date: doc.indexed_at,
        departmentId: doc.department_id ?? null,
        permissions: doc.permissions,
        href: undefined,
      };
    }
    const { data: ent } = await supabase
      .from("unified_entities")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("is_deleted", false)
      .maybeSingle();
    if (!ent || ent.entity_type !== "Document") return null;
    const payload = (ent.payload ?? {}) as Record<string, unknown>;
    return {
      id: ent.id,
      type: "Document",
      title: payloadTitle(payload, "Document"),
      snippet: snippetFrom(JSON.stringify(payload)),
      source: "unified",
      date: ent.updated_at ?? ent.created_at,
      owner: payloadOwner(payload),
      departmentId: ent.department_id ?? null,
      permissions: { scope: "tenant" },
      href: undefined,
    };
  }
  if (type === "Activity") {
    const { data: a } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!a) return null;
    const pl = (a.payload ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      type: "Activity",
      title: `${a.event_type}`,
      snippet: snippetFrom(JSON.stringify(pl)),
      source: "activity_log",
      date: a.created_at,
      owner: undefined,
      departmentId: (a as { department_id?: string | null }).department_id ?? null,
      permissions: { scope: "tenant" },
      href: "/dashboard/activity",
    };
  }
  const { data: r } = await supabase
    .from("report_templates")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!r) return null;
  return {
    id: r.id,
    type: "Report",
    title: r.name,
    snippet: snippetFrom(JSON.stringify(r.definition ?? {})),
    source: "report_templates",
    date: r.updated_at ?? r.created_at,
    departmentId: r.department_id ?? null,
    permissions: { scope: "tenant" },
    href: "/reports",
  };
}

async function summarizeLinesWithOpenAI(lines: string[]): Promise<{ summary: string; confidence: number }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      summary:
        "AI summarization requires OPENAI_API_KEY on the search-api function.\n\n" + lines.join("\n\n"),
      confidence: 0.35,
    };
  }
  const sys =
    "Summarize the following tenant-scoped record in 2-4 bullet points. Do not invent facts. Cite the source type in each bullet.";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: lines.join("\n---\n") },
      ],
    }),
  });
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "Unable to summarize.";
  const confidence = typeof json?.choices?.[0]?.finish_reason === "string" ? 0.88 : 0.82;
  return { summary: typeof text === "string" ? text : String(text), confidence };
}

async function logActivity(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    event_type: eventType,
    actor_user_id: userId,
    payload,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const op = parsed.data;
    const profile = await loadProfile(supabase, userId);
    const companyId = profile.company_id;
    assertCompany(companyId);

    switch (op.op) {
      case "search.global": {
        const q = op.query.trim();
        const page = op.page ?? 1;
        const pageSize = op.pageSize ?? 20;
        if (q.length < 2) {
          return new Response(
            JSON.stringify({ data: { total: 0, results: [], facets: { types: {}, sources: {} } } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const entityDeptFilter = asUuidOrNull(op.filters?.departmentId);
        const hits = await buildSearchHits(
          supabase,
          companyId,
          profile,
          q,
          entityDeptFilter,
        );

        const filtered = applyFilters(hits, op.filters, "");
        filtered.sort((a, b) => parseHitDate(b.date) - parseHitDate(a.date));

        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const pageRows = filtered.slice(start, start + pageSize);
        const facets = facetsFrom(filtered);

        await logActivity(supabase, companyId, userId, "search.global", {
          query: q,
          total,
          page,
        });

        return new Response(
          JSON.stringify({
            data: {
              total,
              results: pageRows,
              facets,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.autosuggest": {
        const q = op.q.trim().toLowerCase();
        const lim = op.limit ?? 10;
        if (q.length < 1) {
          return new Response(JSON.stringify({ data: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const suggestions: { text: string; type: string; score: number }[] = [];
        const seen = new Set<string>();

        const { data: entRows } = await supabase.rpc("search_unified_entities", {
          p_search: q,
          p_entity_type: null,
          p_department_id: null,
          p_limit: 12,
        });
        if (Array.isArray(entRows)) {
          for (const row of entRows) {
            const payload = (row.payload ?? {}) as Record<string, unknown>;
            const t = payloadTitle(payload, row.entity_type);
            const key = t.toLowerCase();
            if (!seen.has(key) && t.length > 0) {
              seen.add(key);
              suggestions.push({ text: t, type: row.entity_type, score: 0.9 });
            }
          }
        }

        const safeAs = sanitizeIlikePattern(op.q);
        const likeAs = `%${safeAs}%`;
        const { data: docRows } = await supabase
          .from("indexed_documents")
          .select("title, source_provider")
          .eq("company_id", companyId)
          .ilike("title", likeAs)
          .limit(8);
        if (Array.isArray(docRows)) {
          for (const d of docRows) {
            const t = d.title || d.source_provider;
            const key = t.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              suggestions.push({ text: t, type: "Document", score: 0.75 });
            }
          }
        }

        return new Response(
          JSON.stringify({ data: suggestions.slice(0, lim) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.aiSummarize": {
        if (!canUseSearchAi(profile.roles)) {
          return new Response(
            JSON.stringify({ error: "AI summarization is not available for your role." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const lines: string[] = [];
        for (const item of op.contextItems) {
          if (item.type === "Entity") {
            const { data: entity } = await supabase
              .from("unified_entities")
              .select("entity_type, payload")
              .eq("id", item.id)
              .eq("company_id", companyId)
              .eq("is_deleted", false)
              .maybeSingle();
            if (entity) {
              lines.push(`Entity ${item.id} (${entity.entity_type}): ${JSON.stringify(entity.payload)}`);
            }
          } else if (item.type === "Document") {
            const { data: doc } = await supabase
              .from("indexed_documents")
              .select("title, snippet, full_text, source_provider, permissions")
              .eq("id", item.id)
              .eq("company_id", companyId)
              .maybeSingle();
            if (doc && docVisible(doc.permissions ?? {}, profile.roles, profile.department)) {
              lines.push(
                `Document ${item.id} (${doc.source_provider}): ${doc.title} — ${snippetFrom(doc.snippet || doc.full_text, 400)}`,
              );
            } else {
              const { data: ent } = await supabase
                .from("unified_entities")
                .select("entity_type, payload")
                .eq("id", item.id)
                .eq("company_id", companyId)
                .eq("is_deleted", false)
                .maybeSingle();
              if (ent?.entity_type === "Document") {
                const payload = (ent.payload ?? {}) as Record<string, unknown>;
                lines.push(
                  `Document (unified) ${item.id}: ${payloadTitle(payload, "Document")} — ${snippetFrom(JSON.stringify(payload), 400)}`,
                );
              }
            }
          } else if (item.type === "Activity") {
            const { data: act } = await supabase
              .from("activity_logs")
              .select("event_type, payload")
              .eq("id", item.id)
              .eq("company_id", companyId)
              .maybeSingle();
            if (act) {
              lines.push(`Activity ${item.id}: ${act.event_type} ${JSON.stringify(act.payload)}`);
            }
          } else if (item.type === "Report") {
            const { data: rep } = await supabase
              .from("report_templates")
              .select("name, definition")
              .eq("id", item.id)
              .eq("company_id", companyId)
              .maybeSingle();
            if (rep) {
              lines.push(`Report ${item.id}: ${rep.name} ${JSON.stringify(rep.definition)}`);
            }
          }
        }

        if (lines.length === 0) {
          return new Response(JSON.stringify({ error: "No permitted context" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              data: {
                summary:
                  "AI summarization requires OPENAI_API_KEY on the search-api function. Showing stitched snippets instead:\n\n" +
                  lines.join("\n\n"),
                confidence: 0.35,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const sys =
          "Summarize the following tenant-scoped search results in 3-5 bullet points. Do not invent facts. If data is thin, say so.";
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: lines.join("\n---\n") },
            ],
          }),
        });
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content ?? "Unable to summarize.";
        const confidence = typeof json?.choices?.[0]?.finish_reason === "string" ? 0.88 : 0.82;

        const summaryText = typeof text === "string" ? text : String(text);

        await supabase.from("ai_search_summary_logs").insert({
          company_id: companyId,
          user_id: userId,
          context_items: op.contextItems,
          summary: summaryText,
          confidence,
        });

        await supabase.from("ai_action_logs").insert({
          company_id: companyId,
          user_id: userId,
          action_name: "search.ai_summarize",
          status: "completed",
          details: {
            itemCount: op.contextItems.length,
            requiredPermissions: op.requiredPermissions ?? [],
          },
        });

        await logActivity(supabase, companyId, userId, "search.ai_summarize", {
          items: op.contextItems,
        });

        return new Response(
          JSON.stringify({ data: { summary: summaryText, confidence } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.indexDocument": {
        if (!canMutateIndex(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (op.tenantId && op.tenantId !== companyId) {
          return new Response(JSON.stringify({ error: "Tenant mismatch" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const title = op.title ?? "Untitled";
        const snippet = op.snippet ?? snippetFrom(op.content ?? "");
        const extId = op.externalId ?? "";
        const row = {
          company_id: companyId,
          source_provider: op.provider,
          external_id: extId,
          title,
          full_text: op.content ?? null,
          snippet,
          embedding: op.embeddings ? op.embeddings : null,
          indexed_at: new Date().toISOString(),
          metadata: op.metadata ?? {},
          permissions: op.permissions ?? { scope: "tenant" },
          department_id: op.departmentId ?? null,
          updated_at: new Date().toISOString(),
        };

        let resultId: string;
        if (op.documentId) {
          const { data, error } = await supabase
            .from("indexed_documents")
            .update(row)
            .eq("id", op.documentId)
            .eq("company_id", companyId)
            .select("id")
            .single();
          if (error) throw error;
          resultId = data!.id;
        } else {
          const { data, error } = await supabase
            .from("indexed_documents")
            .upsert(row, { onConflict: "company_id,source_provider,external_id" })
            .select("id")
            .single();
          if (error) throw error;
          resultId = data!.id;
        }

        await supabase.from("search_index_jobs").insert({
          company_id: companyId,
          status: "ok",
          provider: op.provider,
          message: `upsert ${resultId}`,
        });

        return new Response(
          JSON.stringify({ data: { id: resultId, indexed: true } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "kb.documents.ingestBulk": {
        if (!canMutateIndex(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY") ?? null;
        const results: Array<{
          filename: string;
          id?: string;
          title?: string;
          sourceProvider?: string;
          chunkCount?: number;
          indexStatus: "ready" | "failed";
          message: string;
        }> = [];

        for (const doc of op.documents) {
          const filename = sanitizeFileName(doc.filename);
          try {
            const bytes = decodeBase64ToBytes(doc.base64);
            const storagePath = await uploadKnowledgeFile(
              supabase,
              companyId,
              bytes,
              filename,
              doc.mimeType,
            );
            const indexed = await runIndexingForDocument({
              supabase,
              companyId,
              userId,
              apiKey,
              input: {
                ...doc,
                filename,
              },
              bytes,
              storagePath,
            });
            results.push({
              filename,
              id: indexed.id,
              title: indexed.title,
              sourceProvider: indexed.sourceProvider,
              chunkCount: indexed.chunkCount,
              indexStatus: indexed.indexStatus,
              message: indexed.message,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Indexing failed";
            await supabase.from("search_index_jobs").insert({
              company_id: companyId,
              status: "failed",
              provider: doc.provider ?? "uploads",
              message: `kb ingest failed (${filename}): ${message}`.slice(0, 500),
            });
            results.push({
              filename,
              indexStatus: "failed",
              message,
            });
          }
        }

        const failed = results.filter((r) => r.indexStatus === "failed").length;
        await logActivity(supabase, companyId, userId, "kb.documents.ingest_bulk", {
          count: op.documents.length,
          failed,
        });

        return new Response(
          JSON.stringify({
            data: {
              results,
              summary: {
                total: results.length,
                failed,
                ready: results.length - failed,
              },
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "kb.documents.list": {
        const lim = op.limit ?? 120;
        let query = supabase
          .from("indexed_documents")
          .select("id, source_provider, external_id, title, snippet, metadata, permissions, department_id, updated_at, indexed_at, index_status, chunk_count, last_indexed_at, index_error, storage_path, mime_type, file_size")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(lim);

        if (op.sourceFilter?.trim()) {
          query = query.ilike("source_provider", `%${op.sourceFilter.trim()}%`);
        }
        if (op.statusFilter) {
          query = query.eq("index_status", op.statusFilter);
        }
        const { data, error } = await query;
        if (error) throw error;
        const all = Array.isArray(data) ? data : [];
        const rows = canMutateIndex(profile.roles)
          ? all
          : all.filter((row) =>
              docVisible(row.permissions, profile.roles, profile.department)
            );

        return new Response(
          JSON.stringify({
            data: {
              items: rows.map((row) => ({
                id: row.id,
                sourceProvider: row.source_provider,
                externalId: row.external_id ?? "",
                title: row.title ?? row.source_provider,
                snippet: row.snippet ?? "",
                metadata: row.metadata ?? {},
                permissions: row.permissions ?? { scope: "tenant" },
                departmentId: row.department_id ?? null,
                updatedAt: row.updated_at,
                indexedAt: row.indexed_at,
                indexStatus: row.index_status ?? "pending",
                chunkCount: typeof row.chunk_count === "number" ? row.chunk_count : 0,
                lastIndexedAt: row.last_indexed_at ?? null,
                indexError: row.index_error ?? null,
                storagePath: row.storage_path ?? null,
                mimeType: row.mime_type ?? null,
                fileSize: typeof row.file_size === "number" ? row.file_size : null,
              })),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "kb.documents.delete": {
        if (!canMutateIndex(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existing, error: readErr } = await supabase
          .from("indexed_documents")
          .select("id, source_provider, storage_path")
          .eq("id", op.documentId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (typeof existing.storage_path === "string" && existing.storage_path.length > 0) {
          await supabase.storage.from(KB_BUCKET).remove([existing.storage_path]);
        }

        const { error: delErr } = await supabase
          .from("indexed_documents")
          .delete()
          .eq("id", op.documentId)
          .eq("company_id", companyId);
        if (delErr) throw delErr;

        await supabase.from("search_index_jobs").insert({
          company_id: companyId,
          status: "ok",
          provider: existing.source_provider ?? "uploads",
          message: `kb delete ${op.documentId}`,
        });
        await logActivity(supabase, companyId, userId, "kb.documents.delete", {
          documentId: op.documentId,
        });

        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kb.documents.reindex": {
        if (!canMutateIndex(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: existing, error: readErr } = await supabase
          .from("indexed_documents")
          .select("id, source_provider, external_id, title, metadata, permissions, storage_path, mime_type, file_size, full_text")
          .eq("id", op.documentId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const storagePath = typeof existing.storage_path === "string" ? existing.storage_path : "";
        let bytes: Uint8Array | null = null;
        if (storagePath) {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(KB_BUCKET)
            .download(storagePath);
          if (dlErr) {
            throw new Error(dlErr.message);
          }
          bytes = new Uint8Array(await blob.arrayBuffer());
        } else if (typeof existing.full_text === "string" && existing.full_text.trim()) {
          bytes = new TextEncoder().encode(existing.full_text);
        }

        if (!bytes) {
          return new Response(
            JSON.stringify({ error: "No stored source found to reindex this document" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const p = existing.permissions && typeof existing.permissions === "object"
          ? (existing.permissions as Record<string, unknown>)
          : {};
        const visibility: KbVisibility = {
          scope: p.scope === "restricted" ? "restricted" : "tenant",
          roles: Array.isArray(p.roles)
            ? p.roles.map((r) => String(r))
            : [],
          departments: Array.isArray(p.departments)
            ? p.departments.map((d) => String(d))
            : [],
        };

        const indexed = await runIndexingForDocument({
          supabase,
          companyId,
          userId,
          apiKey: Deno.env.get("OPENAI_API_KEY") ?? null,
          input: {
            filename: typeof existing.title === "string" ? `${existing.title}.txt` : "document.txt",
            mimeType:
              typeof existing.mime_type === "string" && existing.mime_type
                ? existing.mime_type
                : "text/plain",
            sizeBytes:
              typeof existing.file_size === "number" && existing.file_size > 0
                ? existing.file_size
                : bytes.length,
            base64: "",
            title: typeof existing.title === "string" ? existing.title : "Untitled",
            externalId: typeof existing.external_id === "string" ? existing.external_id : undefined,
            provider: typeof existing.source_provider === "string" ? existing.source_provider : "uploads",
            metadata:
              existing.metadata && typeof existing.metadata === "object"
                ? (existing.metadata as Record<string, unknown>)
                : {},
            visibility,
          },
          bytes,
          storagePath: storagePath || null,
          existingDocumentId: op.documentId,
        });

        return new Response(
          JSON.stringify({ data: { ok: true, document: indexed } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.indexStatus": {
        const { count, error: cErr } = await supabase
          .from("indexed_documents")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId);
        if (cErr) throw cErr;

        const { data: lastRow } = await supabase
          .from("indexed_documents")
          .select("indexed_at")
          .eq("company_id", companyId)
          .order("indexed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: jobs } = await supabase
          .from("search_index_jobs")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(12);

        const jobList = Array.isArray(jobs) ? jobs : [];
        const errors = jobList.filter((j) => j.status !== "ok").map((j) => j.message ?? j.status);

        return new Response(
          JSON.stringify({
            data: {
              status: "healthy",
              documentCount: count ?? 0,
              lastIndexTime: lastRow?.indexed_at ?? null,
              recentJobs: jobList,
              errors,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.savedList": {
        const { data, error } = await supabase
          .from("saved_searches")
          .select("id, name, query, filters, created_at, updated_at, user_id")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(80);
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        return new Response(JSON.stringify({ data: list }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search.savedCreate": {
        const filters = op.filters ?? {};
        const { data, error } = await supabase
          .from("saved_searches")
          .insert({
            company_id: companyId,
            user_id: userId,
            name: op.name.trim(),
            query: op.query,
            filters,
            updated_at: new Date().toISOString(),
          })
          .select("id, name, query, filters, created_at, updated_at, user_id")
          .single();
        if (error) throw error;
        await logActivity(supabase, companyId, userId, "search.saved_create", {
          savedId: data?.id,
          name: op.name,
        });
        return new Response(JSON.stringify({ data: { success: true, savedSearch: data } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search.savedDelete": {
        const { error } = await supabase
          .from("saved_searches")
          .delete()
          .eq("id", op.id)
          .eq("company_id", companyId)
          .eq("user_id", userId);
        if (error) throw error;
        return new Response(JSON.stringify({ data: { success: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search.preview": {
        const ids = parseCompositeId(op.compositeId.trim());
        if (!ids) {
          return new Response(JSON.stringify({ error: "Invalid preview id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const hit = await loadSearchHitForPreview(
          supabase,
          companyId,
          profile,
          ids.type,
          ids.id,
        );
        if (!hit) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        let aiSummary: string | undefined;
        let confidence: number | undefined;
        if (op.generateAi === true) {
          if (!canUseSearchAi(profile.roles)) {
            return new Response(
              JSON.stringify({
                data: {
                  result: hit,
                  aiSummary: undefined,
                  aiRestricted: true,
                  provenance: `tenant:${companyId}`,
                },
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const line =
            `${hit.type} ${hit.id} (${hit.source}): ${hit.title} — ${snippetFrom(hit.snippet, 600)}`;
          const out = await summarizeLinesWithOpenAI([line]);
          aiSummary = out.summary;
          confidence = out.confidence;
          await supabase.from("ai_search_summary_logs").insert({
            company_id: companyId,
            user_id: userId,
            context_items: [{ id: hit.id, type: hit.type, source: hit.source }],
            summary: aiSummary,
            confidence: confidence ?? null,
          });
        }
        return new Response(
          JSON.stringify({
            data: {
              result: hit,
              aiSummary,
              confidence,
              provenance: `${hit.source} · tenant ${companyId}`,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "search.export": {
        const q = op.query.trim();
        if (q.length < 2) {
          const emptyKeys = [...EXPORT_FIELD_DEFAULTS] as string[];
          const empty = op.format === "json" ? "[]" : exportRowsToCsv([], emptyKeys);
          return new Response(
            JSON.stringify({
              data: {
                content: empty,
                filename: `search-export-empty.${op.format}`,
                mimeType: op.format === "json" ? "application/json" : "text/csv",
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const entityDeptFilter = asUuidOrNull(op.filters?.departmentId);
        const hits = await buildSearchHits(supabase, companyId, profile, q, entityDeptFilter);
        const filtered = applyFilters(hits, op.filters, "");
        const maxRows = op.maxRows ?? 500;
        const slice = filtered.slice(0, maxRows);
        const allowed = new Set(
          Array.isArray(op.fields) && op.fields.length > 0
            ? op.fields.filter((f) => (EXPORT_FIELD_DEFAULTS as readonly string[]).includes(f))
            : [...EXPORT_FIELD_DEFAULTS],
        );
        const keys = [...allowed];
        const rows: Record<string, unknown>[] = slice.map((h) => {
          const base: Record<string, unknown> = {};
          for (const k of keys) {
            if (k === "id") base.id = h.id;
            else if (k === "type") base.type = h.type;
            else if (k === "title") base.title = h.title;
            else if (k === "snippet") base.snippet = h.snippet;
            else if (k === "source") base.source = h.source;
            else if (k === "date") base.date = h.date;
            else if (k === "owner") base.owner = h.owner ?? "";
            else if (k === "departmentId") base.departmentId = h.departmentId ?? "";
          }
          return base;
        });
        const content =
          op.format === "json"
            ? JSON.stringify(rows, null, 2)
            : exportRowsToCsv(rows, keys);
        const filename = `search-export-${new Date().toISOString().slice(0, 10)}.${op.format}`;
        await logActivity(supabase, companyId, userId, "search.export", {
          format: op.format,
          rowCount: rows.length,
        });
        return new Response(
          JSON.stringify({
            data: {
              content,
              filename,
              mimeType: op.format === "json" ? "application/json" : "text/csv",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Unsupported" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
