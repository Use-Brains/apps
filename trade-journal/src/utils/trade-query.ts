export interface TradeFilters {
  search?: string;
  side?: 'long' | 'short';
  status?: 'open' | 'closed';
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

export type TradeFilterOperation =
  | { op: 'ilike'; column: string; value: string }
  | { op: 'eq'; column: string; value: string }
  | { op: 'or'; value: string }
  | { op: 'gte'; column: string; value: string }
  | { op: 'lte'; column: string; value: string };

export function buildTradeFilterOperations(filters: TradeFilters): TradeFilterOperation[] {
  const operations: TradeFilterOperation[] = [];

  if (filters.search) {
    operations.push({ op: 'ilike', column: 'symbol', value: `%${filters.search}%` });
  }

  if (filters.side) {
    operations.push({ op: 'eq', column: 'side', value: filters.side });
  }

  if (filters.status) {
    operations.push({ op: 'eq', column: 'status', value: filters.status });
  }

  if (filters.tag) {
    operations.push({
      op: 'or',
      value: `setup_tags.cs.{${filters.tag}},mistake_tags.cs.{${filters.tag}}`,
    });
  }

  if (filters.dateFrom) {
    operations.push({ op: 'gte', column: 'entry_date', value: filters.dateFrom });
  }

  if (filters.dateTo) {
    operations.push({ op: 'lte', column: 'entry_date', value: filters.dateTo });
  }

  return operations;
}

export function applyTradeFilterOperations<T extends Record<string, unknown>>(
  query: T,
  operations: TradeFilterOperation[]
): T {
  return operations.reduce((currentQuery, operation) => {
    switch (operation.op) {
      case 'ilike':
        return (currentQuery as { ilike: (column: string, value: string) => T }).ilike(
          operation.column,
          operation.value
        );
      case 'eq':
        return (currentQuery as { eq: (column: string, value: string) => T }).eq(
          operation.column,
          operation.value
        );
      case 'or':
        return (currentQuery as { or: (value: string) => T }).or(operation.value);
      case 'gte':
        return (currentQuery as { gte: (column: string, value: string) => T }).gte(
          operation.column,
          operation.value
        );
      case 'lte':
        return (currentQuery as { lte: (column: string, value: string) => T }).lte(
          operation.column,
          operation.value
        );
      default:
        return currentQuery;
    }
  }, query);
}
