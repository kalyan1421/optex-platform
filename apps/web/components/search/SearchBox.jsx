'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * The hero search input on /search — submit-navigates to `?q=`, which the
 * Server Component page re-renders against. The only part of the hero that
 * needs a browser; everything else in the section is static.
 */
export default function SearchBox({ initialQuery }) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(initialQuery);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function clearSearch() {
    setInputValue('');
    router.push('/search');
  }

  return (
    <form onSubmit={handleSubmit} className="relative max-w-2xl">
      <div className="flex items-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white shadow-xl transition-colors focus-within:border-[#E53935]">
        <div className="flex-shrink-0 pl-5 pr-2 text-gray-400">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search frames, sunglasses, brands…"
          // Only on an EMPTY search page. Arriving at /search with no query means
          // the visitor came here to type, so the field is the page's purpose
          // rather than an interruption. Landing with results (`initialQuery` set)
          // does not focus, so it never takes focus from results someone came
          // back to read.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!initialQuery}
          className="flex-1 bg-transparent px-3 py-4 text-[16px] font-medium text-[#1a1a1a] placeholder-gray-300 outline-none"
        />
        {inputValue && (
          <button
            type="button"
            onClick={clearSearch}
            className="flex-shrink-0 px-3 text-gray-300 transition-colors hover:text-gray-500"
            aria-label="Clear search"
          >
            <XIcon />
          </button>
        )}
        <button
          type="submit"
          className="flex flex-shrink-0 items-center gap-2 bg-[#E53935] px-6 py-4 text-[14px] font-bold text-white transition-colors hover:bg-red-600"
        >
          Search
          <ArrowRightIcon />
        </button>
      </div>
    </form>
  );
}
