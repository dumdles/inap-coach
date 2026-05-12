import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round a number to at most `dp` decimal places, stripping trailing zeros. */
export function fmt(n: number, dp = 1): string {
  return parseFloat(n.toFixed(dp)).toString()
}
