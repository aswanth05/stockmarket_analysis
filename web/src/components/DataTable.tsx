import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Value used for sorting. null sorts last regardless of direction. */
  sortValue?: (row: T) => number | string | null;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

interface Props<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

type Sort = { key: string; dir: 'ascending' | 'descending' } | null;

export function DataTable<T>({ caption, columns, rows, rowKey }: Props<T>) {
  const [sort, setSort] = useState<Sort>(null);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    const sign = sort.dir === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null) return vb == null ? 0 : 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sign;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'ascending' ? 'descending' : 'ascending' }
        : { key, dir: 'descending' },
    );

  return (
    <table className="data-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={c.numeric ? 'num' : undefined}
              aria-sort={sort?.key === c.key ? sort.dir : undefined}
            >
              {c.sortValue ? (
                <button type="button" onClick={() => toggle(c.key)}>
                  {c.header}
                  <span aria-hidden="true">
                    {sort?.key === c.key ? (sort.dir === 'ascending' ? ' ↑' : ' ↓') : ' ↕'}
                  </span>
                </button>
              ) : (
                c.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => (
              <td key={c.key} className={c.numeric ? 'num' : undefined}>
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
