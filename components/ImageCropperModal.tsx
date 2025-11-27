
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, Maximize, Square } from 'lucide-react';
import Card from './Card';
import Button from './Button';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onCrop: (croppedImage: string) => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ isOpen, imageSrc, onClose, onCrop }) => {
    const [scale, setScale] = useState(1);
    const [minScale, setMinScale] = useState(0.1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    
    const [maskSize, setMaskSize] = useState({ w: 250, h: 250 });
    const [aspectMode, setAspectMode] = useState<'original' | 'square'>('square');

    const dragStart = useRef({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset when image changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setAspectMode('square'); // Default to square for inventory consistency, but allow change
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, imageSrc]);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const calculateMaskAndScale = (img: HTMLImageElement, mode: 'original' | 'square') => {
        if (!containerRef.current) return;
        
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const padding = 20; // Reduced padding to fill more space
        
        const maxAvailableW = containerW - padding;
        const maxAvailableH = containerH - padding;

        let targetW, targetH;

        if (mode === 'square') {
            // Fill as much of the smaller dimension as possible (no hard cap)
            const size = Math.min(maxAvailableW, maxAvailableH); 
            targetW = size;
            targetH = size;
        } else {
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const containerRatio = maxAvailableW / maxAvailableH;

            if (imgRatio > containerRatio) {
                // Image is wider than container relative to height -> Fit Width
                targetW = maxAvailableW;
                targetH = targetW / imgRatio;
            } else {
                // Image is taller or same -> Fit Height
                targetH = maxAvailableH;
                targetW = targetH * imgRatio;
            }
        }

        setMaskSize({ w: targetW, h: targetH });

        // Calculate min scale to cover the mask
        const scaleX = targetW / img.naturalWidth;
        const scaleY = targetH / img.naturalHeight;
        
        // "Cover" fit means taking the larger of the two scales so no whitespace
        const coverScale = Math.max(scaleX, scaleY);

        setMinScale(coverScale);
        setScale(coverScale); // Auto-fit to cover
        setPosition({ x: 0, y: 0 }); // Center
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        calculateMaskAndScale(e.currentTarget, aspectMode);
    };

    const toggleAspect = () => {
        const newMode = aspectMode === 'square' ? 'original' : 'square';
        setAspectMode(newMode);
        if (imageRef.current) {
            calculateMaskAndScale(imageRef.current, newMode);
        }
    };

    const handleSave = () => {
        if (!imageRef.current) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Determine Output Size
        // We want a high-res output, max 800px dimension
        const MAX_OUTPUT = 800;
        const maskRatio = maskSize.w / maskSize.h;
        
        let outW = MAX_OUTPUT;
        let outH = MAX_OUTPUT / maskRatio;
        
        if (outH > MAX_OUTPUT) {
            outH = MAX_OUTPUT;
            outW = MAX_OUTPUT * maskRatio;
        }
        
        canvas.width = outW;
        canvas.height = outH;

        // Fill white background (transparency safety)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);

        const img = imageRef.current;
        
        // Calculate mapping from visual mask to output canvas
        const globalScale = outW / maskSize.w;

        ctx.save();
        
        // Move origin to center of output
        ctx.translate(outW / 2, outH / 2);
        
        // Scale to map visual pixels to output pixels
        ctx.scale(globalScale, globalScale);
        
        // Apply user translation
        ctx.translate(position.x, position.y);
        
        // Apply user zoom
        ctx.scale(scale, scale);
        
        // Draw image centered at current origin
        ctx.drawImage(
            img, 
            -img.naturalWidth / 2, 
            -img.naturalHeight / 2
        );
        
        ctx.restore();

        onCrop(canvas.toDataURL('image/jpeg', 0.85));
    };

    if (!isOpen || !imageSrc) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[6000] flex items-center justify-center p-4 animate-fade-in-fast">
            <Card className="w-full max-w-lg p-0 overflow-hidden flex flex-col h-auto shadow-2xl bg-white dark:bg-slate-800">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Adjust Image</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={24}/></button>
                </div>
                
                <div 
                     ref={containerRef}
                     className="relative bg-gray-900 w-full overflow-hidden touch-none select-none flex items-center justify-center" 
                     style={{ height: '60vh', maxHeight: '600px', minHeight: '300px' }}
                     onPointerDown={handlePointerDown}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerLeave={handlePointerUp}
                >
                    {/* Image Layer - Behind Mask */}
                    <div 
                        className="absolute left-1/2 top-1/2 w-0 h-0"
                        style={{ 
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        }}
                    >
                        <img 
                            ref={imageRef}
                            src={imageSrc}
                            alt="Crop Target"
                            draggable={false}
                            onLoad={handleImageLoad}
                            style={{
                                transform: 'translate(-50%, -50%)', 
                                position: 'absolute',
                                left: '0',
                                top: '0',
                                maxWidth: 'none',
                                maxHeight: 'none'
                            }}
                        />
                    </div>

                    {/* Mask Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                        <div 
                            style={{ width: maskSize.w, height: maskSize.h }}
                            className="border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] rounded-lg box-content transition-all duration-300 ease-out"
                        ></div>
                    </div>
                    
                    {/* Guide Text */}
                    <div className="absolute top-4 left-0 right-0 text-center z-20 pointer-events-none">
                        <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">Drag to Pan • Zoom to Fit</span>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 space-y-4">
                    {/* Toolbar */}
                    <div className="flex justify-center gap-4 border-b dark:border-slate-700 pb-4">
                        <button 
                            onClick={toggleAspect}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${aspectMode === 'square' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <Square size={16} /> 1:1 Square
                        </button>
                        <button 
                            onClick={toggleAspect}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${aspectMode === 'original' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            <Maximize size={16} /> Original Ratio
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <ZoomOut size={20} className="text-gray-400"/>
                        <input 
                            type="range" 
                            min={minScale} 
                            max={minScale * 4} 
                            step={minScale * 0.05}
                            value={scale} 
                            onChange={e => setScale(parseFloat(e.target.value))}
                            className="flex-grow h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <ZoomIn size={20} className="text-gray-400"/>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <Button onClick={onClose} variant="secondary" className="flex-1 py-3">Cancel</Button>
                        <Button onClick={handleSave} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                            <Check size={18} className="mr-2"/> Save Image
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default ImageCropperModal;
