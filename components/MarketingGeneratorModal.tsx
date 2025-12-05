
import React, { useState } from 'react';
import { X, Image as ImageIcon, Video, Loader2, Download, Wand2, RefreshCw, WifiOff } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Card from './Card';
import Button from './Button';
import { Product } from '../types';
import { useAppContext } from '../context/AppContext';

interface MarketingGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const MarketingGeneratorModal: React.FC<MarketingGeneratorModalProps> = ({ isOpen, onClose, product }) => {
    const { state, showToast } = useAppContext();
    const [mode, setMode] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
    const [prompt, setPrompt] = useState(`Professional studio shot of ${product.name}, ${product.category || 'product'}, cinematic lighting, 4k resolution.`);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [videoOperation, setVideoOperation] = useState<any>(null);

    const checkApiKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio) {
            const hasKey = await aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await aistudio.openSelectKey();
                return false;
            }
            return true;
        }
        return !!process.env.API_KEY || !!localStorage.getItem('gemini_api_key');
    };

    const handleGenerate = async () => {
        if (!state.isOnline) {
            showToast("Offline. Cannot generate.", 'error');
            return;
        }

        setIsGenerating(true);
        setResultUrl(null);
        
        try {
            const hasKey = await checkApiKey();
            if (!hasKey && !(window as any).aistudio) { // If no shim and no key
                 showToast("API Key required. Please configure in Settings.", 'error');
                 setIsGenerating(false);
                 return;
            }

            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            // If using shim, the key is injected, but we might need to instantiate specifically.
            // Assuming standard instantiation works if env is populated by shim or manual entry.
            const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' }); 

            if (mode === 'IMAGE') {
                // Use Imagen for high quality generation
                const response = await ai.models.generateImages({
                    model: 'imagen-3.0-generate-001',
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: '1:1',
                        outputMimeType: 'image/jpeg'
                    }
                });
                
                if (response.generatedImages?.[0]?.image?.imageBytes) {
                    const base64 = response.generatedImages[0].image.imageBytes;
                    setResultUrl(`data:image/jpeg;base64,${base64}`);
                }
            } else {
                // Use Veo for video
                let operation = await ai.models.generateVideos({
                    model: 'veo-2.0-generate-preview-0128',
                    prompt: prompt,
                    config: {
                        numberOfVideos: 1,
                        resolution: '720p',
                        aspectRatio: '16:9'
                    }
                });
                
                setVideoOperation(operation);
                
                // Poll for completion
                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    operation = await ai.operations.getVideosOperation({operation: operation});
                }
                
                const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (videoUri) {
                    // Fetch the actual video bytes using the key
                    // Note: In a real browser env with CORS, this fetch might need a proxy or direct link handling.
                    // For this demo, we'll try to display it or provide a link.
                    // Ideally, we fetch it and convert to blob url.
                    try {
                        const vidRes = await fetch(`${videoUri}&key=${apiKey}`);
                        const vidBlob = await vidRes.blob();
                        setResultUrl(URL.createObjectURL(vidBlob));
                    } catch (e) {
                        console.error("Failed to fetch video blob", e);
                        // Fallback: just try setting the URI directly (might fail due to auth headers requirements in src)
                        // Or open in new tab
                        setResultUrl(`${videoUri}&key=${apiKey}`);
                    }
                }
            }
        } catch (error: any) {
            console.error("Generation failed", error);
            let msg = "Generation failed.";
            if (error.message?.includes("403") || error.message?.includes("found")) {
                msg = "Access denied or Key not found. Please re-select API Key.";
                if ((window as any).aistudio) (window as any).aistudio.openSelectKey();
            }
            showToast(msg, 'error');
        } finally {
            setIsGenerating(false);
            setVideoOperation(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-fade-in-fast backdrop-blur-sm">
            <Card className="w-full max-w-lg p-0 overflow-hidden animate-scale-in border-none shadow-2xl bg-white dark:bg-slate-900">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-pink-600 to-purple-600 text-white">
                    <div className="flex items-center gap-2">
                        <Wand2 size={20} />
                        <h2 className="font-bold text-lg">Marketing Studio</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-5 space-y-5">
                    {state.isOnline ? (
                        <>
                            {/* Mode Selector */}
                            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button 
                                    onClick={() => { setMode('IMAGE'); setResultUrl(null); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${mode === 'IMAGE' ? 'bg-white dark:bg-slate-700 shadow text-pink-600 dark:text-pink-400' : 'text-gray-500'}`}
                                >
                                    <ImageIcon size={16} /> Product Image
                                </button>
                                <button 
                                    onClick={() => { setMode('VIDEO'); setResultUrl(null); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${mode === 'VIDEO' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                                >
                                    <Video size={16} /> Promo Video
                                </button>
                            </div>

                            {/* Result Area */}
                            <div className="aspect-video bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative">
                                {isGenerating ? (
                                    <div className="text-center p-6">
                                        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                            {mode === 'VIDEO' ? 'Generating Video (this takes a moment)...' : 'Creating Image...'}
                                        </p>
                                        {mode === 'VIDEO' && <p className="text-xs text-gray-400 mt-1">AI is dreaming up your scene</p>}
                                    </div>
                                ) : resultUrl ? (
                                    mode === 'IMAGE' ? (
                                        <img src={resultUrl} alt="Generated" className="w-full h-full object-cover" />
                                    ) : (
                                        <video src={resultUrl} controls className="w-full h-full object-contain bg-black" />
                                    )
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Wand2 size={40} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Ready to generate</p>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Creative Prompt</label>
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        className="w-full p-3 text-sm border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                        rows={3}
                                    />
                                </div>
                                
                                <div className="flex gap-3">
                                    <Button 
                                        onClick={handleGenerate} 
                                        disabled={isGenerating}
                                        className={`flex-1 py-3 text-white shadow-lg ${mode === 'IMAGE' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                    >
                                        {isGenerating ? 'Working Magic...' : `Generate ${mode === 'IMAGE' ? 'Image' : 'Video'}`}
                                    </Button>
                                    
                                    {resultUrl && (
                                        <a 
                                            href={resultUrl} 
                                            download={`marketing-${mode.toLowerCase()}-${Date.now()}.${mode === 'IMAGE' ? 'jpg' : 'mp4'}`}
                                            className="px-4 flex items-center justify-center bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
                                        >
                                            <Download size={20} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-4 text-gray-500">
                            <WifiOff size={48} />
                            <p className="font-medium">You are currently offline.</p>
                            <Button onClick={onClose} variant="secondary">Close</Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default MarketingGeneratorModal;
