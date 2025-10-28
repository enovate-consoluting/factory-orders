'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface UINotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

export function UINotification({ message, type, onClose, duration = 5000 }: UINotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
      icon: CheckCircle,
      title: 'Success!'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-600',
      icon: XCircle,
      title: 'Error'
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-cyan-600',
      icon: Info,
      title: 'Info'
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-500 to-orange-600',
      icon: AlertTriangle,
      title: 'Warning'
    }
  };

  const config = styles[type];
  const Icon = config.icon;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`${config.bg} text-white rounded-lg shadow-2xl p-4 min-w-[320px] max-w-md`}>
        <div className="flex items-start gap-3">
          <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{config.title}</p>
            <p className="text-sm mt-1 opacity-95">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="opacity-75 hover:opacity-100 transition-opacity"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}