export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f8fafb] animate-pulse">
      <div className="bg-white border-b border-gray-100 px-5 py-5 space-y-2">
        <div className="h-6 w-48 bg-gray-200 rounded-xl" />
        <div className="h-3 w-72 bg-gray-100 rounded-lg" />
      </div>
      <div className="px-5 py-5 space-y-4 max-w-lg mx-auto">
        <div className="h-40 bg-white border border-gray-100 rounded-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
