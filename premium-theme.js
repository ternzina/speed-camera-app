const replacements = {
  "#fff": "#182230",
  "#ffffff": "#182230",
  "#f3f5f8": "#0b1220",
  "#f5f6f9": "#0b1220",
  "#101828": "#f2f4f7",
  "#182230": "#f2f4f7",
  "#344054": "#e4e7ec",
  "#667085": "#a4b0c0",
  "#e8ecf2": "#263244",
  "#eaf3ff": "#123454",
  "#eff3f7": "#263244",
  "#f9fbfe": "#182230",
  "#e8eef3": "#263244",
  "#f3f4f6": "#263244",
  "#eee": "#263244",
  "#eef3fa": "#263244",
};
export function themeStyles(styles, dark) {
  if (!dark) return styles;
  return Object.fromEntries(
    Object.entries(styles).map(([key, style]) => [
      key,
      ["limit", "limitNumber", "driverLimitNumber"].includes(key)
        ? style
        : Object.fromEntries(
            Object.entries(style).map(([property, value]) => [
              property,
              typeof value === "string"
                ? replacements[value.toLowerCase()] || value
                : value,
            ]),
          ),
    ]),
  );
}
