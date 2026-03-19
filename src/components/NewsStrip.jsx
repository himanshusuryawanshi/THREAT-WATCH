import { NEWS_HEADLINES } from '../utils/constants'

export default function NewsStrip() {
  const text = NEWS_HEADLINES.join('   ·   ')

  return (
    <div className="flex items-center gap-2 h-6 bg-[#04060a] border-b border-border px-3 flex-shrink-0 overflow-hidden">
      <span className="text-[8px] font-bold tracking-widest text-threat border border-threat/40 px-1.5 py-0.5 rounded-sm flex-shrink-0">
        BREAKING
      </span>
      <div className="flex-1 overflow-hidden">
        <span className="text-[10px] text-muted whitespace-nowrap animate-scroll-news inline-block">
          {text}
        </span>
      </div>
    </div>
  )
}