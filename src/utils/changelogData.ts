
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
            '🔧 System Update: Forced cache refresh to ensure latest features are visible.',
            '🚀 PWA Optimization: Improved development mode detection.'
        ],
        fixes: [
            'Fixed issue where old cached version was persisting in preview mode.'
        ]
    },
    {
        version: '1.6.0',
        date: 'Previous Release',
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
    }
];
