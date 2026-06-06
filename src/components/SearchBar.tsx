import { forwardRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (c: string) => void;
  categories: string[];
  categoryCounts: Record<string, number>;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  onAdd: () => void;
}

const SearchBar = forwardRef<HTMLInputElement, Props>(({ value, onChange, categoryFilter, onCategoryChange, categories, categoryCounts, showFavorites, onToggleFavorites, onAdd }, ref) => {
  return (
    <div className="flex items-center gap-2 flex-1 max-w-lg ml-4">
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/15 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input ref={ref} type="text" placeholder="Search entries... (Ctrl+F)" value={value} onChange={(e) => onChange(e.target.value)} className="input-glass w-full pl-10 pr-3 h-9 text-sm" />
      </div>
      <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} className="input-glass h-9 text-xs px-3 min-w-[90px]">
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat} {cat !== 'All' && categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}</option>
        ))}
      </select>
      <button onClick={onToggleFavorites} className={`btn-ghost p-2 rounded-lg ${showFavorites ? 'text-amber-400 bg-amber-500/10' : 'text-white/20'}`} title="Show favorites only">
        <svg className="w-4 h-4" fill={showFavorites ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>
      <button onClick={onAdd} className="btn-primary h-9 px-4 text-xs font-semibold" title="New entry (Ctrl+N)">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        New
      </button>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
