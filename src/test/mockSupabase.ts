type TableRow = Record<string, unknown>
type TableData = Record<string, TableRow[]>

function matchesFilters(
  row: TableRow,
  filters: Array<{ type: 'eq'; column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

export function createMockSupabase(tables: TableData) {
  return {
    from(tableName: string) {
      const table = tables[tableName] ?? []
      const filters: Array<{ type: 'eq'; column: string; value: unknown }> = []

      const builder = {
        select(columns: string) {
          void columns
          return builder
        },

        eq(column: string, value: unknown) {
          filters.push({ type: 'eq', column, value })
          return builder
        },

        order(column: string, options?: unknown) {
          void column
          void options
          return builder
        },

        gte(column: string, value: unknown) {
          void column
          void value
          return builder
        },

        lte(column: string, value: unknown) {
          void column
          void value
          return builder
        },

        or(orFilters: string) {
          void orFilters
          return builder
        },

        async maybeSingle() {
          const filtered = table.filter((row) => matchesFilters(row, filters))
          return {
            data: filtered[0] ?? null,
            error: null,
          }
        },

        async single() {
          const filtered = table.filter((row) => matchesFilters(row, filters))
          if (filtered.length === 1) {
            return {
              data: filtered[0],
              error: null,
            }
          }

          return {
            data: null,
            error: {
              message: filtered.length === 0
                ? 'No rows returned'
                : 'Multiple rows returned',
            },
          }
        },

        async in(column: string, values: unknown[]) {
          const filtered = table.filter(
            (row) => matchesFilters(row, filters) && values.includes(row[column]),
          )

          return {
            data: filtered,
            error: null,
          }
        },
      }

      return builder
    },
  }
}
