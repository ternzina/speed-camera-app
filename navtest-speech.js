export function skipRepeatedCameraSpeech(last, camera) {
  if (!last || camera == null || last.id == null) return false;
  const distance = Number(camera.distance);
  const previous = Number(last.distance);
  if (!Number.isFinite(distance) || !Number.isFinite(previous)) return false;
  return String(last.id) === String(camera.id) && previous - distance < 250;
}

let sharedSpeech = null;

export function noteNavtestCameraSpeech(camera) {
  if (!camera || camera.id == null) return sharedSpeech;
  const distance = Number(camera.distance);
  if (!Number.isFinite(distance)) return sharedSpeech;
  sharedSpeech = { id: String(camera.id), distance };
  return sharedSpeech;
}

export function skipSharedNavtestSpeech(camera) {
  return skipRepeatedCameraSpeech(sharedSpeech, camera);
}

export function resetNavtestCameraSpeech() {
  sharedSpeech = null;
}
