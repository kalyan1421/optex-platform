// L-7 FIX: Re-export cn from @optex/ui so this file stays as a convenience
// shim for existing imports (e.g. shadcn-generated files that use '@/lib/utils'),
// while the canonical implementation lives in a single shared place.
export { cn } from '@optex/ui'
