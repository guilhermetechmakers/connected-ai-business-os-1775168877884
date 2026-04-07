/**
 * AI Assistant & Agent layer — Edge Function `ai-api` (fetch-based, see `lib/ai-api.ts`).
 */
export {
  assemblePrompt,
  completeAiChat,
  createAiConversation,
  executeAiAction,
  fetchAiContexts,
  fetchAiDashboardInsights,
  fetchAiDashboardSummary,
  runAiToolsDiagnostics,
  fetchExecutiveBrief,
  fetchAiPermissions,
  fetchWorkspaceDocuments,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  streamAiChat,
  updateAiConversation,
  upsertPromptTemplate,
} from "@/lib/ai-api";
