import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- generic params must match the original declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Render this cell as the card title when the table stacks on phones. */
    primary?: boolean;
    /** Hide this column when the table stacks on phones. */
    hideOnMobile?: boolean;
  }
}
