import { useId, useMemo, useState } from 'react';

export interface TickerOption {
  ticker: string;
  name: string;
}

interface Props {
  options: TickerOption[];
  onSelect: (option: TickerOption) => void;
  label?: string;
  /** Called as the user types, so a parent can fetch matching options. */
  onQueryChange?: (q: string) => void;
}

/** Combobox that matches ticker prefixes and company-name words. Keyboard: ↑ ↓ Enter Esc. */
export function TickerSearch({ options, onSelect, onQueryChange, label = 'Search tickers or companies' }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => o.ticker.toLowerCase().startsWith(q) || o.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, options]);

  const choose = (o: TickerOption) => {
    onSelect(o);
    setQuery('');
    setOpen(false);
  };

  const showList = open && matches.length > 0;

  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        placeholder={label}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onQueryChange?.(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && showList && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul id={listId} role="listbox">
          {matches.map((o, i) => (
            <li
              key={o.ticker}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <span className="num">{o.ticker}</span> <span className="muted">{o.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
