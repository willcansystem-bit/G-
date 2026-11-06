import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function validateAvatar(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
}

export function AvatarEditor({
  onSave,
  busy,
}: {
  onSave: (blob: Blob) => Promise<void>;
  busy: boolean;
}) {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const canvas = useRef<HTMLCanvasElement>(null);
  const request = useRef(0);
  useEffect(() => () => image?.close(), [image]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    const side = Math.min(image.width, image.height) / zoom;
    context?.clearRect(0, 0, 512, 512);
    context?.drawImage(
      image,
      ((image.width - side) * horizontal) / 100,
      ((image.height - side) * vertical) / 100,
      side,
      side,
      0,
      0,
      512,
      512,
    );
  }, [image, zoom, horizontal, vertical]);
  return (
    <div className="space-y-3">
      <label className="block">
        Adicionar ou substituir foto
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="mt-2 block w-full text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const version = ++request.current;
            try {
              validateAvatar(file);
              const bitmap = await createImageBitmap(file);
              if (
                bitmap.width * bitmap.height > 40000000 ||
                Math.min(bitmap.width, bitmap.height) < 64
              ) {
                bitmap.close();
                throw new Error("Use uma imagem entre 64 pixels e 40 megapixels.");
              }
              if (version !== request.current) {
                bitmap.close();
                return;
              }
              setImage(bitmap);
              setZoom(1);
              setHorizontal(50);
              setVertical(50);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Imagem inválida.");
            }
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG ou WebP até 5 MB. A foto será recortada e otimizada para 512 × 512 pixels.
      </p>
      {image && (
        <>
          <canvas
            ref={canvas}
            width={512}
            height={512}
            aria-label="Prévia do recorte da foto"
            className="h-48 w-48 rounded-full border"
          />
          <label className="block">
            Zoom
            <input
              aria-label="Zoom da foto"
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="block w-full"
            />
          </label>
          <label className="block">
            Enquadramento horizontal
            <input
              aria-label="Enquadramento horizontal"
              type="range"
              min="0"
              max="100"
              value={horizontal}
              onChange={(event) => setHorizontal(Number(event.target.value))}
              className="block w-full"
            />
          </label>
          <label className="block">
            Enquadramento vertical
            <input
              aria-label="Enquadramento vertical"
              type="range"
              min="0"
              max="100"
              value={vertical}
              onChange={(event) => setVertical(Number(event.target.value))}
              className="block w-full"
            />
          </label>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              canvas.current?.toBlob(
                async (blob) => {
                  if (!blob) {
                    toast.error("Não foi possível otimizar a foto.");
                    return;
                  }
                  try {
                    await onSave(blob);
                    setImage(null);
                  } catch {
                    toast.error("Não foi possível salvar a foto. Tente novamente.");
                  }
                },
                "image/webp",
                0.85,
              )
            }
          >
            Salvar foto
          </Button>
          <Button type="button" variant="ghost" onClick={() => setImage(null)}>
            Cancelar recorte
          </Button>
        </>
      )}
    </div>
  );
}
