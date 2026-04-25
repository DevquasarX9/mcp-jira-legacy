import type { JiraPaginatedResponse } from "./types.js";

export interface PaginatedCollection<T> {
  readonly items: T[];
  readonly total?: number;
  readonly pages: number;
}

export function extractPaginatedItems<T>(response: JiraPaginatedResponse<T>): T[] {
  if (Array.isArray(response.issues)) {
    return response.issues;
  }

  if (Array.isArray(response.values)) {
    return response.values;
  }

  return [];
}

export async function collectPaginated<T>(
  requestPage: (startAt: number, maxResults: number) => Promise<JiraPaginatedResponse<T>>,
  options?: {
    pageSize?: number;
    maxItems?: number;
  },
): Promise<PaginatedCollection<T>> {
  const pageSize = options?.pageSize ?? 50;
  const maxItems = options?.maxItems ?? 200;
  const items: T[] = [];
  let startAt = 0;
  let pages = 0;
  let total: number | undefined;

  while (items.length < maxItems) {
    const page = await requestPage(startAt, Math.min(pageSize, maxItems - items.length));
    const pageItems = extractPaginatedItems(page);
    pages += 1;
    total = page.total;
    items.push(...pageItems);

    if (pageItems.length === 0) {
      break;
    }

    startAt += pageItems.length;

    if (page.isLast === true || (page.total !== undefined && startAt >= page.total)) {
      break;
    }
  }

  return { items, total, pages };
}
