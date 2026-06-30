import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// Combobox แบบ search-select — ใช้แทน Select ธรรมดาเมื่อรายการตัวเลือกอาจมีจำนวนมาก
// options: [{ value, label }]
export function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder = 'เลือก...',
  searchPlaceholder = 'ค้นหา...',
  emptyText = 'ไม่พบรายการ',
  className,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          selected ? 'text-gray-900' : 'text-gray-400'
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg border border-gray-200 bg-white text-gray-900 shadow-xl overflow-hidden">
          <div className="relative border-b border-gray-100">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-8 pr-3 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">{emptyText}</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onValueChange(o.value); setOpen(false) }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm outline-none text-left hover:bg-blue-50 hover:text-blue-900"
                >
                  {o.label}
                  {o.value === value && (
                    <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
                      <Check className="h-4 w-4 text-blue-600" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
