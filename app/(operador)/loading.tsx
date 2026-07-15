export default function Loading() {
  return (
    <div className="flex min-h-screen bg-[#f8fafb]">
      {/* Rail del sidebar */}
      <div className="hidden md:block w-60 bg-white border-r border-gray-100" />
      <div className="flex-1 animate-pulse">
        <div className="bg-white border-b border-gray-100 px-8 py-5 space-y-2">
          <div className="h-7 w-64 bg-gray-200 rounded-xl" />
          <div className="h-3 w-96 bg-gray-100 rounded-lg" />
        </div>
        <div className="px-8 py-5 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white border border-gray-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-96 bg-white border border-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
