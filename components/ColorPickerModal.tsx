
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Copy } from 'lucide-react';
import Card from './Card';
import Button from './Button';

interface ColorPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialColor: string;
    onChange: (color: string) => void;
}

// --- Color Utility Functions ---

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) h = 0;
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  s = s / 100;
  v = v / 100;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const componentToHex = (c: number) => {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({ isOpen, onClose, initialColor, onChange }) => {
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(0);
    const [value, setValue] = useState(100);
    const [hexInput, setHexInput] = useState(initialColor);
    
    const paletteRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    useEffect(() => {
        if (isOpen) {
            const { r, g, b } = hexToRgb(initialColor);
            const hsv = rgbToHsv(r, g, b);
            setHue(hsv.h);
            setSaturation(hsv.s);
            setValue(hsv.v);
            setHexInput(initialColor);
        }
    }, [isOpen, initialColor]);

    const updateColorFromHsv = useCallback((h: number, s: number, v: number) => {
        const { r, g, b } = hsvToRgb(h, s, v);
        const hex = rgbToHex(r, g, b);
        setHexInput(hex);
        // Don't trigger onChange immediately to prevent flicker/lag, or do it if instant preview is desired
    }, []);

    const handlePaletteInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!paletteRef.current) return;
        const rect = paletteRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        const newS = x * 100;
        const newV = (1 - y) * 100;

        setSaturation(newS);
        setValue(newV);
        updateColorFromHsv(hue, newS, newV);
    }, [hue, updateColorFromHsv]);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        handlePaletteInteraction(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current) handlePaletteInteraction(e);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleApply = () => {
        onChange(hexInput);
        onClose();
    };

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setHexInput(val);
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            const { r, g, b } = hexToRgb(val);
            const hsv = rgbToHsv(r, g, b);
            setHue(hsv.h);
            setSaturation(hsv.s);
            setValue(hsv.v);
        }
    };

    if (!isOpen) return null;

    // Calculate current color for preview
    const { r, g, b } = hsvToRgb(hue, saturation, value);
    const currentColor = `rgb(${r}, ${g}, ${b})`;
    
    // Base hue color for the palette background
    const { r: hr, g: hg, b: hb } = hsvToRgb(hue, 100, 100);
    const hueColor = `rgb(${hr}, ${hg}, ${hb})`;

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in-fast backdrop-blur-sm"
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
        >
            <Card className="w-full max-w-sm p-0 overflow-hidden animate-scale-in bg-white dark:bg-slate-800 border dark:border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Custom Color</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Saturation/Value Pad */}
                    <div 
                        ref={paletteRef}
                        className="w-full h-48 rounded-xl relative cursor-crosshair touch-none shadow-inner ring-1 ring-black/5 overflow-hidden"
                        style={{ backgroundColor: hueColor }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onTouchStart={handlePaletteInteraction}
                        onTouchMove={handlePaletteInteraction}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                        
                        <div 
                            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: `${saturation}%`, top: `${100 - value}%`, backgroundColor: currentColor }}
                        />
                    </div>

                    {/* Hue Slider */}
                    <div>
                        <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            value={hue}
                            onChange={(e) => {
                                const h = parseInt(e.target.value);
                                setHue(h);
                                updateColorFromHsv(h, saturation, value);
                            }}
                            className="w-full h-4 rounded-full appearance-none cursor-pointer"
                            style={{
                                background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
                            }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-12 h-12 rounded-xl shadow-sm border border-gray-200 dark:border-slate-600 flex-shrink-0"
                            style={{ backgroundColor: currentColor }}
                        />
                        <div className="flex-grow relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
                            <input 
                                type="text" 
                                value={hexInput.replace('#', '')} 
                                onChange={handleHexChange}
                                className="w-full pl-7 pr-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg font-mono text-sm uppercase focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                maxLength={6}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleApply} className="flex-1 py-2.5 rounded-xl shadow-lg shadow-primary/20">
                            <Check size={18} className="mr-2" /> Apply Color
                        </Button>
                        <Button onClick={onClose} variant="secondary" className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200">
                            Cancel
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ColorPickerModal;
