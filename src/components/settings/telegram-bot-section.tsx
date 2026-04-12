import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTelegramBotConfig,
  removeTelegramBotConfig,
  saveTelegramBotConfig,
} from "@/lib/telegram-api";

export function TelegramBotSection() {
  const queryClient = useQueryClient();
  const [tokenInput, setTokenInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["telegramBotConfig"],
    queryFn: getTelegramBotConfig,
  });

  const config = data?.config ?? null;
  const isConnected = !!config;

  const saveMutation = useMutation({
    mutationFn: () => saveTelegramBotConfig(tokenInput.trim()),
    onSuccess: (result) => {
      toast.success(`Telegram bot @${result.botUsername} connected successfully.`);
      setTokenInput("");
      queryClient.invalidateQueries({ queryKey: ["telegramBotConfig"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to connect Telegram bot.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeTelegramBotConfig,
    onSuccess: () => {
      toast.success("Telegram bot disconnected.");
      queryClient.invalidateQueries({ queryKey: ["telegramBotConfig"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to disconnect Telegram bot.");
    },
  });

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Telegram Bot</CardTitle>
          {isConnected && (
            <Badge variant="secondary" className="ml-auto flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Let your users interact with the AI directly from Telegram. Create a bot via{" "}
          <span className="font-medium text-foreground">@BotFather</span>, paste the token
          below, and users can start chatting instantly.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : isConnected ? (
          // ---- Connected state ----
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                @{config.bot_username ?? "unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {config.bot_name ?? "Telegram Bot"} · connected{" "}
                {new Date(config.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          </div>
        ) : (
          // ---- Setup state ----
          <div className="space-y-4">
            {/* Setup instructions */}
            <ol className="space-y-1 text-sm text-muted-foreground list-none">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  1
                </span>
                Open Telegram and search for{" "}
                <span className="font-medium text-foreground">@BotFather</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  2
                </span>
                Send <span className="font-mono text-foreground">/newbot</span> and follow
                the prompts to name your bot
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  3
                </span>
                Copy the API token BotFather gives you and paste it below
              </li>
            </ol>

            {/* Token input */}
            <div className="space-y-2">
              <Label htmlFor="tg-bot-token">Bot Token</Label>
              <div className="flex gap-2">
                <Input
                  id="tg-bot-token"
                  type="password"
                  placeholder="123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!tokenInput.trim() || saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Connect
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The token is encrypted and stored securely. It is never exposed after saving.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
