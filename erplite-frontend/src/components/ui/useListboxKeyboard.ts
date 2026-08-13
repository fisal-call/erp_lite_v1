/**
 * src/components/ui/useListboxKeyboard.ts
 *
 * Shared keyboard-navigation logic for autocomplete-style listboxes.
 * Returns the currently-active index plus a `handleKeyDown` callback
 * that the caller can plug directly into the input's onKeyDown.
 *
 * Keys handled:
 *   ArrowDown  → move active index down (wrap around)
 *   ArrowUp    → move active index up (wrap around)
 *   Enter      → select the active item (calls onSelect)
 *   Escape     → close the listbox (calls onClose)
 *
 * The hook is intentionally generic — it doesn't know anything about the
 * items themselves. The caller is responsible for calling `onSelect`
 * with the right item when Enter is pressed.
 */
import { useCallback, useEffect, useState } from 'react'

interface UseListboxKeyboardArgs {
  /** Number of currently-visible options. */
  count: number
  /** Called when the user presses Enter (or clicks an item). */
  onSelect: (index: number) => void
  /** Called when the user presses Escape. */
  onClose: () => void
  /** Whether the listbox is currently open. */
  isOpen: boolean
}

export function useListboxKeyboard({
  count,
  onSelect,
  onClose,
  isOpen,
}: UseListboxKeyboardArgs) {
  const [activeIndex, setActiveIndex] = useState(-1)

  // Reset active index whenever the list opens or the result set changes.
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(count > 0 ? 0 : -1)
    } else {
      setActiveIndex(-1)
    }
  }, [isOpen, count])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || count === 0) {
        // If the user starts typing, the parent effect will open the list.
        // We don't intercept keystrokes when closed.
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setActiveIndex((i) => (i + 1) % count)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setActiveIndex((i) => (i - 1 + count) % count)
          break
        }
        case 'Enter': {
          if (activeIndex >= 0 && activeIndex < count) {
            e.preventDefault()
            onSelect(activeIndex)
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          onClose()
          break
        }
      }
    },
    [isOpen, count, activeIndex, onSelect, onClose],
  )

  return { activeIndex, handleKeyDown }
}
