import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { AlertTriangle, Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  /** Called once with the decoded text; the camera stops immediately after. */
  onDecode: (text: string) => void;
}

/**
 * Camera QR scanning, inline rather than behind a dialog so it sits alongside
 * the other two ways of supplying a credential.
 *
 * getUserMedia needs HTTPS or localhost, and the camera is only opened on an
 * explicit click — never on mount.
 */
export function QrScanner({ onDecode }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  // Always release the camera when this component goes away.
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setActive(true);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const tick = () => {
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState < video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.drawImage(video, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);

        if (code) {
          stop();
          onDecode(code.data);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      setError(
        (err as Error).name === "NotAllowedError"
          ? "Camera permission was denied. Allow access in your browser, then try again."
          : "Could not start the camera. It may be in use by another application.",
      );
      stop();
    }
  };

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${active ? "" : "invisible"}`}
          playsInline
          muted
          aria-label="Camera preview"
        />

        {active && (
          // Reticle: shows where to hold the code without obscuring the frame.
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-40 w-40 rounded-lg border-2 border-primary/70 shadow-[0_0_0_9999px_hsl(0_0%_0%/0.35)]" />
          </div>
        )}

        {!active && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div>
              <Camera className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">
                Point the holder's QR code at your camera to fill everything in.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Frame capture only — never displayed. */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-3">
        {active ? (
          <Button variant="outline" className="w-full" onClick={stop}>
            <CameraOff className="h-4 w-4" aria-hidden="true" />
            Stop camera
          </Button>
        ) : (
          <Button className="w-full" onClick={start}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            Start camera
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-foreground/80">{error}</p>
        </div>
      )}
    </div>
  );
}
