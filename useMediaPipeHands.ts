import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { Hands, type NormalizedLandmark, type Results } from '@mediapipe/hands';
import { lerpVec3 } from './math';
import type { TrackedHand, Vec3 } from './prism';

const SMOOTHING_ALPHA = 0.75;
const MEDIAPIPE_VERSION = '0.4.1675469240';

function mirroredPoint(point: NormalizedLandmark): Vec3 {
  return {
    x: 1 - point.x,
    y: point.y,
    z: point.z,
  };
}

function smoothPoint(previous: Vec3 | undefined, next: Vec3): Vec3 {
  return previous ? lerpVec3(previous, next, SMOOTHING_ALPHA) : next;
}

export type HandTrackerState = {
  handsRef: MutableRefObject<TrackedHand[]>;
  ready: boolean;
  error: string | null;
  inferenceFps: number;
};

export function useMediaPipeHands(videoRef: RefObject<HTMLVideoElement | null>): HandTrackerState {
  const handsRef = useRef<TrackedHand[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inferenceFps, setInferenceFps] = useState(0);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let inFlight = false;
    let frameCount = 0;
    let fpsWindowStarted = performance.now();

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_VERSION}/${file}`,
    });

    hands.setOptions({
      selfieMode: false,
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    hands.onResults((results: Results) => {
      const detections = results.multiHandLandmarks
        .map((landmarks) => {
          const thumb = mirroredPoint(landmarks[4]);
          const index = mirroredPoint(landmarks[8]);
          return {
            thumb,
            index,
            centerX: (thumb.x + index.x) * 0.5,
          } satisfies TrackedHand;
        })
        .sort((a, b) => a.centerX - b.centerX);

      const previous = handsRef.current;
      const smoothed = detections.map((current, index) => {
        const prev = previous[index];
        const thumb = smoothPoint(prev?.thumb, current.thumb);
        const indexTip = smoothPoint(prev?.index, current.index);
        return {
          thumb,
          index: indexTip,
          centerX: (thumb.x + indexTip.x) * 0.5,
        } satisfies TrackedHand;
      });

      handsRef.current = smoothed;
      frameCount += 1;
      const now = performance.now();
      if (now - fpsWindowStarted >= 750) {
        if (!disposed) setInferenceFps(Math.round((frameCount * 1000) / (now - fpsWindowStarted)));
        frameCount = 0;
        fpsWindowStarted = now;
      }
    });

    const infer = async () => {
      if (disposed) return;
      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !inFlight) {
        inFlight = true;
        try {
          await hands.send({ image: video });
        } catch (cause) {
          if (!disposed) {
            setError(cause instanceof Error ? cause.message : 'Falha ao processar as mãos.');
          }
        } finally {
          inFlight = false;
        }
      }
      raf = requestAnimationFrame(infer);
    };

    void hands
      .initialize()
      .then(() => {
        if (!disposed) {
          setReady(true);
          raf = requestAnimationFrame(infer);
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Falha ao iniciar o MediaPipe Hands.');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      handsRef.current = [];
      void hands.close();
    };
  }, [videoRef]);

  return { handsRef, ready, error, inferenceFps };
}
