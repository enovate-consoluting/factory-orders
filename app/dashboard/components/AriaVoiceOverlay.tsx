'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Send } from 'lucide-react';

interface AriaVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onToggleListen: () => void;
  onSend: (message: string) => void;
  transcript: string;
  lastResponse: string;
  userName: string;
}

// Modern abstract Aria icon - gradient orb with sparkles
export function AriaOrb({
  isListening = false,
  isSpeaking = false,
  isLoading = false,
  size = 'large'
}: {
  isListening?: boolean;
  isSpeaking?: boolean;
  isLoading?: boolean;
  size?: 'small' | 'medium' | 'large';
}) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-20 h-20',
    large: 'w-32 h-32 sm:w-40 sm:h-40'
  };

  const pulseClass = isListening
    ? 'animate-pulse-fast'
    : isSpeaking
      ? 'animate-pulse-speak'
      : isLoading
        ? 'animate-spin-slow'
        : '';

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      {/* Outer glow rings */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 blur-xl ${isListening || isSpeaking ? 'scale-150 opacity-100' : 'scale-100 opacity-50'} transition-all duration-500`} />
      <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 blur-lg ${isListening || isSpeaking ? 'scale-125 opacity-100' : 'scale-100 opacity-30'} transition-all duration-300`} />

      {/* Main orb */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-2xl ${pulseClass}`}>
        {/* Inner shine */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/30 via-transparent to-transparent" />

        {/* Waveform bars - only show when listening or speaking */}
        {(isListening || isSpeaking) && (
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-1 sm:w-1.5 bg-white/80 rounded-full ${isSpeaking ? 'animate-wave-speak' : 'animate-wave'}`}
                style={{
                  height: '30%',
                  animationDelay: `${i * 100}ms`,
                  animationDuration: isSpeaking ? '0.5s' : '0.8s'
                }}
              />
            ))}
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && !isListening && !isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Idle state - subtle sparkle */}
        {!isListening && !isSpeaking && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-1/3 h-1/3 text-white/80" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Animated ring for listening state */}
      {isListening && (
        <>
          <div className="absolute -inset-4 rounded-full border-2 border-pink-400/50 animate-ping" style={{ animationDuration: '1.5s' }} />
          <div className="absolute -inset-8 rounded-full border border-purple-400/30 animate-ping" style={{ animationDuration: '2s' }} />
        </>
      )}
    </div>
  );
}

// Small button icon version
export function AriaButtonIcon({ className = "w-6 h-6", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 ${animated ? 'animate-pulse' : ''}`}>
        <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-white/40 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-1/2 h-1/2 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
          </svg>
        </div>
      </div>
      {animated && (
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-500/50 to-pink-500/50 blur-sm animate-pulse" />
      )}
    </div>
  );
}

export default function AriaVoiceOverlay({
  isOpen,
  onClose,
  isListening,
  isSpeaking,
  isLoading,
  voiceEnabled,
  onToggleVoice,
  onToggleListen,
  onSend,
  transcript,
  lastResponse,
  userName
}: AriaVoiceOverlayProps) {
  const [localInput, setLocalInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync transcript to local input
  useEffect(() => {
    if (transcript) {
      setLocalInput(transcript);
    }
  }, [transcript]);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (localInput.trim()) {
      onSend(localInput.trim());
      setLocalInput('');
    }
  }, [localInput, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const firstName = userName.split(' ')[0];

  // Status text
  const statusText = isListening
    ? "I'm listening..."
    : isSpeaking
      ? "Speaking..."
      : isLoading
        ? "Thinking..."
        : `Hello ${firstName}, tap the mic to talk`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-gray-900/95 via-purple-900/90 to-gray-900/95 backdrop-blur-xl">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Voice toggle */}
      <button
        onClick={onToggleVoice}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
        title={voiceEnabled ? 'Mute Aria' : 'Unmute Aria'}
      >
        {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      {/* Main content */}
      <div className="flex flex-col items-center gap-6 sm:gap-8 px-4 max-w-2xl w-full">
        {/* Aria name */}
        <h2 className="text-white/80 text-lg sm:text-xl font-light tracking-wider">ARIA</h2>

        {/* The orb */}
        <button
          onClick={onToggleListen}
          className="focus:outline-none focus:ring-2 focus:ring-purple-400/50 rounded-full p-4 transition-transform hover:scale-105 active:scale-95"
        >
          <AriaOrb
            isListening={isListening}
            isSpeaking={isSpeaking}
            isLoading={isLoading}
            size="large"
          />
        </button>

        {/* Status */}
        <p className={`text-center text-sm sm:text-base transition-all duration-300 ${
          isListening ? 'text-pink-300' : isSpeaking ? 'text-purple-300' : 'text-white/60'
        }`}>
          {statusText}
        </p>

        {/* Response display */}
        {lastResponse && !isListening && (
          <div className="w-full max-h-40 overflow-y-auto px-4 py-3 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/90 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {lastResponse}
            </p>
          </div>
        )}

        {/* Input area */}
        <div className="w-full flex gap-2 items-center">
          <button
            onClick={onToggleListen}
            className={`p-3 rounded-full transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Or type your message..."}
            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
          />

          <button
            onClick={handleSend}
            disabled={!localInput.trim() || isLoading}
            className="p-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Hint */}
        <p className="text-white/30 text-xs text-center">
          Tap the orb or mic button to speak • Press Enter to send
        </p>
      </div>

      {/* CSS for custom animations */}
      <style jsx global>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        @keyframes wave-speak {
          0%, 100% { transform: scaleY(0.3); }
          25% { transform: scaleY(1.2); }
          50% { transform: scaleY(0.8); }
          75% { transform: scaleY(1.5); }
        }
        @keyframes pulse-fast {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes pulse-speak {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.02); }
          50% { transform: scale(1.04); }
          75% { transform: scale(1.02); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-wave {
          animation: wave 0.8s ease-in-out infinite;
        }
        .animate-wave-speak {
          animation: wave-speak 0.5s ease-in-out infinite;
        }
        .animate-pulse-fast {
          animation: pulse-fast 1s ease-in-out infinite;
        }
        .animate-pulse-speak {
          animation: pulse-speak 0.6s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
