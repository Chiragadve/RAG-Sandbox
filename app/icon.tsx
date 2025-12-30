import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(124, 58, 237, 0.1)', // Primary (violet-600) at 10% opacity
                    borderRadius: '6px',
                    color: '#7c3aed', // Primary violet-600
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 20v2"></path>
                    <path d="M12 2v2"></path>
                    <path d="M17 20v2"></path>
                    <path d="M17 2v2"></path>
                    <path d="M2 12h2"></path>
                    <path d="M2 17h2"></path>
                    <path d="M2 7h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="M20 17h2"></path>
                    <path d="M20 7h2"></path>
                    <path d="M7 20v2"></path>
                    <path d="M7 2v2"></path>
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <rect x="8" y="8" width="8" height="8" rx="1"></rect>
                </svg>
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    )
}
