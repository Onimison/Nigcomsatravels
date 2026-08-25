import { ImageResponse } from 'next/og'

/**
 * Generated favicon — the same `EyeMark` glyph used in the sidebar/brand
 * panel (components/auth/icons.tsx), on the app's blue-600 (#2563eb) brand
 * color. Next auto-serves this ahead of the generic favicon.ico left in
 * `app/` as a fallback. See app-icons.md: "Generate icons using code."
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
