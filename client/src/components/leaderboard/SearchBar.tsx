import { useState, useEffect } from 'react'
import { SearchIcon, XIcon } from '@/components/icons/Icons'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search users by handle or name…',
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [prevPropValue, setPrevPropValue] = useState(value)

  // Adjust local state during render when prop changes
  if (value !== prevPropValue) {
    setPrevPropValue(value)
    setLocalValue(value)
  }

  // Debounce (300ms) before pushing up to parent
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [localValue, onChange, value])

  function handleClear() {
    setLocalValue('')
    onChange('')
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <SearchIcon className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-9 pr-8 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-[#F89F1B] focus:border-[#F89F1B] transition-colors"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Clear search"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
