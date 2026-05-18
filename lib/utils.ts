import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round a number to at most `dp` decimal places, stripping trailing zeros. */
export function fmt(n: number, dp = 1): string {
  return parseFloat(n.toFixed(dp)).toString()
}

export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseFloat(match[3] ?? "0"); // parseFloat instead of parseInt
  return hours * 3600 + minutes * 60 + seconds;
}
