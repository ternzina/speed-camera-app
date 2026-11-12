// The preview install borrows the controller of the main navigation screen.
// The store app never registers one.

let current = null;

export function registerPreviewNavigation(api) {
  current = api || null;
}

export function currentPreviewNavigation() {
  return current;
}
