interface SkeletonRowProps {
  rows?: number;
  cols: number;
}

export default function SkeletonRow({ rows = 5, cols }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-700">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 bg-slate-700 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
