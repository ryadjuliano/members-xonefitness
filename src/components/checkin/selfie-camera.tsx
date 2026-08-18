"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function SelfieCamera({
  onCapture,
  onError,
}: {
  onCapture: (blob: Blob) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err: unknown) => {
        onErrorRef.current?.(err instanceof Error ? err.message : "Tidak bisa mengakses kamera depan.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontally so the captured photo matches what the member saw in preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.85);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
      </div>
      <Button className="w-full" onClick={capture}>
        Ambil Foto
      </Button>
    </div>
  );
}
