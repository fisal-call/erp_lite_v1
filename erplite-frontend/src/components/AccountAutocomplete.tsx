/**
 * src/components/AccountAutocomplete.tsx
 *
 * Searchable picker for Chart of Accounts. Mirrors the Customer/Supplier
 * autocomplete pattern, but pulls the full account list once (a chart of
 * accounts is small per-company) and filters client-side.
 *
 * Group accounts (is_group=true) are filtered out — only leaf accounts can
 * receive journal lines per BR-ACC-002.
 *
 * Keyboard navigation: ArrowDown/ArrowUp/Enter/Escape.
 *
 * Usage:
 *   <AccountAutocomplete onSelect={(a) => updateLine(i, { accountUuid: a.uuid })} />
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { accountingApi, type Account } from '../modules/accounting/api'
import { useListboxKeyboard } from './ui/useListboxKeyboard'

export function AccountAutocomplete({
  onSelect,
  selectedUuid,
}: {
  onSelect: (account: Account) => void
  /** Optional controlled value so the input shows the right text after a
   *  parent re-render (e.g. when the form is reset). */
  selectedUuid?: string
}) {
  const [all, setAll] = useState<Account[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    accountingApi
      .listAccounts()
      .then((rows) => setAll(rows.filter((a) => !a.is_group && a.is_active)))
  }, [])

  // If a selectedUuid is passed in and we have the account in memory, show
  // its display text. Otherwise fall back to the current query string.
  const selected = useMemo(
    () => (selectedUuid ? all.find((a) => a.uuid === selectedUuid) : undefined),
    [selectedUuid, all],
  )

  const displayText = selected ? `${selected.account_code} — ${selected.account_name}` : query

  const results = useMemo(() => {
    if (query.length < 1) return []
    const q = query.toLowerCase()
    return all
      .filter(
        (a) =>
          a.account_name.toLowerCase().includes(q) || a.account_code.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [query, all])

  useEffect(() => {
    setOpen(results.length > 0 && query.length > 0)
  }, [results, query])

  const { activeIndex, handleKeyDown } = useListboxKeyboard({
    count: results.length,
    isOpen: open,
    onSelect: (i) => {
      const a = results[i]
      if (a) {
        onSelect(a)
        setQuery('')
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
        placeholder="ابحث عن حساب..."
        value={displayText}
        onChange={(e) => {
          setQuery(e.target.value)
          if (selected) {
            // If the user types after a selection, clear the selection state visually
            // — the parent still holds the old uuid until they pick a new one, which
            // is the correct behaviour (matches CustomerAutocomplete).
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="بحث عن حساب"
        role="combobox"
        aria-expanded={open}
        aria-controls="account-listbox"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id="account-listbox"
          className="absolute z-10 bg-white border rounded-md shadow-md mt-1 w-full max-h-56 overflow-auto"
          role="listbox"
        >
          {results.map((a, i) => (
            <li
              key={a.uuid}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer flex justify-between gap-2 ${
                i === activeIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
              }`}
              onClick={() => {
                onSelect(a)
                setQuery('')
                setOpen(false)
              }}
            >
              <span className="font-mono text-xs text-gray-500">{a.account_code}</span>
              <span className="flex-1 text-right">{a.account_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
