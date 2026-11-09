export function skipRepeatedCameraSpeech(last, camera) {
  if (!last || camera == null || last.id == null) return false;
  const distance = Number(camera.distance);
  const previous = Number(last.distance);
  if (!Number.isFinite(distance) || !Number.isFinite(previous)) return false;
  return String(last.id) === String(camera.id) && previous - distance < 250;
}
