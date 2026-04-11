import { supabase } from "@/lib/supabase";
import type { TelegramBotConfig } from "@/types/telegram";

async function invoke<T>(op: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("telegram-setup-api", {
    body: { op, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

export async function getTelegramBotConfig(): Promise<{ config: TelegramBotConfig | null }> {
  return invoke("bot.get");
}

export async function saveTelegramBotConfig(
  botToken: string,
): Promise<{ ok: boolean; botUsername?: string }> {
  return invoke("bot.save", { botToken });
}

export async function removeTelegramBotConfig(): Promise<{ ok: boolean }> {
  return invoke("bot.remove");
}
