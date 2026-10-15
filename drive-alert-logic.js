function isSpeedOverLimit(speedKmh, speedAvailable, speedLimit) {
  if (!speedAvailable || speedLimit == null) return false;
  const speed = Number(speedKmh);
  const limit = Number(speedLimit);
  return Number.isFinite(speed) && Number.isFinite(limit) && speed > limit;
}

module.exports = { isSpeedOverLimit };
