import type { ReactNode } from 'react';
import './Table.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  bordered?: boolean;
  compact?: boolean;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ columns, rows, rowKey, empty, bordered, compact, onRowClick }: TableProps<T>) {
  const cls = ['slds2-table', bordered ? 'slds2-table--bordered' : '', compact ? 'slds2-table--compact' : '']
    .filter(Boolean)
    .join(' ');

  if (rows.length === 0 && empty != null) {
    return (
      <div className="slds2-table__empty">
        <table className={cls}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="slds2-table__empty-body">{empty}</div>
      </div>
    );
  }

  return (
    <div className="slds2-table__wrap">
      <table className={cls}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'slds2-table__row--clickable' : ''}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
