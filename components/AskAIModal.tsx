
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, Key, AlertTriangle, Mic, Volume2, StopCircle, WifiOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
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

// --- Audio Helper Functions for Live API ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to robustly get API Key from localStorage OR environment
const getApiKey = (): string | undefined => {
  if (typeof window !== 'undefined' && localStorage.getItem('gemini_api_key')) {
      return localStorage.getItem('gemini_api_key')!;
  }
  return process.env.API_KEY;
};

const AskAIModal: React.FC<AskAIModalProps> = ({ isOpen, onClose }) => {
  const { state, showToast } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: "Hi! I'm your Senior Business Analyst. Ask me about your finances, dues, or inventory." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyButton, setShowKeyButton] = useState(false);
  const [isEnvConfigured, setIsEnvConfigured] = useState(true);
  
  // Live API State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0); // For visualizer
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null); // To store session object if needed, though we rely on promise
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isLiveMode]);

  // Check for API key on open
  useEffect(() => {
    if (isOpen) {
        if (!state.isOnline) {
            setMessages(prev => [...prev, { 
                id: 'sys-offline', 
                role: 'model', 
                text: "⚠️ You are currently offline. AI features require an internet connection.",
                isError: true 
            }]);
            return;
        }

        const checkConfig = async () => {
            const aistudio = (window as any).aistudio;
            const key = getApiKey();
            
            if (key) {
                setIsEnvConfigured(true);
            } else if (aistudio) {
                try {
                    const hasKey = await aistudio.hasSelectedApiKey();
                    if (!hasKey) setShowKeyButton(true);
                } catch (e) {
                    console.warn("Failed to check API key status via AI Studio", e);
                }
            } else {
                setIsEnvConfigured(false);
                setMessages(prev => [...prev, { 
                    id: 'sys-error-init', 
                    role: 'model', 
                    text: "⚠️ Missing API Key. Go to Menu > API Configuration to add your Gemini API Key.",
                    isError: true 
                }]);
            }
        };
        checkConfig();
    }
    
    // Cleanup live session on close
    return () => {
        stopLiveSession();
    };
  }, [isOpen, state.isOnline]);

  const generateSystemContext = () => {
    // Generate condensed context for the model
    const totalSales = state.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalDue = state.customers.reduce((acc, c) => {
        const sales = state.sales.filter(s => s.customerId === c.id);
        const paid = sales.reduce((sum, s) => sum + s.payments.reduce((p, pay) => p + Number(pay.amount), 0), 0);
        return acc + (sales.reduce((sum,s)=>sum+Number(s.totalAmount),0) - paid);
    }, 0);
    const lowStock = state.products.filter(p => p.quantity < 5).length;

    return `You are a business analyst for ${state.profile?.name}. 
    Stats: Revenue ₹${totalSales}, Dues ₹${totalDue}, Low Stock Items: ${lowStock}.
    Answer briefly and professionally.`;
  };

  // --- LIVE API HANDLERS ---

  const startLiveSession = async () => {
      if (!state.isOnline) {
          showToast("Cannot start live session while offline.", 'error');
          return;
      }

      try {
          const apiKey = getApiKey();
          if (!apiKey) throw new Error("API Key missing");

          const ai = new GoogleGenAI({ apiKey });
          
          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
          }
          
          // Input Audio Context (16kHz for Gemini)
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          setIsLiveActive(true);
          nextStartTimeRef.current = 0;

          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                  },
                  systemInstruction: generateSystemContext(),
              },
              callbacks: {
                  onopen: () => {
                      console.log("Live Session Open");
                      const source = inputCtx.createMediaStreamSource(stream);
                      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                      
                      processor.onaudioprocess = (e) => {
                          const inputData = e.inputBuffer.getChannelData(0);
                          // Simple volume meter
                          let sum = 0;
                          for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                          const rms = Math.sqrt(sum/inputData.length);
                          setLiveVolume(Math.min(rms * 5, 1)); // Scale for visualizer

                          const blob = createBlob(inputData);
                          sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
                      };
                      
                      source.connect(processor);
                      processor.connect(inputCtx.destination);
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData && audioContextRef.current) {
                          const ctx = audioContextRef.current;
                          const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                          
                          const source = ctx.createBufferSource();
                          source.buffer = buffer;
                          source.connect(ctx.destination);
                          
                          // Schedule playback
                          const now = ctx.currentTime;
                          // Ensure we don't schedule in the past, but try to be continuous
                          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                          source.start(nextStartTimeRef.current);
                          nextStartTimeRef.current += buffer.duration;
                          
                          audioSourcesRef.current.add(source);
                          source.onended = () => audioSourcesRef.current.delete(source);
                      }
                      
                      if (msg.serverContent?.interrupted) {
                          // Stop all playing audio
                          audioSourcesRef.current.forEach(s => s.stop());
                          audioSourcesRef.current.clear();
                          nextStartTimeRef.current = 0;
                      }
                  },
                  onclose: () => {
                      console.log("Live Session Closed");
                      setIsLiveActive(false);
                  },
                  onerror: (e) => {
                      console.error("Live Error", e);
                      setIsLiveActive(false);
                      showToast("Connection error", 'error');
                  }
              }
          });
          
          liveSessionRef.current = sessionPromise;

      } catch (e) {
          console.error("Failed to start live session", e);
          showToast("Failed to start voice mode. Check permissions.", 'error');
          setIsLiveActive(false);
      }
  };

  const stopLiveSession = () => {
      if (liveSessionRef.current) {
          liveSessionRef.current.then((session: any) => session.close());
          liveSessionRef.current = null;
      }
      setIsLiveActive(false);
      setLiveVolume(0);
      
      // Stop all audio
      audioSourcesRef.current.forEach(s => {
          try { s.stop(); } catch(e){}
      });
      audioSourcesRef.current.clear();
  };

  // --- TEXT CHAT HANDLERS ---

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!state.isOnline) {
        showToast("You are offline.", 'error');
        return;
    }
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = getApiKey() || process.env.API_KEY || '';
      if (!apiKey) throw new Error("API_KEY_MISSING");

      const ai = new GoogleGenAI({ apiKey }); 
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
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error connecting to AI. Please check your API Key.", isError: true }]);
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
            
            <div className="flex bg-white/20 rounded-lg p-0.5 mx-2">
                <button 
                    onClick={() => { setIsLiveMode(false); stopLiveSession(); }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isLiveMode ? 'bg-white text-primary shadow-sm' : 'text-white hover:bg-white/10'}`}
                >
                    Chat
                </button>
                <button 
                    onClick={() => setIsLiveMode(true)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isLiveMode ? 'bg-white text-primary shadow-sm' : 'text-white hover:bg-white/10'}`}
                >
                    Live Voice
                </button>
            </div>

            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 relative">
            {!isLiveMode ? (
                // Text Chat Mode
                <>
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
                                    {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                                    {msg.role === 'user' ? 'You' : 'Analyst'}
                                </div>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2 border border-gray-100 dark:border-slate-700">
                                <Loader2 size={16} className="animate-spin text-primary" />
                                <span className="text-xs text-gray-500">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </>
            ) : (
                // Live Voice Mode
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-fade-in-fast">
                    {state.isOnline ? (
                        <>
                            <div className="relative">
                                {/* Visualizer Circle */}
                                <div 
                                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-100 ${isLiveActive ? 'bg-primary/10' : 'bg-gray-100 dark:bg-slate-800'}`}
                                    style={{ 
                                        transform: isLiveActive ? `scale(${1 + liveVolume * 0.5})` : 'scale(1)',
                                        boxShadow: isLiveActive ? `0 0 ${liveVolume * 40}px var(--primary-color)` : 'none'
                                    }}
                                >
                                    {isLiveActive ? (
                                        <Volume2 size={48} className="text-primary animate-pulse" />
                                    ) : (
                                        <Mic size={48} className="text-gray-400" />
                                    )}
                                </div>
                                
                                {/* Ripple Effects when active */}
                                {isLiveActive && (
                                    <>
                                        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                                        <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                                    </>
                                )}
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                    {isLiveActive ? "Listening..." : "Live Conversation"}
                                </h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
                                    {isLiveActive 
                                        ? "Talk to your assistant naturally. Tap Stop to end." 
                                        : "Tap Start to have a real-time voice conversation with your AI business analyst."}
                                </p>
                            </div>

                            <Button 
                                onClick={isLiveActive ? stopLiveSession : startLiveSession}
                                className={`py-4 px-8 rounded-full text-lg shadow-xl ${isLiveActive ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:brightness-110'}`}
                            >
                                {isLiveActive ? (
                                    <><StopCircle size={24} className="mr-2" /> End Session</>
                                ) : (
                                    <><Mic size={24} className="mr-2" /> Start Conversation</>
                                )}
                            </Button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-gray-500">
                            <WifiOff size={48} />
                            <p>Live Voice requires an internet connection.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Input Area (Only for Text Mode) */}
        {!isLiveMode && (
            <div className="p-3 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0">
                <div className={`flex gap-2 items-end bg-gray-100 dark:bg-slate-900 p-2 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all ${!state.isOnline ? 'opacity-50' : ''}`}>
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder={state.isOnline ? "Ask about sales, stock, or profit..." : "Offline mode enabled"}
                        className="flex-grow bg-transparent border-none focus:ring-0 resize-none text-sm max-h-24 py-2 px-2 dark:text-white disabled:cursor-not-allowed placeholder-gray-400"
                        rows={1}
                        disabled={isLoading || !state.isOnline}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim() || !state.isOnline}
                        className="p-2 bg-primary text-white rounded-lg hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5 shadow-sm"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        )}
      </Card>
    </div>
  );
};

export default AskAIModal;
