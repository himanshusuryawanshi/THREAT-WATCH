import { useState } from 'react'
import { NEWS_HEADLINES } from '../utils/constants'

export default function NewsStrip() {
  const [paused, setPaused] = useState(false)
  const text = NEWS_HEADLINES.join('   ·   ')

  return (
    <div
      className="flex items-center gap-2 h-6 bg-[#04060a] border-b border-border px-3 flex-shrink-0 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="text-[8px] font-bold tracking-widest text-threat border border-threat/40 px-1.5 py-0.5 rounded-sm flex-shrink-0">
        BREAKING
      </span>

      <div className="flex-1 overflow-hidden">
        <div
          className="whitespace-nowrap text-[10px] text-muted inline-block"
          style={{
            animation: 'scroll-news 60s linear infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>

      <span className="text-[8px] text-muted flex-shrink-0 border border-border2 px-1.5 py-0.5 rounded hidden sm:block">
        HOVER TO PAUSE
      </span>
    </div>
  )
}