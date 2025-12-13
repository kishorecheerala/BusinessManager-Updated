
export const APP_VERSION = '1.6.1';

export interface Release {
    version: string;
    date: string;
    features: string[];
    fixes?: string[];
}

export const releases: Release[] = [
    {
        version: '1.6.1',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        features: [
            '🕒 Enhanced Time Display: "Last Synced" and Banner times now use clear AM/PM formatting.',
            '🆘 Support: Fixed specific "Help & Documentation" links in the main menu.'
        ],
        fixes: [
            'Fixed "Sync Failed" error by correcting database save logic.',
            'Resolved onboarding loop issue with "Skip Setup".',
            'Fixed Profile Sync timestamp issues across devices.'
        ]
    },
    {
        version: '1.6.0',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        features: [
            '🎙️ Gemini Live Assistant: Have real-time, two-way voice conversations with your business analyst.',
            '🎨 AI Marketing Studio: Generate professional product photography and promotional videos using Imagen & Veo.',
            '📊 Smart Analyst: Get intelligent executive briefings and revenue forecasts on your dashboard.',
            '📷 Magic Scan: Auto-fill purchase entries by simply scanning a physical invoice image.',
            '☁️ Optimized Cloud Sync: Faster backups with split storage strategy for images.'
        ],
        fixes: [
            'Improved Google Drive sync reliability.',
            'Enhanced PDF generation performance for large invoices.'
        ]
    },
    {
        version: '1.5.1',
        date: '15 February 2025',
        features: [
            '🎨 Improved Invoice Designer with precise positioning controls.',
            '🔧 Fixed issue with QR code and Logo absolute position adjustments.',
            '✨ Added absolute positioning customization for Logo.'
        ],
        fixes: [
            'Resolved state update conflict in nudge controls.'
        ]
    },
    {
        version: '1.5.0',
        date: '10 February 2025',
        features: [
            '🆕 What\'s New Modal: Automatically stay informed about the latest updates and features.',
            '⚡ Performance improvements for faster app loading and navigation.',
            '🎨 UI Enhancements: Cleaner layouts and smoother transitions.'
        ],
        fixes: [
            'General stability enhancements.',
            'Minor bug fixes in data synchronization.'
        ]
    }
];
