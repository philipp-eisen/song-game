import type { SVGProps } from 'react'

interface AppLogoProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: string | number
}

export function AppLogo({ size = '1em', ...props }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      width={size}
      height={size}
      {...props}
    >
      {/* Duotone fills */}
      <g opacity="0.2">
        {/* Clock circle fill */}
        <path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" />
        {/* Music notes heads fill */}
        <g transform="translate(128, 128) scale(0.5) translate(-128, -128)">
          <path d="M208,164a28,28,0,1,1-28-28A28,28,0,0,1,208,164ZM52,168a28,28,0,1,0,28,28A28,28,0,0,0,52,168Z" />
        </g>
      </g>
      {/* Outlines */}
      <g>
        {/* Clock outer circle and dots */}
        <path d="M232,136.66A104.12,104.12,0,1,1,119.34,24,8,8,0,0,1,120.66,40,88.12,88.12,0,1,0,216,135.34,8,8,0,0,1,232,136.66ZM160,48a12,12,0,1,0-12-12A12,12,0,0,0,160,48Zm36,24a12,12,0,1,0-12-12A12,12,0,0,0,196,72Zm24,36a12,12,0,1,0-12-12A12,12,0,0,0,220,108Z" />
        {/* Music notes stroke */}
        <g transform="translate(128, 128) scale(0.5) translate(-128, -128)">
          <path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V110.25l112-28v51.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z" />
        </g>
      </g>
    </svg>
  )
}
