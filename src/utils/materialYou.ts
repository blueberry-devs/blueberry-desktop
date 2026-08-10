interface MaterialYouColors {
  primary: string
  primaryContainer: string
  secondary: string
  surface: string
  surfaceContainer: string
  onSurface: string
}

export function applyMaterialYou(): void {
  const bridge = (window as Window & {
    AndroidMaterialYou?: { getColors: () => string }
  }).AndroidMaterialYou
  if (!bridge) return

  try {
    const colors = JSON.parse(bridge.getColors()) as Partial<MaterialYouColors>
    const root = document.documentElement
    if (colors.primary) root.style.setProperty('--accent', colors.primary)
    if (colors.primaryContainer) root.style.setProperty('--accent-container', colors.primaryContainer)
    if (colors.secondary) root.style.setProperty('--material-secondary', colors.secondary)
    if (colors.surface) root.style.setProperty('--bg', colors.surface)
    if (colors.surfaceContainer) root.style.setProperty('--surface-2', colors.surfaceContainer)
    if (colors.onSurface) root.style.setProperty('--text-primary', colors.onSurface)
    root.dataset.materialYou = 'true'
  } catch {
    // The bridge is optional on desktop and on Android versions below 12.
  }
}
