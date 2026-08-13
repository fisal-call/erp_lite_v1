/**
 * src/components/ItemAutocomplete.tsx
 * Reusable across sales/purchasing line inputs. Debounced search against
 * GET /inventory/items?search=... (added specifically to support this).
 *
 * Adds keyboard navigation: ArrowDown/ArrowUp/Enter/Escape.
 */
import { useEffect, useRef, useState } from 'react'
import { inventoryApi, type Item } from '../modules/inventory/api'
import { useListboxKeyboard } from './ui/useListboxKeyboard'

export function ItemAutocomplete({ onSelect }: { onSelect: (item: Item) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      inventoryApi.searchItems(query).then((items) => {
        setResults(items)
        setOpen(true)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const { activeIndex, handleKeyDown } = useListboxKeyboard({
    count: results.length,
    isOpen: open,
    onSelect: (i) => {
      const item = results[i]
      if (item) {
        onSelect(item)
        setQuery(item.item_name)
        setOpen(false)
      }
    },
    onClose: () => setOpen(false),
  })

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="ابحث عن صنف..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="بحث عن صنف"
        role="combobox"
        aria-expanded={open}
        aria-controls="item-listbox"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="item-listbox"
          role="listbox"
          className="absolute z-10 bg-white border rounded-md shadow-md mt-1 w-full max-h-48 overflow-auto"
        >
          {results.map((item, i) => (
            <li
              key={item.uuid}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
              }`}
              onClick={() => {
                onSelect(item)
                setQuery(item.item_name)
                setOpen(false)
              }}
            >
              {item.item_code} — {item.item_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
