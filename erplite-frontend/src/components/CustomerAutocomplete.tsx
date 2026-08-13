/**
 * src/components/CustomerAutocomplete.tsx
 * Mirrors ItemAutocomplete exactly (documented TODO from FRONTEND-README.md, now resolved).
 *
 * Adds keyboard navigation: ArrowDown/ArrowUp move the active highlight,
 * Enter selects, Escape closes.
 */
import { useEffect, useRef, useState } from 'react'
import { salesApi } from '../modules/sales/api'
import type { Customer } from '../modules/sales/types'
import { useListboxKeyboard } from './ui/useListboxKeyboard'

export function CustomerAutocomplete({ onSelect }: { onSelect: (customer: Customer) => void }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Customer list is small enough (per-company) to fetch once and filter client-side —
  // avoids adding a ?search= param to GET /sales/customers for now.
  // Filter is_active === true so the user can't pick a suspended customer (which
  // the backend would reject on downstream SO create with BR-SAL-009).
  useEffect(() => {
    salesApi
      .listCustomers()
      .then((rows) => setAll(rows.filter((c) => c.is_active)))
      .catch(() => setAll([]))
  }, [])

  const results =
    query.length >= 1
      ? all
          .filter(
            (c) =>
              c.customer_name.toLowerCase().includes(query.toLowerCase()) ||
              c.customer_code.toLowerCase().includes(query.toLowerCase()),
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
      const c = results[i]
      if (c) {
        onSelect(c)
        setQuery(c.customer_name)
        setOpen(false)
      }
    },
    onClose: () => setOpen(false),
  })

  // Scroll the active item into view when navigating with the keyboard.
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
        placeholder="ابحث عن عميل..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="بحث عن عميل"
        role="combobox"
        aria-expanded={open}
        aria-controls="customer-listbox"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="customer-listbox"
          role="listbox"
          className="absolute z-10 bg-white border rounded-md shadow-md mt-1 w-full max-h-48 overflow-auto"
        >
          {results.map((c, i) => (
            <li
              key={c.uuid}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
              }`}
              onClick={() => {
                onSelect(c)
                setQuery(c.customer_name)
                setOpen(false)
              }}
              onMouseEnter={() => {
                /* no-op — keyboard sets active, mouse hover is purely visual */
              }}
            >
              {c.customer_code} — {c.customer_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
