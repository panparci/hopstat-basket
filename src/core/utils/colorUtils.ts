export function getContrastTextColor(hexColor?: string): string {
  if (!hexColor) return '#FFFFFF'; // Fallback for undefined/null

  // Handle CSS variables or non-hex colors gracefully
  if (hexColor.startsWith('var(') || !hexColor.startsWith('#')) {
    // If it's a known light keyword, return dark. Otherwise light.
    const lightKeywords = ['white', 'yellow', 'cyan', 'lime', 'silver', 'transparent'];
    if (lightKeywords.includes(hexColor.toLowerCase())) {
      return '#111111';
    }
    return '#FFFFFF';
  }

  // Remove the hash if it exists
  const hex = hexColor.replace('#', '');

  // Parse r, g, b values
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
    g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
    b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return '#FFFFFF'; // Fallback if invalid hex length
  }

  // Handle invalid parsing
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '#FFFFFF';
  }

  // Calculate YIQ brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return dark or light text color based on brightness threshold
  return brightness > 150 ? '#111111' : '#FFFFFF';
}
