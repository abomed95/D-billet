/**
 * Reads QR codes from a live camera feed.
 *
 * Both scanner screens used to show the camera without ever decoding anything:
 * the controller had to read the code and type it in. On a train or a ferry
 * that is unworkable.
 *
 * Prefers the native BarcodeDetector, which recent Chrome on Android exposes.
 * It decodes inside the browser, costs nothing in bundle size and is markedly
 * faster on a low-end phone. Where it is missing - iOS Safari, older Android -
 * jsQR is imported on demand, so the devices that do have the native API never
 * download it.
 */

// Four attempts a second: fast enough to feel instant, light enough to leave
// the phone responsive.
const SCAN_INTERVAL_MS = 250;

let jsQrLoader = null;

const loadJsQr = () => {
  if (!jsQrLoader) {
    jsQrLoader = import(/* webpackChunkName: "qr-decoder" */ 'jsqr')
      .then((module) => module.default || module);
  }
  return jsQrLoader;
};

/** A BarcodeDetector limited to QR codes, or null when unavailable. */
const nativeDetector = () => {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return null;
  }
  try {
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch (error) {
    return null;
  }
};

export const hasNativeQrDetector = () => nativeDetector() !== null;

/**
 * Start scanning `video` until a QR code is read.
 *
 * Calls `onDecode(text)` once with the decoded content, then stops: the caller
 * shows its result and starts a new scan when ready. Returns a stop function,
 * which must be called when unmounting.
 */
export const startQrScanner = ({ video, canvas, onDecode, onEngine }) => {
  let stopped = false;
  let timer = null;
  let detector = nativeDetector();
  let announced = false;

  const announce = (engine) => {
    if (!announced && onEngine) {
      announced = true;
      onEngine(engine);
    }
  };

  const decodeViaCanvas = async () => {
    // videoWidth on a live stream; naturalWidth lets a still image stand in.
    const width = video.videoWidth || video.naturalWidth || video.width;
    const height = video.videoHeight || video.naturalHeight || video.height;
    if (!width || !height || !canvas) {
      return null;
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const decode = await loadJsQr();
    announce('jsqr');
    const found = decode(frame.data, width, height, { inversionAttempts: 'dontInvert' });
    return (found && found.data) || null;
  };

  const tick = async () => {
    if (stopped) {
      return;
    }
    try {
      let text = null;
      if (detector) {
        const codes = await detector.detect(video);
        announce('native');
        text = (codes && codes[0] && codes[0].rawValue) || null;
      } else {
        text = await decodeViaCanvas();
      }
      if (text && !stopped) {
        stopped = true;
        onDecode(text);
        return;
      }
    } catch (error) {
      // A detector that throws is usually unavailable for good (some browsers
      // advertise the API without shipping the QR decoder), so drop to jsQR
      // rather than failing every frame.
      if (detector) {
        detector = null;
        announced = false;
      }
    }
    if (!stopped) {
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    }
  };

  tick();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
};
