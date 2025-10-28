'use client';

import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface UINotificationState {
  notification: {
    message: string;
    type: NotificationType;
  } | null;
  showNotification: (message: string, type: NotificationType) => void;
  hideNotification: () => void;
}

export const useUINotification = create<UINotificationState>((set) => ({
  notification: null,
  showNotification: (message, type) => set({ notification: { message, type } }),
  hideNotification: () => set({ notification: null }),
}));

// Helper functions for common notifications
export const notify = {
  success: (message: string) => useUINotification.getState().showNotification(message, 'success'),
  error: (message: string) => useUINotification.getState().showNotification(message, 'error'),
  info: (message: string) => useUINotification.getState().showNotification(message, 'info'),
  warning: (message: string) => useUINotification.getState().showNotification(message, 'warning'),
};