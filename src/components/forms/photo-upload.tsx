"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable photo picker: uploads directly to Vercel Blob and reports back the URL.
// The camera opens on mobile via the native capture attribute.
export function PhotoUpload({
  value,
  onChange,
  folder = "photos",
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(`${folder}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      onChange(blob.url);
    } catch {
      setError("Nepavyko įkelti nuotraukos. Patikrinkite ryšį arba bandykite kitą failą.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Nuotrauka"
            className="h-48 w-full rounded-lg border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Pašalinti nuotrauką"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground",
            uploading && "opacity-70"
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden /> Įkeliama...
            </>
          ) : (
            <>
              <Camera size={18} aria-hidden /> Pridėti nuotrauką
            </>
          )}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
