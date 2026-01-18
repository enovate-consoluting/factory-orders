/**
 * Aria - AI Assistant - Floating Chat Component
 * A floating chat bubble that expands into an AI-powered assistant
 * British female voice, elegant personality, Factory Orders focused
 * Roles: Super Admin, Admin, or users with can_access_ai_assistant
 * Last Modified: January 2025
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

// Aria's animated icon component - elegant, feminine design
function AriaIcon({ className = "w-6 h-6", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer glow ring - softer */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
        className={animated ? "animate-ping" : ""}
        style={{ animationDuration: '2.5s' }}
      />

      {/* Main circle - elegant thin stroke */}
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        className={animated ? "animate-pulse" : ""}
      />

      {/* Eyes - more feminine, slightly almond shaped */}
      <ellipse
        cx="9"
        cy="10"
        rx="1.2"
        ry="1.5"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '0ms', animationDuration: '2s' }}
      />
      <ellipse
        cx="15"
        cy="10"
        rx="1.2"
        ry="1.5"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '100ms', animationDuration: '2s' }}
      />

      {/* Gentle smile - softer curve */}
      <path
        d="M9 14C9 14 10 15.5 12 15.5C14 15.5 15 14 15 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Sparkle accents - more delicate */}
      <path
        d="M17 5L17.5 6L18.5 6.5L17.5 7L17 8L16.5 7L15.5 6.5L16.5 6L17 5Z"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '200ms' }}
      />
      <circle
        cx="6"
        cy="17"
        r="0.5"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '400ms' }}
      />
      <circle
        cx="5"
        cy="8"
        r="0.4"
        fill="currentColor"
        className={animated ? "animate-pulse" : ""}
        style={{ animationDelay: '600ms' }}
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        content: `Hello ${firstName}, I'm Aria, your Factory Orders assistant. I can help you with:\n\n• Finding orders, clients, or products\n• Checking order status and summaries\n• Creating draft orders\n• Navigating the system\n\nWhat can I help you with today?`,
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
        speak(`Hello ${firstName}, I'm Aria. How can I help you with Factory Orders today?`);
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

      // Speak Aria's response if voice is enabled
      if (voiceEnabled && data.message) {
        // Extract just the first sentence or two for speaking (keep it concise)
        const spokenText = data.message.split('\n')[0].substring(0, 200);
        speak(spokenText);
      }
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

  // Text-to-speech function - Aria speaks with ElevenLabs natural voice!
  // Falls back to Web Speech API if ElevenLabs is not configured
  const speak = async (text: string) => {
    console.log('Aria speak called:', { voiceEnabled, text: text.substring(0, 50) });

    if (!voiceEnabled || typeof window === 'undefined') {
      console.log('Aria speak blocked:', { voiceEnabled, hasWindow: typeof window !== 'undefined' });
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    setIsSpeaking(true);

    try {
      // Try ElevenLabs API first
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (data.audio) {
        // Play ElevenLabs audio
        console.log('Playing ElevenLabs audio');
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audioRef.current = audio;

        audio.onended = () => {
          console.log('Aria finished speaking (ElevenLabs)');
          setIsSpeaking(false);
          audioRef.current = null;
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsSpeaking(false);
          audioRef.current = null;
        };

        try {
          await audio.play();
          console.log('ElevenLabs audio started');
        } catch (playError: any) {
          // Mobile browsers block autoplay - fall back to Web Speech API
          console.log('Audio play blocked (likely mobile autoplay restriction):', playError.name);
          if (playError.name === 'NotAllowedError') {
            // Try Web Speech API as fallback on mobile
            speakWithWebSpeech(text);
          } else {
            setIsSpeaking(false);
          }
        }
        return;
      }

      // Fallback to Web Speech API
      console.log('Falling back to Web Speech API:', data.message || data.error);
      speakWithWebSpeech(text);
    } catch (error) {
      console.error('TTS API error:', error);
      // Fallback to Web Speech API on error
      speakWithWebSpeech(text);
    }
  };

  // Web Speech API fallback
  const speakWithWebSpeech = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.9; // Slightly lower pitch for masculine voice
    utterance.volume = 1.0;

    // Try to find a male Australian voice first, then fall back to other English male voices
    const voices = window.speechSynthesis.getVoices();
    console.log('Available voices:', voices.length, voices.map(v => `${v.name} (${v.lang})`).slice(0, 10));

    // Male Australian voice names to look for
    const maleAustralianNames = ['Gordon', 'James', 'William', 'Lee', 'Craig'];
    const maleEnglishNames = ['Daniel', 'James', 'David', 'George', 'Oliver', 'Thomas', 'Guy', 'Male'];

    // First priority: Male Australian voice
    const australianVoice = voices.find(v =>
      (v.lang === 'en-AU' && maleAustralianNames.some(name => v.name.includes(name))) ||
      (v.lang === 'en-AU' && v.name.toLowerCase().includes('male'))
    ) || voices.find(v => v.lang === 'en-AU'); // Any Australian voice as backup

    // Second priority: Male English voice
    const fallbackVoice = voices.find(v =>
      v.lang.startsWith('en') && maleEnglishNames.some(name => v.name.includes(name))
    ) || voices.find(v =>
      v.name.includes('Google') && v.name.toLowerCase().includes('male')
    ) || voices.find(v => v.lang.startsWith('en'));

    if (australianVoice) {
      utterance.voice = australianVoice;
      console.log('Using Australian voice:', australianVoice.name);
    } else if (fallbackVoice) {
      utterance.voice = fallbackVoice;
      console.log('Using fallback voice:', fallbackVoice.name);
    } else {
      console.log('Using default voice');
    }

    utterance.onstart = () => {
      console.log('Aria started speaking (WebSpeech)');
    };
    utterance.onend = () => {
      console.log('Aria finished speaking (WebSpeech)');
      setIsSpeaking(false);
    };
    utterance.onerror = (e) => {
      console.error('Aria speech error:', e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
    console.log('Web Speech synthesis speak() called');
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined') {
      // Stop ElevenLabs audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Stop Web Speech API
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

  // State for sidebar portal target
  const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Try to find the sidebar trigger element
    const trigger = document.getElementById('aria-sidebar-trigger');
    if (trigger) {
      setSidebarTarget(trigger);
    }
  }, []);

  // Only render for admin/super_admin/system_admin
  if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'system_admin') {
    return null;
  }

  // Aria button for sidebar
  const AriaButton = (
    <button
      onClick={handleOpen}
      className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full shadow-md hover:shadow-lg hover:scale-110 transition-all duration-200 flex items-center justify-center group relative"
      title="Ask Aria"
    >
      <AriaIcon className="w-5 h-5" animated={!isOpen} />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );

  return (
    <>
      {/* Aria Button - rendered in sidebar via portal, or floating as fallback */}
      {!isOpen && (
        sidebarTarget
          ? createPortal(AriaButton, sidebarTarget)
          : (
            <button
              onClick={handleOpen}
              className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group"
              title="Ask Aria"
            >
              <div className="relative">
                <AriaIcon className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" animated={true} />
              </div>
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              )}
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
                Ask Aria
              </span>
            </button>
          )
      )}

      {/* Chat Panel - Full screen on mobile, floating on desktop */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white shadow-2xl border border-gray-200 ${
            isMinimized
              ? 'bottom-6 right-6 w-72 h-14 rounded-2xl'
              : 'inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[600px] sm:max-h-[80vh] sm:rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 sm:rounded-t-2xl">
            <div className="flex items-center gap-2">
              <AriaIcon className="w-5 h-5 text-white" animated={false} />
              <span className="font-semibold text-white">Aria</span>
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
              {/* Scrollable Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

              {/* Quick Prompts (when few messages) */}
              {messages.length <= 1 && !isLoading && (
                <div className="px-4 py-2">
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

              {/* Input - Always visible at bottom */}
              <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-gray-200 bg-white flex-shrink-0 pb-safe">
                <div className="flex gap-2">
                  {/* Voice Input Button */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className={`px-3 py-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${
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
                    placeholder={isListening ? "Listening..." : "Ask Aria anything..."}
                    className={`flex-1 min-w-0 px-3 sm:px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm transition-colors ${
                      isListening ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="px-3 sm:px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
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
