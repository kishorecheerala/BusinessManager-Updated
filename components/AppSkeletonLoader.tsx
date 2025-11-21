
import React from 'react';

// Using 'sk-bone' class which uses native CSS variables for immediate theme support
const SkeletonElement: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`sk-bone ${className}`} />
);

const AppSkeletonLoader: React.FC = () => {
    return (
        <div className="sk-app font-sans">
            {/* Header - using sk-header for immediate color, but keeping layout classes if needed */}
            <header className="sk-header">
                <div className="w-8"></div> {/* Spacer */}
                <div className="h-6 w-36 bg-white/20 rounded-md"></div>
                <div className="w-6 h-6 bg-white/20 rounded-full"></div>
            </header>

            {/* Main Content mimicking Dashboard */}
            <main className="flex-grow overflow-y-auto p-4 pb-20 space-y-6">
                <SkeletonElement className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="sk-card">
                        <SkeletonElement className="h-20" />
                    </div>
                    <div className="sk-card">
                        <SkeletonElement className="h-20" />
                    </div>
                    <div className="sk-card">
                        <SkeletonElement className="h-20" />
                    </div>
                    <div className="sk-card">
                        <SkeletonElement className="h-20" />
                    </div>
                </div>
                <div className="sk-card">
                     <SkeletonElement className="h-8 w-1/2 mb-4" />
                     <SkeletonElement className="h-32" />
                </div>
            </main>

            {/* Bottom Nav */}
            <nav className="sk-nav">
                <div className="flex justify-around max-w-2xl mx-auto">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex flex-col items-center justify-center w-full pt-2 pb-1">
                             <div className="w-6 h-6 mb-1 bg-white/20 rounded-md"></div>
                             <div className="w-12 h-2 bg-white/20 rounded"></div>
                        </div>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default AppSkeletonLoader;
