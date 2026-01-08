/**
 * Eddie - AI Assistant - Floating Chat Component
 * A floating chat bubble that expands into an AI-powered assistant
 * Roles: Super Admin, Admin, or users with can_access_ai_assistant
 * Last Modified: January 2025
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Minimize2,
  Trash2,
  ArrowRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';

// Eddie's animated icon component
function EddieIcon({ className = "w-6 h-6", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer glow ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.3"
        className={animated ? "animate-ping" : ""}
        style={{ animationDuration: '2s' }}
      />

      {/* Main circle */}
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        className={animated ? "animate-pulse" : ""}
      />

      {/* Inner orbs - animated */}
      <circle
        cx="9"
        cy="10"
        r="1.5"
        fill="currentColor"
        className={animated ? "animate-bounce" : ""}
        style={{ animationDelay: '0ms', animationDuration: '1s' }}
      />
      <circle
        cx="15"
        cy="10"
        r="1.5"
        fill="currentColor"
        className={animated ? "animate-bounce" : ""}
        style={{ animationDelay: '150ms', animationDuration: '1s' }}
      />

      {/* Smile */}
      <path
        d="M8.5 14C8.5 14 9.5 16 12 16C14.5 16 15.5 14 15.5 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Sparkle accents */}
      <circle
        cx="18"
        cy="6"
        r="1"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '300ms' }}
      />
      <circle
        cx="6"
        cy="18"
        r="0.75"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '500ms' }}
      />
    </svg>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
}

interface AssistantAction {
  type: 'navigate' | 'view_order' | 'view_client' | 'view_product';
  label: string;
  url?: string;
  data?: any;
}

interface AiAssistantProps {
  userRole: string;
  userName: string;
}

export default function AiAssistant({ userRole, userName }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const hasGreetedRef = useRef(false);

  // Load speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setVoicesLoaded(true);
        }
      };

      // Try loading immediately
      loadVoices();

      // Also listen for voices changed event (needed for Chrome)
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Check for speech recognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInput(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const firstName = userName.split(' ')[0];
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Hey ${firstName}! I'm Eddie, your AI assistant. I can help you with:\n\n• Finding orders, clients, or products\n• Checking statistics and reports\n• Navigating the system\n• Answering questions about orders\n\nWhat can I help you with today?`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, userName]);

  // Speak greeting when voices are loaded and chat is open
  useEffect(() => {
    if (isOpen && voicesLoaded && voiceEnabled && !hasGreetedRef.current && messages.length > 0) {
      hasGreetedRef.current = true;
      const firstName = userName.split(' ')[0];
      // Small delay for better UX
      setTimeout(() => {
        speak(`G'day ${firstName}! I'm Eddie, your AI assistant. How can I help you today mate?`);
      }, 300);
    }
  }, [isOpen, voicesLoaded, voiceEnabled, messages.length, userName]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasUnread(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          userRole,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: AssistantAction) => {
    if (action.url) {
      window.location.href = action.url;
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Text-to-speech function - Eddie speaks with an Australian accent!
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined') return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find an Australian voice first, then fall back to other English voices
    const voices = window.speechSynthesis.getVoices();
    const australianVoice = voices.find(v =>
      v.lang === 'en-AU' || v.name.includes('Australia') || v.name.includes('Karen') || v.name.includes('Lee')
    );
    const fallbackVoice = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Daniel') || v.lang.startsWith('en')
    );

    if (australianVoice) {
      utterance.voice = australianVoice;
    } else if (fallbackVoice) {
      utterance.voice = fallbackVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleVoiceOutput = () => {
    if (voiceEnabled) {
      stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  // Quick prompts for empty state
  const quickPrompts = [
    "Show me today's orders",
    "Which orders are pending?",
    "Find orders for client...",
    "What's our revenue this month?"
  ];

  // Only render for admin/super_admin
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return null;
  }

  return (
    <>
      {/* Floating Button - Eddie */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group"
          title="Ask Eddie"
        >
          <div className="relative">
            <EddieIcon className="w-8 h-8 group-hover:scale-110 transition-transform" animated={true} />
          </div>
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          )}
          {/* Floating label */}
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Ask Eddie
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 ${
            isMinimized
              ? 'w-72 h-14'
              : 'w-[400px] h-[600px] max-h-[80vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <EddieIcon className="w-5 h-5 text-white" animated={false} />
              <span className="font-semibold text-white">Eddie</span>
              {isLoading && (
                <Loader2 className="w-4 h-4 text-white/80 animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isMinimized && (
                <>
                  <button
                    onClick={toggleVoiceOutput}
                    className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${
                      voiceEnabled ? 'text-white' : 'text-white/50'
                    } ${isSpeaking ? 'animate-pulse' : ''}`}
                    title={voiceEnabled ? 'Turn off voice' : 'Turn on voice'}
                  >
                    {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleClearChat}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Clear chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleMinimize}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Minimize"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </>
              )}
              {isMinimized && (
                <button
                  onClick={() => setIsMinimized(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Expand"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-130px)]">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Action Buttons */}
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.actions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAction(action)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors border border-blue-200"
                            >
                              <span>{action.label}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts (when no messages) */}
              {messages.length <= 1 && !isLoading && (
                <div className="px-4 pb-2">
                  <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  {/* Voice Input Button */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className={`px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Ask Eddie anything..."}
                    className={`flex-1 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm transition-colors ${
                      isListening ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {isListening && (
                  <p className="text-xs text-red-500 mt-2 text-center animate-pulse">
                    Listening... speak now
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
