
export const APP_VERSION = '1.6.4';

export interface Release {
    version: string;
    date: string;
    features: string[];
    fixes?: string[];
}

export const releases: Release[] = [
    {
        version: '1.6.4',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        features: [
            '🛡️ PWA Compatibility: Improved support for restricted preview environments.',
        ],
        fixes: [
            'Fixed Service Worker registration origin mismatch errors.',
            'Handled app installation checks in iframes gracefully.'
        ]
    },
    {
        version: '1.6.3',
        date: 'Previous Release',
        features: [
            '🔧 Enhanced Developer Mode: Fixed caching issues in local development.',
            '🚀 PWA Update: Service Worker now smartly detects environment to prevent stale updates.'
        ],
        fixes: [
            'Fixed Android Studio preview not updating.',
            'Resolved aggressive caching blocking live development.'
        ]
    },
    {
        version: '1.6.2',
        date: 'Previous Release',
        features: [
            '🔥 Hotfix: Aggressive cache clearing for Preview Mode.',
            '🛠️ Developer Tools: Added logic to prevent stale UI in Studio environments.'
        ],
        fixes: [
            'Fixed persistent "changes not showing" issue by nuking old caches on load.'
        ]
    },
    {
        version: '1.6.1',
        date: 'Previous Release',
        features: [
            '🔧 System Update: Forced cache refresh.',
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
    }
];