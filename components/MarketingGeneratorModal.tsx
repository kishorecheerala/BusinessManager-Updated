
import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Video, Loader2, Download, Wand2, RefreshCw, WifiOff, Camera, Upload } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Card from './Card';
import Button from './Button';
import { Product } from '../types';
import { useAppContext } from '../context/AppContext';
import { compressImage } from '../utils/imageUtils';

interface MarketingGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const MarketingGeneratorModal: React.FC<MarketingGeneratorModalProps> = ({ isOpen, onClose, product }) => {
    const { state, showToast } = useAppContext();
    const [mode, setMode] = useState<'IMAGE' | 'VIDEO' | 'REMIX'>('IMAGE');
    const [prompt, setPrompt] = useState(`Professional studio shot of ${product.name}, ${product.category || 'product'}, cinematic lighting, 4k resolution.`);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await compressImage(e.target.files[0], 1024, 0.8);
                setUploadedImage(base64);
            } catch (err) {
                showToast("Failed to upload image", 'error');
            }
        }
    };

    const handleGenerate = async () => {
        if (!state.isOnline) {
            showToast("Offline. Cannot generate.", 'error');
            return;
        }
        
        if (mode === 'REMIX' && !uploadedImage) {
             showToast("Please upload a product photo first.", 'info');
             return;
        }

        setIsGenerating(true);
        setResultUrl(null);
        
        try {
            const hasKey = await checkApiKey();
            if (!hasKey && !(window as any).aistudio) {
                 showToast("API Key required. Please configure in Settings.", 'error');
                 setIsGenerating(false);
                 return;
            }

            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' }); 

            if (mode === 'IMAGE') {
                // Use Imagen for pure generation
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
            } else if (mode === 'REMIX') {
                // Use Gemini 2.5 Flash Image for editing/remixing
                // We send the image and the prompt instruction
                const parts = [
                    {
                         inlineData: {
                             mimeType: 'image/jpeg',
                             data: uploadedImage!.split(',')[1]
                         }
                    },
                    {
                        text: `Edit this image: ${prompt}. Keep the main product intact but change the background/lighting as described. Return the edited image.`
                    }
                ];

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts }
                });
                
                // Find image part in response
                let foundImage = false;
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            setResultUrl(`data:image/png;base64,${part.inlineData.data}`);
                            foundImage = true;
                            break;
                        }
                    }
                }
                if (!foundImage) {
                    showToast("AI did not return an image. Try refining prompt.", 'info');
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
                
                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    operation = await ai.operations.getVideosOperation({operation: operation});
                }
                
                const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (videoUri) {
                    try {
                        const vidRes = await fetch(`${videoUri}&key=${apiKey}`);
                        const vidBlob = await vidRes.blob();
                        setResultUrl(URL.createObjectURL(vidBlob));
                    } catch (e) {
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
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${mode === 'IMAGE' ? 'bg-white dark:bg-slate-700 shadow text-pink-600 dark:text-pink-400' : 'text-gray-500'}`}
                                >
                                    <ImageIcon size={14} /> Create
                                </button>
                                <button 
                                    onClick={() => { setMode('REMIX'); setResultUrl(null); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${mode === 'REMIX' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                                >
                                    <RefreshCw size={14} /> Remix
                                </button>
                                <button 
                                    onClick={() => { setMode('VIDEO'); setResultUrl(null); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${mode === 'VIDEO' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                                >
                                    <Video size={14} /> Video
                                </button>
                            </div>

                            {/* Preview Area / Upload Area */}
                            <div className="aspect-video bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative">
                                {isGenerating ? (
                                    <div className="text-center p-6">
                                        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                            Generating...
                                        </p>
                                    </div>
                                ) : resultUrl ? (
                                    mode === 'VIDEO' ? (
                                        <video src={resultUrl} controls className="w-full h-full object-contain bg-black" />
                                    ) : (
                                        <img src={resultUrl} alt="Generated" className="w-full h-full object-contain" />
                                    )
                                ) : mode === 'REMIX' ? (
                                    // Upload UI for Remix
                                    <div className="text-center flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                        {uploadedImage ? (
                                            <img src={uploadedImage} className="w-full h-full object-contain" />
                                        ) : (
                                            <>
                                                <Upload size={32} className="text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-500">Click to upload product photo</p>
                                            </>
                                        )}
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </div>
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
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                                        {mode === 'REMIX' ? 'Edit Instructions' : 'Creative Prompt'}
                                    </label>
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder={mode === 'REMIX' ? "Place on a wooden table, cinematic lighting..." : "Describe the image..."}
                                        className="w-full p-3 text-sm border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                        rows={3}
                                    />
                                </div>
                                
                                <div className="flex gap-3">
                                    <Button 
                                        onClick={handleGenerate} 
                                        disabled={isGenerating}
                                        className={`flex-1 py-3 text-white shadow-lg ${mode === 'IMAGE' ? 'bg-pink-600 hover:bg-pink-700' : mode === 'REMIX' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                    >
                                        {isGenerating ? 'Working Magic...' : 'Generate'}
                                    </Button>
                                    
                                    {resultUrl && (
                                        <a 
                                            href={resultUrl} 
                                            download={`marketing-${mode.toLowerCase()}-${Date.now()}.${mode === 'VIDEO' ? 'mp4' : 'jpg'}`}
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
