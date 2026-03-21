// ABOUTME: Shared utility functions for className merging.
// ABOUTME: Provides cn() for conditional Tailwind class composition.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
