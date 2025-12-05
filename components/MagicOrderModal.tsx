
import React, { useState } from 'react';
import { X, Wand2, Loader2, ArrowRight, WifiOff } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Card from './Card';
import Button from './Button';
import { Product, SaleItem } from '../types';
import { useAppContext } from '../context/AppContext';

interface MagicOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onItemsParsed: (items: SaleItem[]) => void;
}

const MagicOrderModal: React.FC<MagicOrderModalProps> = ({ isOpen, onClose, products, onItemsParsed }) => {
    const { state, showToast } = useAppContext();
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleProcess = async () => {
        if (!inputText.trim()) return;
        if (!state.isOnline) {
            showToast("You are offline.", 'error');
            return;
        }

        setIsProcessing(true);
        try {
            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            if (!apiKey) throw new Error("API Key missing. Please configure in Settings.");

            // Create a lightweight catalog context (ID and Name only to save tokens)
            const catalog = products.map(p => ({ id: p.id, name: p.name, price: p.salePrice }));
            
            const ai = new GoogleGenAI({ apiKey });
            
            const prompt = `
                You are an order parsing assistant. 
                I have a product catalog: ${JSON.stringify(catalog)}.
                
                The user wants to order: "${inputText}".
                
                Match the user's request to the products in the catalog. 
                - Fuzzy match the names.
                - Extract quantities (default to 1 if not specified).
                - Return a JSON object with a key "items" containing an array of { "productId": string, "quantity": number }.
                - Only include found products. Ignore unknown items.
                - JSON ONLY. No markdown.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text;
            if (!text) throw new Error("No response from AI");

            const result = JSON.parse(text);
            
            if (result.items && Array.isArray(result.items)) {
                const parsedItems: SaleItem[] = [];
                
                result.items.forEach((item: any) => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        parsedItems.push({
                            productId: product.id,
                            productName: product.name,
                            quantity: Number(item.quantity) || 1,
                            price: product.salePrice
                        });
                    }
                });

                if (parsedItems.length > 0) {
                    onItemsParsed(parsedItems);
                    onClose();
                    setInputText('');
                } else {
                    showToast("Could not match any products from the text.", 'info');
                }
            }

        } catch (error: any) {
            console.error("Magic Order Error", error);
            showToast(error.message || "Failed to parse order", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in-fast">
            <Card className="w-full max-w-lg p-0 overflow-hidden animate-scale-in border-none shadow-2xl relative bg-white dark:bg-slate-900">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <Wand2 size={20} className="text-yellow-300" />
                        <h2 className="font-bold text-lg">Magic Order Paste</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    {state.isOnline ? (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Paste an order from WhatsApp, SMS, or Email. AI will match products and quantities automatically.
                            </p>
                            
                            <textarea 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="e.g., I need 2 Blue Silk Sarees and 1 Cotton Kurti (L)"
                                className="w-full h-32 p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                            />

                            <div className="flex justify-end pt-2">
                                <Button 
                                    onClick={handleProcess} 
                                    disabled={isProcessing || !inputText.trim()}
                                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 dark:shadow-none"
                                >
                                    {isProcessing ? (
                                        <><Loader2 size={18} className="mr-2 animate-spin" /> Processing...</>
                                    ) : (
                                        <><Wand2 size={18} className="mr-2" /> Convert to Items <ArrowRight size={16} className="ml-1" /></>
                                    )}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 gap-3">
                            <WifiOff size={40} />
                            <p className="text-center text-sm font-medium">Magic Paste requires an internet connection.</p>
                            <Button onClick={onClose} variant="secondary">Close</Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default MagicOrderModal;
