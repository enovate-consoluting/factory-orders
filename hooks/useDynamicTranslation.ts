"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { translateText, translateBatchTexts } from '@/lib/translate';
import { translationCache } from '@/lib/translationCache';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [translations, setTranslations] = useState<TranslationState>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [pendingQueue, setPendingQueue] = useState<Set<string>>(new Set());
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const translationsRef = useRef<TranslationState>({});

  // Keep ref in sync with state
  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  // Translate a single text (NO setState during render)
  const translate = useCallback((text: string | null | undefined): string => {
    if (!text) return '';
    if (language === 'en') return text;

    // 1. Check static translations first (en.json / zh.json)
    const staticTranslation = i18n.exists(text) ? t(text) : null;
    if (staticTranslation && staticTranslation !== text) return staticTranslation;

    // 2. Check cache
    const cached = translationCache.get(text, language);
    if (cached) return cached;

    // 3. Check if already translated in state (use ref to avoid dependency)
    const stateTranslation = translationsRef.current[text];
    if (stateTranslation) return stateTranslation;

    // 4. Queue for translation if not already loading/pending
    if (!loading.has(text)) {
      // Use setTimeout to batch multiple translate() calls and avoid setState during render
      setTimeout(() => {
        setPendingQueue(prev => new Set(prev).add(text));
      }, 0);
    }

    // Return original text while translation is pending
    return text;
  }, [language, loading, t, i18n]);

  // Collect untranslated texts for batch translation with debouncing
  useEffect(() => {
    if (language === 'en') return;
    if (pendingQueue.size === 0) return;

    // Debounce: wait 100ms to collect more texts before translating
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    batchTimerRef.current = setTimeout(async () => {
      const queueArray = Array.from(pendingQueue);
      const toTranslate = queueArray.filter(text => !translationCache.get(text, language));

      if (toTranslate.length === 0) {
        setPendingQueue(new Set());
        return;
      }

      setLoading(prev => {
        const next = new Set(prev);
        toTranslate.forEach(t => next.add(t));
        return next;
      });

      try {
        const translationMap = await translateBatchTexts(toTranslate, language);
        Object.entries(translationMap).forEach(([original, translated]) => {
          translationCache.set(original, language, translated);
        });
        setTranslations(prev => ({ ...prev, ...translationMap }));
      } catch (error) {
        console.error('Batch translation error:', error);
        // Fallback: use original texts
        const fallbackMap: TranslationState = {};
        toTranslate.forEach(text => {
          fallbackMap[text] = text;
        });
        setTranslations(prev => ({ ...prev, ...fallbackMap }));
      } finally {
        setLoading(prev => {
          const next = new Set(prev);
          toTranslate.forEach(t => next.delete(t));
          return next;
        });
        setPendingQueue(new Set());
      }
    }, 100); // 100ms debounce

    // Cleanup
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [language, pendingQueue]);

  // Translate multiple texts at once (more efficient)
  const translateBatch = useCallback(async (
    texts: string[],
    namespace?: string
  ) => {
    if (language === 'en') return;

    const uniqueTexts = [...new Set(texts.filter(Boolean))];

    // Check static translations and cache (don't check translations state to avoid dependency)
    const textsToTranslate = uniqueTexts.filter(text => {
      // Skip if exists in static translations
      if (i18n.exists(text)) {
        const staticTranslation = t(text);
        if (staticTranslation !== text) {
          translationCache.set(text, language, staticTranslation);
          return false;
        }
      }
      return !translationCache.get(text, language);
    });

    if (textsToTranslate.length === 0) {
      return; // All texts are already cached
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
      const newTranslations: TranslationState = {};
      Object.entries(translationMap).forEach(([original, translated]) => {
        translationCache.set(original, language, translated);
        newTranslations[original] = translated;
      });

      setTranslations(prev => ({ ...prev, ...newTranslations }));
    } catch (error) {
      console.error('Batch translation failed:', error);

      // Fallback: use original texts
      const fallbackTranslations: TranslationState = {};
      textsToTranslate.forEach(text => {
        fallbackTranslations[text] = text;
      });

      setTranslations(prev => ({ ...prev, ...fallbackTranslations }));
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        textsToTranslate.forEach(t => next.delete(t));
        return next;
      });
    }
  }, [language, t, i18n]);

  // Clear translations when language changes
  useEffect(() => {
    setTranslations({});
    setPendingQueue(new Set());
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
