import { useEffect, useRef } from "react";
import jsQR from "jsqr";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function detector() {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function QrScan({
  stream,
  onClose,
  onResult,
}: {
  stream: MediaStream;
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stop = false;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const reader = detector();

    async function tick() {
      if (stop || done.current || !video || video.readyState < 2) {
        if (!stop) requestAnimationFrame(() => void tick());
        return;
      }
      let text = "";
      if (reader) {
        const codes = await reader.detect(video).catch(() => []);
        text = codes[0]?.rawValue ?? "";
      }
      if (!text && ctx && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        text = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? "";
      }
      if (text) {
        done.current = true;
        onResultRef.current(text);
        return;
      }
      if (!stop) requestAnimationFrame(() => void tick());
    }

    const id = requestAnimationFrame(() => void tick());
    return () => {
      stop = true;
      cancelAnimationFrame(id);
    };
  }, [stream]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}>
      <video ref={videoRef} className="min-h-0 flex-1 object-cover" autoPlay muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-56 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <p className="text-sm">Point the camera at the destination QR code.</p>
        <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
