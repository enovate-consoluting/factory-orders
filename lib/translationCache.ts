// Translation cache to avoid repeated API calls
interface CacheEntry {
  translated: string;
  timestamp: number;
}

interface TranslationCache {
  [key: string]: CacheEntry;
}

const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

class TranslationCacheManager {
  private cache: TranslationCache = {};
  private storageKey = 'translationCache';

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading translation cache:', error);
    }
  }

  private saveToStorage() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving translation cache:', error);
    }
  }

  private getCacheKey(text: string, target: 'zh' | 'en'): string {
    return `${target}:${text}`;
  }

  get(text: string, target: 'zh' | 'en'): string | null {
    const key = this.getCacheKey(text, target);
    const entry = this.cache[key];

    if (!entry) return null;

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      delete this.cache[key];
      this.saveToStorage();
      return null;
    }

    return entry.translated;
  }

  set(text: string, target: 'zh' | 'en', translated: string) {
    const key = this.getCacheKey(text, target);
    this.cache[key] = {
      translated,
      timestamp: Date.now(),
    };
    this.saveToStorage();
  }

  clear() {
    this.cache = {};
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.storageKey);
    }
  }
}

export const translationCache = new TranslationCacheManager();
