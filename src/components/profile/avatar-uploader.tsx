import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadProfileAvatar } from "@/lib/profile-api";

const MAX_DIM = 512;
const ACCEPT = "image/png,image/jpeg,image/webp";

async function fileToResizedBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image preview.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const mimeType =
    file.type === "image/png"
      ? "image/png"
      : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";
  const quality = mimeType === "image/jpeg" ? 0.88 : undefined;
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("Could not read image data.");
  return { base64, mimeType };
}

export type AvatarUploaderProps = {
  currentUrl?: string | null;
  displayName?: string | null;
  onUploaded: (url: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AvatarUploader({
  currentUrl,
  displayName,
  onUploaded,
  disabled,
  className,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const shown = preview ?? currentUrl ?? null;
  const initial = (displayName ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-surface-inner text-2xl font-bold text-primary shadow-inner",
          "transition-transform duration-150 motion-reduce:transform-none",
        )}
      >
        {shown ? (
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
        {isUploading ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/70"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Upload avatar image"
        disabled={disabled || isUploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setIsUploading(true);
          try {
            const { base64, mimeType } = await fileToResizedBase64(file);
            const dataUrl = `data:${mimeType};base64,${base64}`;
            setPreview(dataUrl);
            const { url } = await uploadProfileAvatar(base64, mimeType);
            setPreview(null);
            onUploaded(url);
            toast.success("Avatar updated");
          } catch (err) {
            setPreview(null);
            toast.error(err instanceof Error ? err.message : "Avatar upload failed");
          } finally {
            setIsUploading(false);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isUploading}
        className="transition-transform duration-150 hover:scale-[1.02] hover:border-primary/40"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="mr-2 h-4 w-4" aria-hidden />
        {isUploading ? "Uploading…" : "Change photo"}
      </Button>
    </div>
  );
}
