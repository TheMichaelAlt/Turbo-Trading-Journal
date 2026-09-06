import type { SVGProps } from 'react'

export default function TurboIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M17 10H29V5H36V18H28.3A12 12 0 1 1 17 10Z" />
    <path d="M29 5H36M29 10V14H34" />
    <circle cx="17" cy="22" r="7.4" strokeWidth="1.5" />
    {[0, 90, 180, 270].map(angle => <path key={angle} d="M17 22C13 21 12 18 14 17C17 16 19 19 17 22Z" transform={`rotate(${angle} 17 22)`} fill="currentColor" stroke="none" />)}
    <circle cx="17" cy="22" r="1.7" fill="currentColor" stroke="none" />
  </svg>
}
