
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, Key, AlertTriangle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../context/AppContext';
import Card from './Card';
import Button from './Button';

interface AskAIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

// Helper to robustly get API Key from various environment sources
const getApiKey = (): string | undefined => {
  let key: string | undefined;

  // 1. Try import.meta.env (Vite)
  try {
    // @ts-ignore
    if (import.meta.env) {
        // @ts-ignore
        if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
        // @ts-ignore
        else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
        // @ts-ignore
        else if (import.meta.env.REACT_APP_API_KEY) key = import.meta.env.REACT_APP_API_KEY;
    }
  } catch (e) {
    // import.meta might not exist in some environments
  }

  // 2. Try process.env (Node/Webpack/Pollyfilled)
  if (!key && typeof process !== 'undefined' && process.env) {
    if (process.env.API_KEY) key = process.env.API_KEY;
    else if (process.env.VITE_API_KEY) key = process.env.VITE_API_KEY;
    else if (process.env.REACT_APP_API_KEY) key = process.env.REACT_APP_API_KEY;
  }

  return key;
};

const AskAIModal: React.FC<AskAIModalProps> = ({ isOpen, onClose }) => {
  const { state } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: "Hi! I'm your Business Assistant. Ask me about your sales, stock, or customers." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyButton, setShowKeyButton] = useState(false);
  const [isEnvConfigured, setIsEnvConfigured] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Check for API key availability on open
  useEffect(() => {
    if (isOpen) {
        const checkConfig = async () => {
            const aistudio = (window as any).aistudio;
            const key = getApiKey();
            
            if (key) {
                setIsEnvConfigured(true);
                setMessages(prev => prev.filter(m => !m.text.includes("Missing API Key")));
            } else if (aistudio) {
                try {
                    const hasKey = await aistudio.hasSelectedApiKey();
                    if (!hasKey) setShowKeyButton(true);
                } catch (e) {
                    console.warn("Failed to check API key status via AI Studio", e);
                }
            } else {
                console.warn("API Key not found in environment variables.");
                setIsEnvConfigured(false);
                setMessages(prev => {
                    if (prev.some(m => m.text.includes("Missing API Key"))) return prev;
                    return [...prev, { 
                        id: 'sys-error-init', 
                        role: 'model', 
                        text: "⚠️ Missing API Key.\n\nTo fix this in Vercel:\n1. Go to Settings > Environment Variables.\n2. Add 'VITE_API_KEY' with your Gemini API Key.\n3. **Redeploy** the project (Required for new keys to take effect).\n\nIf testing locally, create a .env file with VITE_API_KEY=...",
                        isError: true 
                    }];
                });
            }
        };
        checkConfig();
    }
  }, [isOpen]);

  const generateSystemContext = () => {
    const totalSales = state.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalPurchases = state.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
    const profit = totalSales - totalPurchases; 
    const lowStockItems = state.products.filter(p => p.quantity < 5).map(p => `${p.name} (${p.quantity})`).join(', ');
    
    return `
      You are a helpful business assistant for a small business owner. 
      Here is the current business snapshot:
      - Business Name: ${state.profile?.name || 'My Business'}
      - Total Revenue (All Time): ₹${totalSales.toLocaleString()}
      - Total Expenses (All Time): ₹${totalPurchases.toLocaleString()}
      - Estimated Gross Profit: ₹${profit.toLocaleString()}
      - Total Customers: ${state.customers.length}
      - Total Products: ${state.products.length}
      - Low Stock Items: ${lowStockItems || 'None'}
      
      Answer questions based on this data. Be concise and helpful. Do not use markdown formatting like bold or italics, just plain text.
    `;
  };

  const handleSelectKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
          try {
            await aistudio.openSelectKey();
            setShowKeyButton(false);
            setIsEnvConfigured(true);
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last.isError && (last.text.includes("Configure") || last.text.includes("API Key"))) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
          } catch (e) {
              console.error("Failed to open key selector", e);
              alert("Failed to open API Key configuration. Please try again.");
          }
      }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowKeyButton(false);

    try {
      const aistudio = (window as any).aistudio;
      let apiKey = getApiKey();

      if (!apiKey && aistudio) {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (!hasKey) {
              throw new Error("API_KEY_MISSING");
          }
      }
      
      if (!apiKey && !aistudio) {
           throw new Error("API_KEY_MISSING_PERMANENT");
      }
      
      const finalKey = apiKey || process.env.API_KEY || '';

      // Only initialize if we have a key or if we are relying on the SDK's internal handling (which usually needs a key)
      // The @google/genai SDK requires 'apiKey' in options.
      if (!finalKey && !aistudio) {
           throw new Error("API_KEY_EMPTY");
      }

      const ai = new GoogleGenAI({ apiKey: finalKey }); 
      const systemInstruction = generateSystemContext();
      
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
        history: messages.filter(m => !m.isError).map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }))
      });

      const result = await chat.sendMessage({ message: userMsg.text });
      const responseText = result.text;

      const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: responseText || "I couldn't generate a response." };
      setMessages(prev => [...prev, modelMsg]);

    } catch (error: any) {
      console.error("AI Error:", error);
      let errorText = "Sorry, I encountered an error connecting to the AI service.";
      
      if (error.message === "API_KEY_MISSING" || error.message === "API_KEY_EMPTY" || error.status === 400) {
          const aistudio = (window as any).aistudio;
          if (aistudio) {
             errorText = "Please configure your API Key to use the assistant.";
             setShowKeyButton(true);
          } else {
             errorText = "Invalid or Missing API Key. Please check your Vercel environment variables and redeploy.";
             setShowKeyButton(false);
             setIsEnvConfigured(false);
          }
      } else if (error.message === "API_KEY_MISSING_PERMANENT") {
             errorText = "Missing API Key. Please ensure 'VITE_API_KEY' is set in Vercel and you have redeployed.";
             setShowKeyButton(false);
             setIsEnvConfigured(false);
      } else if (error.message?.includes("API key")) {
             errorText = "The configured API Key seems invalid. Please check your settings.";
             setIsEnvConfigured(false);
      } else if (error.message?.includes("Requested entity was not found")) {
          errorText = "API Key configuration seems invalid. Please try selecting it again.";
          if ((window as any).aistudio) {
             setShowKeyButton(true);
          }
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: errorText, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
      <Card className="w-full max-w-lg h-[80vh] flex flex-col p-0 overflow-hidden animate-scale-in relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Sparkles size={18} className="text-yellow-300" />
                </div>
                <h2 className="font-bold text-lg">Business Assistant</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : msg.isError 
                            ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                    }`}>
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] font-bold uppercase tracking-wider">
                            {msg.role === 'user' ? <User size={10} /> : msg.isError ? <AlertTriangle size={10} /> : <Bot size={10} />}
                            {msg.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                        {msg.isError && showKeyButton && (
                             <div className="mt-2">
                                <Button onClick={handleSelectKey} className="bg-white border border-red-300 text-red-700 hover:bg-red-50 text-sm py-1.5 px-3 w-full flex items-center justify-center gap-2 shadow-sm">
                                    <Key size={14} /> Configure Key
                                </Button>
                             </div>
                        )}
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2 border border-gray-100 dark:border-slate-700">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                        <span className="text-xs text-gray-500">Thinking...</span>
                    </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0">
            {showKeyButton && messages.length === 1 && (
                 <div className="mb-2 flex justify-center">
                    <Button onClick={handleSelectKey} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white shadow-md">
                        <Key size={16} className="mr-2" />
                        Connect Google Account (API Key)
                    </Button>
                 </div>
            )}
            <div className={`flex gap-2 items-end bg-gray-100 dark:bg-slate-900 p-2 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all ${!isEnvConfigured && !showKeyButton ? 'opacity-50' : ''}`}>
                <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isEnvConfigured || showKeyButton ? "Ask about sales, stock, or profit..." : "API Key Missing. Please Configure in Vercel."}
                    className="flex-grow bg-transparent border-none focus:ring-0 resize-none text-sm max-h-24 py-2 px-2 dark:text-white disabled:cursor-not-allowed"
                    rows={1}
                    disabled={(!isEnvConfigured && !showKeyButton) || isLoading}
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || (!isEnvConfigured && !showKeyButton)}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5"
                >
                    <Send size={18} />
                </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-2">
                AI can make mistakes. Please verify important financial data.
            </p>
        </div>
      </Card>
    </div>
  );
};

export default AskAIModal;
    