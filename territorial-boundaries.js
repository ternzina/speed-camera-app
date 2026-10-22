// Simplified offline outlines for the unconnected resolver.
// A ban is territorial: Palestine is PS-LAW, not the ISO code PS.
// East Jerusalem is excluded because the open text does not apply the rule there.
// These rings are not a surveyed boundary and are not read by the alert pipeline.

export const BORDER_MARGIN_METERS = 500;

function ring(pairs) {
  return pairs.map(([lat, lon]) => [lat, lon]);
}

export const TERRITORIES = [
  {
    id: "FR",
    rings: [ring([
      [51.05, 2.55], [51.05, 2.10], [49.75, -1.85], [48.55, -4.75],
      [47.25, -2.55], [46.15, -1.25], [43.40, -1.75], [42.35, 1.45],
      [42.45, 3.05], [43.15, 3.15], [43.05, 6.15], [43.75, 7.45],
      [44.30, 6.85], [45.15, 6.55], [46.25, 6.05], [47.05, 6.85],
      [47.55, 7.55], [48.95, 7.85], [49.45, 6.35], [49.55, 5.85],
      [50.10, 4.15], [50.95, 2.55],
    ])],
  },
  {
    id: "DE",
    rings: [ring([
      [54.90, 8.10], [54.85, 8.70], [54.40, 13.10], [53.40, 14.20],
      [51.20, 14.80], [50.30, 12.10], [47.75, 12.70], [47.70, 10.20],
      [47.75, 8.00], [49.20, 6.40], [51.00, 6.05], [53.50, 7.05],
    ])],
  },
  {
    id: "CH",
    rings: [ring([
      [47.45, 6.95], [47.45, 10.35], [46.45, 10.35], [45.90, 8.00],
      [46.15, 6.15], [46.85, 6.15],
    ])],
  },
  {
    id: "EG",
    rings: [ring([
      [31.30, 25.10], [31.30, 34.15], [22.05, 34.15], [22.05, 25.10],
    ])],
  },
  {
    id: "OM",
    rings: [ring([
      [26.35, 56.35], [26.35, 59.85], [22.55, 59.85], [16.65, 53.15],
      [16.65, 52.05], [22.40, 55.70], [24.10, 56.35],
    ])],
  },
  {
    id: "BH",
    rings: [ring([
      [26.30, 50.45], [26.30, 50.75], [26.02, 50.75], [26.02, 50.45],
    ])],
  },
  {
    id: "SN",
    rings: [ring([
      [16.65, -17.53], [16.65, -11.40], [12.35, -11.40], [12.35, -17.53],
    ])],
  },
  {
    id: "PS-LAW",
    rings: [
      ring([[31.59, 34.22], [31.59, 34.56], [31.22, 34.56], [31.22, 34.22]]),
      ring([[32.35, 35.08], [32.35, 35.52], [31.45, 35.52], [31.45, 35.08]]),
    ],
  },
];

export const EXCLUSIONS = [
  {
    id: "east-jerusalem",
    appliesTo: "PS-LAW",
    ring: ring([[31.84, 35.17], [31.84, 35.30], [31.72, 35.30], [31.72, 35.17]]),
  },
];

export const TERRITORY_IDS = TERRITORIES.map((territory) => territory.id);
