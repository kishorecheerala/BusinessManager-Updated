
export const APP_VERSION = '1.5.1';

export interface Release {
    version: string;
    date: string;
    features: string[];
    fixes?: string[];
}

export const releases: Release[] = [
    {
        version: '1.5.1',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        features: [
            '🎨 Improved Invoice Designer with precise positioning controls.',
            '🔧 Fixed issue with QR code and Logo absolute position adjustments.'
        ],
        fixes: [
            'Resolved state update conflict in nudge controls.'
        ]
    },
    {
        version: '1.5.0',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
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
