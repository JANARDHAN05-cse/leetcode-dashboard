interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = 'h-4 w-full bg-gray-200' }: SkeletonProps) {
  return <div className={`animate-pulse rounded ${className}`} />
}

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3.5">
        <Skeleton className="h-4 w-6 bg-gray-200" />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full bg-gray-200 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28 bg-gray-200" />
            <Skeleton className="h-3 w-20 bg-gray-100" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="space-y-1">
          <Skeleton className="h-4 w-14 bg-gray-200" />
          <Skeleton className="h-3 w-24 bg-gray-100" />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-4 w-16 bg-gray-200" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-4 w-12 bg-gray-200" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton className="h-3 w-20 bg-gray-100" />
      </td>
      {columns > 6 && (
        <td className="px-4 py-3.5">
          <Skeleton className="h-4 w-12 bg-gray-200" />
        </td>
      )}
    </tr>
  )
}

