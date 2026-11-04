import type { RankingMetric } from '@/types'

interface FilterTabsProps {
  activeMetric: RankingMetric
  onMetricChange: (metric: RankingMetric) => void
}

const TABS: Array<{ id: RankingMetric; label: string }> = [
  { id: 'solved_total', label: 'Problems Solved' },
  { id: 'contest_rating', label: 'Contest Rating' },
  { id: 'contests_attended', label: 'Contests Attended' },
]

export function FilterTabs({ activeMetric, onMetricChange }: FilterTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav
        className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto no-scrollbar"
        aria-label="Ranking Metric Filters"
      >
        {TABS.map((tab) => {
          const isActive = activeMetric === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onMetricChange(tab.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-all ${
                isActive
                  ? 'border-[#F89F1B] text-[#F89F1B]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

