"use client";

import { useEffect, useRef } from "react";

export function QrScanner({
  onDecode,
  onError,
}: {
  onDecode: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Refs so the camera doesn't restart every time the parent re-renders
  // with a fresh inline callback — the mount effect below only runs once.
  const onDecodeRef = useRef(onDecode);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDecodeRef.current = onDecode;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    let scanner: import("qr-scanner").default | null = null;

    import("qr-scanner").then(({ default: QrScannerLib }) => {
      if (cancelled || !videoRef.current) return;
      scanner = new QrScannerLib(videoRef.current, (result) => onDecodeRef.current(result.data), {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: "environment",
      });
      scanner.start().catch((err: unknown) => {
        onErrorRef.current?.(err instanceof Error ? err.message : "Tidak bisa mengakses kamera.");
      });
    });

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
    </div>
  );
}
