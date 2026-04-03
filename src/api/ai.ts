/**
 * AI Assistant & Agent layer — Edge Function `ai-api` (fetch-based, see `lib/ai-api.ts`).
 */
export {
  assemblePrompt,
  completeAiChat,
  createAiConversation,
  executeAiAction,
  fetchAiContexts,
  fetchAiDashboardSummary,
  fetchExecutiveBrief,
  fetchAiPermissions,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  streamAiChat,
  updateAiConversation,
} from "@/lib/ai-api";
