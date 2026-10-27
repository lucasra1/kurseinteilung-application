/** Builds "/path?a=1" from the given query values, leaving out empty ones. */
export function hrefWith(
  pathname: string,
  query: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value);
  }
  const queryString = search.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

/** First value of a search param, which Next.js may hand over as an array. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
