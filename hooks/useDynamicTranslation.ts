"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { translateText, translateBatchTexts } from '@/lib/translate';
import { translationCache } from '@/lib/translationCache';
import { useLanguage } from '@/contexts/LanguageContext';

interface TranslationState {
  [key: string]: string;
}

/**
 * Hook for translating dynamic content from database
 *
 * @example
 * const { translate, translateBatch, isLoading } = useDynamicTranslation();
 *
 * // Single translation
 * const translatedText = translate('Hello World');
 *
 * // Batch translation
 * useEffect(() => {
 *   const texts = products.map(p => p.name);
 *   translateBatch(texts, 'product_names');
 * }, [products]);
 */
export function useDynamicTranslation() {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<TranslationState>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [pendingQueue, setPendingQueue] = useState<Set<string>>(new Set());
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Process pending queue in batch
  const processPendingQueue = useCallback(async () => {
    if (pendingQueue.size === 0) return;

    const textsToTranslate = Array.from(pendingQueue);
    setPendingQueue(new Set()); // Clear queue

    setLoading(prev => {
      const next = new Set(prev);
      textsToTranslate.forEach(t => next.add(t));
      return next;
    });

    try {
      const translationMap = await translateBatchTexts(textsToTranslate, language);

      Object.entries(translationMap).forEach(([original, translated]) => {
        translationCache.set(original, language, translated);
      });

      setTranslations(prev => ({ ...prev, ...translationMap }));
    } catch (error) {
      console.error('Batch translation error:', error);

      // Fallback: use original texts
      const fallbackMap: TranslationState = {};
      textsToTranslate.forEach(text => {
        fallbackMap[text] = text;
      });
      setTranslations(prev => ({ ...prev, ...fallbackMap }));
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        textsToTranslate.forEach(t => next.delete(t));
        return next;
      });
    }
  }, [pendingQueue, language]);

  // Translate a single text (now queues for batch processing)
  const translate = useCallback((text: string | null | undefined): string => {
    if (!text) return '';
    if (language === 'en') return text;

    // Check cache first
    const cached = translationCache.get(text, language);
    if (cached) return cached;

    // Check if already translated
    if (translations[text]) return translations[text];

    // Check if already loading or pending
    if (loading.has(text) || pendingQueue.has(text)) {
      return text; // Return original while loading
    }

    // Add to pending queue instead of immediate translation
    setPendingQueue(prev => new Set(prev).add(text));

    // Debounce: wait 100ms to collect more texts, then process batch
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    batchTimerRef.current = setTimeout(() => {
      processPendingQueue();
    }, 100);

    // Return original text while loading
    return text;
  }, [language, translations, loading, pendingQueue, processPendingQueue]);

  // Translate multiple texts at once (more efficient)
  const translateBatch = useCallback(async (
    texts: string[],
    namespace?: string
  ) => {
    if (language === 'en') return;

    const uniqueTexts = [...new Set(texts.filter(Boolean))];
    const newTranslations: TranslationState = {};

    // Check cache and filter out already translated texts
    const textsToTranslate = uniqueTexts.filter(text => {
      const cached = translationCache.get(text, language);
      if (cached) {
        newTranslations[text] = cached;
        return false;
      }
      if (translations[text]) {
        newTranslations[text] = translations[text];
        return false;
      }
      return true;
    });

    if (textsToTranslate.length === 0) {
      setTranslations(prev => ({ ...prev, ...newTranslations }));
      return;
    }

    setLoading(prev => {
      const next = new Set(prev);
      textsToTranslate.forEach(t => next.add(t));
      return next;
    });

    try {
      // Use batch translation API - ONE request for all texts
      const translationMap = await translateBatchTexts(textsToTranslate, language);

      // Cache all translations and update state
      Object.entries(translationMap).forEach(([original, translated]) => {
        translationCache.set(original, language, translated);
        newTranslations[original] = translated;
      });

      setTranslations(prev => ({ ...prev, ...newTranslations }));
    } catch (error) {
      console.error('Batch translation failed:', error);

      // Fallback: use original texts
      textsToTranslate.forEach(text => {
        newTranslations[text] = text;
      });

      setTranslations(prev => ({ ...prev, ...newTranslations }));
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        textsToTranslate.forEach(t => next.delete(t));
        return next;
      });
    }
  }, [language, translations]);

  // Clear translations when language changes
  useEffect(() => {
    setTranslations({});
  }, [language]);

  return {
    translate,
    translateBatch,
    isLoading: loading.size > 0,
    language,
    translations, // Expose translations for advanced use cases
  };
}

/**
 * Hook for translating a single text value
 *
 * @example
 * const translatedName = useTranslateText(product.name);
 */
export function useTranslateText(text: string | null | undefined): string {
  const { translate } = useDynamicTranslation();
  return translate(text);
}

/**
 * Hook for translating an array of objects with specific fields
 *
 * @example
 * const translatedProducts = useTranslateArray(products, ['name', 'description']);
 */
export function useTranslateArray<T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[]
): T[] {
  const { language } = useLanguage();
  const { translations } = useDynamicTranslation();
  const [translatedItems, setTranslatedItems] = useState<T[]>(items);

  useEffect(() => {
    if (language === 'en') {
      setTranslatedItems(items);
      return;
    }

    const translated = items.map(item => {
      const translatedItem = { ...item };
      fields.forEach(field => {
        const value = item[field];
        if (typeof value === 'string' && translations[value]) {
          (translatedItem as any)[field] = translations[value];
        }
      });
      return translatedItem;
    });

    setTranslatedItems(translated);
  }, [items, fields, language, translations]);

  return translatedItems;
}
