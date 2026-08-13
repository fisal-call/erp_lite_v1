/**
 * src/components/SupplierAutocomplete.tsx
 * Mirrors CustomerAutocomplete exactly — adds keyboard navigation.
 */
import { useEffect, useRef, useState } from 'react'
import { purchasingApi } from '../modules/purchasing/api'
import type { Supplier } from '../modules/purchasing/types'
import { useListboxKeyboard } from './ui/useListboxKeyboard'

export function SupplierAutocomplete({ onSelect }: { onSelect: (supplier: Supplier) => void }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Supplier[]>([])
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Filter is_active === true so the user can't pick a suspended supplier (which
  // the backend would reject on downstream PO create).
  useEffect(() => {
    purchasingApi
      .listSuppliers()
      .then((rows) => setAll(rows.filter((s) => s.is_active)))
      .catch(() => setAll([]))
  }, [])

  const results =
    query.length >= 1
      ? all
          .filter(
            (s) =>
              s.supplier_name.toLowerCase().includes(query.toLowerCase()) ||
              s.supplier_code.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 20)
      : []

  useEffect(() => {
    setOpen(results.length > 0)
  }, [query, results.length])

  const { activeIndex, handleKeyDown } = useListboxKeyboard({
    count: results.length,
    isOpen: open,
    onSelect: (i) => {
      const s = results[i]
      if (s) {
        onSelect(s)
        setQuery(s.supplier_name)
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
        placeholder="ابحث عن مورد..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="بحث عن مورد"
        role="combobox"
        aria-expanded={open}
        aria-controls="supplier-listbox"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="supplier-listbox"
          role="listbox"
          className="absolute z-10 bg-white border rounded-md shadow-md mt-1 w-full max-h-48 overflow-auto"
        >
          {results.map((s, i) => (
            <li
              key={s.uuid}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
              }`}
              onClick={() => {
                onSelect(s)
                setQuery(s.supplier_name)
                setOpen(false)
              }}
            >
              {s.supplier_code} — {s.supplier_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
