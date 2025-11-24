
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
    { id: '1', role: 'model', text: "Hi! I'm your Senior Business Analyst. I can help you analyze your finances, track dues, and optimize inventory.\n\nTry asking:\n• Who owes me the most money?\n• What are my best selling products?\n• Give me a summary of recent activity." }
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
    // 1. Financials
    const totalSales = state.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalPurchases = state.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
    
    // Calculate Cost of Goods Sold (Approximate) to get better profit
    let totalCostOfGoodsSold = 0;
    state.sales.forEach(s => {
        s.items.forEach(i => {
            // Try to find purchase price from product catalog
            const product = state.products.find(p => p.id === i.productId);
            const cost = product ? Number(product.purchasePrice) : (Number(i.price) * 0.7); // Fallback est
            totalCostOfGoodsSold += (cost * Number(i.quantity));
        });
    });
    const grossProfit = totalSales - totalCostOfGoodsSold;

    // 2. Debtors (Who owes money)
    const debtors = state.customers.map(c => {
        const customerSales = state.sales.filter(s => s.customerId === c.id);
        const billed = customerSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const paid = customerSales.reduce((sum, s) => sum + (s.payments || []).reduce((p, pay) => p + Number(pay.amount), 0), 0);
        const due = billed - paid;
        return { name: c.name, due, area: c.area };
    })
    .filter(c => c.due > 10)
    .sort((a, b) => b.due - a.due)
    .slice(0, 10); // Top 10 debtors

    // 3. Suppliers (Who I owe)
    const creditors = state.suppliers.map(s => {
        const suppPurchases = state.purchases.filter(p => p.supplierId === s.id);
        const billed = suppPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
        const paid = suppPurchases.reduce((sum, p) => sum + (p.payments || []).reduce((pm, pay) => pm + Number(pay.amount), 0), 0);
        const due = billed - paid;
        return { name: s.name, due };
    })
    .filter(s => s.due > 10)
    .sort((a, b) => b.due - a.due);

    // 4. Top Products
    const productSales: Record<string, number> = {};
    state.sales.forEach(s => {
        s.items.forEach(i => {
            productSales[i.productName] = (productSales[i.productName] || 0) + Number(i.quantity);
        });
    });
    const topSelling = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, qty]) => `• ${name}: ${qty} units`)
        .join('\n');

    // 5. Low Stock
    const lowStockItems = state.products
        .filter(p => p.quantity < 5)
        .map(p => `• ${p.name}: Only ${p.quantity} left`)
        .slice(0, 10)
        .join('\n');

    // 6. Recent Activity (Sales & Purchases mixed)
    const recentActivity = [
        ...state.sales.map(s => ({ 
            date: new Date(s.date), 
            type: 'SALE', 
            desc: `Sold ₹${Number(s.totalAmount).toLocaleString('en-IN')} to ${state.customers.find(c => c.id === s.customerId)?.name || 'Unknown'}` 
        })),
        ...state.purchases.map(p => ({ 
            date: new Date(p.date), 
            type: 'PURCHASE', 
            desc: `Bought ₹${Number(p.totalAmount).toLocaleString('en-IN')} from ${state.suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown'}` 
        }))
    ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)
    .map(a => `• [${a.type}] ${a.date.toLocaleDateString()}: ${a.desc}`)
    .join('\n');

    return `
      You are a SENIOR BUSINESS ANALYST for "${state.profile?.name || 'Business Manager'}".
      Your goal is to provide actionable, data-driven insights to the business owner.

      === REAL-TIME BUSINESS DATA ===
      
      [FINANCIAL SNAPSHOT]
      - Total Revenue: ₹${totalSales.toLocaleString('en-IN')}
      - Total Expenses: ₹${totalPurchases.toLocaleString('en-IN')}
      - Gross Profit: ₹${grossProfit.toLocaleString('en-IN')} ${grossProfit < 0 ? '(LOSS ALERT!)' : ''}
      
      [TOP DEBTORS - FOLLOW UP REQUIRED]
      ${debtors.length > 0 ? debtors.map(d => `• ${d.name} (${d.area}): OWE ₹${d.due.toLocaleString('en-IN')}`).join('\n') : "No significant customer dues."}
      
      [MY PAYABLES]
      ${creditors.length > 0 ? creditors.map(c => `• ${c.name}: I OWE ₹${c.due.toLocaleString('en-IN')}`).join('\n') : "No outstanding payments to suppliers."}
      
      [INVENTORY INTELLIGENCE]
      Top Movers:
      ${topSelling || 'No sales yet.'}
      
      Stock Alerts (Reorder Immediately):
      ${lowStockItems || 'Inventory levels are healthy.'}
      
      [RECENT ACTIVITY LOG]
      ${recentActivity || 'No recent transactions.'}
      
      === RESPONSE GUIDELINES ===
      1. FORMATTING: 
         - Use PLAIN TEXT only.
         - NO Markdown (no bold **, no italics *, no headers #).
         - Use UPPERCASE for section headers.
         - Use bullets (•) or dashes (-) for lists.
         - Keep paragraphs short.
      
      2. NUMBERS:
         - Format all currency in Indian Rupees (e.g., ₹1,50,000).
         - Use Lakhs/Crores where appropriate for large numbers.
      
      3. BEHAVIOR:
         - Be PROACTIVE. If profit is low, suggest checking margins. If debtors are high, suggest sending reminders.
         - If asked "Who owes me money?", list the debtors clearly with amounts.
         - If asked "How is business?", analyze profit, revenue trends, and cash flow.
         - Keep it professional but direct.
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

      if (!finalKey && !aistudio) {
           throw new Error("API_KEY_EMPTY");
      }

      const ai = new GoogleGenAI({ apiKey: finalKey }); 
      const systemInstruction = generateSystemContext();
      
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { 
            systemInstruction,
            temperature: 0.7, // Slightly creative but focused
        },
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
        <div className="bg-theme p-4 flex justify-between items-center text-white shrink-0">
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
                    <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-primary text-white rounded-br-none' 
                        : msg.isError 
                            ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                    }`}>
                        <div className={`flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                            {msg.role === 'user' ? <User size={10} /> : msg.isError ? <AlertTriangle size={10} /> : <Bot size={10} />}
                            {msg.role === 'user' ? 'You' : 'Analyst'}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</div>
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
                        <Loader2 size={16} className="animate-spin text-primary" />
                        <span className="text-xs text-gray-500">Analyzing data...</span>
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
            <div className={`flex gap-2 items-end bg-gray-100 dark:bg-slate-900 p-2 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all ${!isEnvConfigured && !showKeyButton ? 'opacity-50' : ''}`}>
                <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isEnvConfigured || showKeyButton ? "Ask about sales, stock, or profit..." : "API Key Missing. Please Configure in Vercel."}
                    className="flex-grow bg-transparent border-none focus:ring-0 resize-none text-sm max-h-24 py-2 px-2 dark:text-white disabled:cursor-not-allowed placeholder-gray-400"
                    rows={1}
                    disabled={(!isEnvConfigured && !showKeyButton) || isLoading}
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || (!isEnvConfigured && !showKeyButton)}
                    className="p-2 bg-primary text-white rounded-lg hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5 shadow-sm"
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
