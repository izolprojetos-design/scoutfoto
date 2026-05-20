
/**
 * Generates initials from a full name.
 * Example: "João Silva" -> "JS"
 */
export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generates a consistent background color from a string.
 */
export function stringToColor(str: string): string {
  if (!str) return "hsl(var(--muted))";
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use HSL for better control over vibrancy and lightness
  const h = Math.abs(hash) % 360;
  // We want colors that aren't too dark or too light for white text
  // Saturation 60-80%, Lightness 40-60%
  const s = 65 + (Math.abs(hash) % 15);
  const l = 45 + (Math.abs(hash) % 15);
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}
