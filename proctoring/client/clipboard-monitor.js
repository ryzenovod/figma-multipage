/**
 * Clipboard Monitor - Детектирование скопированного кода
 * 
 * Отслеживает операции копирования и вставки для обнаружения читерства.
 * Критерий: Эффективность детектирования скопированного кода
 */

class ClipboardMonitor {
    constructor(eventCallback, options = {}) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        
        // Конфигурация
        this.config = {
            minTextLength: options.minTextLength || 10,  // Минимальная длина для детектирования
            suspiciousThreshold: options.suspiciousThreshold || 50,  // Подозрительный размер вставки
            historySize: options.historySize || 50,
            debounceTime: options.debounceTime || 500,  // Мс для группировки быстрых событий
            ...options
        };
        
        // История операций
        this.pasteHistory = [];
        this.copyHistory = [];
        
        // Биндинги для контекста
        this.handlePaste = this.handlePaste.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handleCut = this.handleCut.bind(this);
        
        // Для дебаунса
        this.lastPasteTime = 0;
        this.pendingPasteEvent = null;
    }

    /**
     * Включить мониторинг
     */
    enable() {
        if (this.isEnabled) return;
        
        // Подписываемся на события на уровне документа
        document.addEventListener('paste', this.handlePaste, true);
        document.addEventListener('copy', this.handleCopy, true);
        document.addEventListener('cut', this.handleCut, true);
        
        this.isEnabled = true;
        console.log('[ClipboardMonitor] Enabled');
    }

    /**
     * Выключить мониторинг
     */
    disable() {
        if (!this.isEnabled) return;
        
        document.removeEventListener('paste', this.handlePaste, true);
        document.removeEventListener('copy', this.handleCopy, true);
        document.removeEventListener('cut', this.handleCut, true);
        
        this.isEnabled = false;
        console.log('[ClipboardMonitor] Disabled');
    }

    /**
     * Обработка события вставки (paste)
     */
    async handlePaste(event) {
        try {
            const timestamp = Date.now();
            let pastedText = '';
            
            // Метод 1: Получение из clipboardData события
            if (event.clipboardData) {
                pastedText = event.clipboardData.getData('text/plain');
            }
            
            // Метод 2: Async Clipboard API (если доступен)
            if (!pastedText && navigator.clipboard && navigator.clipboard.readText) {
                try {
                    pastedText = await navigator.clipboard.readText();
                } catch (err) {
                    // Clipboard API может требовать разрешений
                    console.debug('[ClipboardMonitor] Clipboard API недоступен');
                }
            }
            
            // Метод 3: Чтение из целевого элемента после небольшой задержки
            if (!pastedText || pastedText.length === 0) {
                setTimeout(() => {
                    if (event.target) {
                        const element = event.target;
                        const currentValue = element.value || element.textContent || '';
                        // Небольшой хак для определения вставленного текста
                        if (currentValue.length > (this.lastElementLength || 0)) {
                            const inserted = currentValue.slice(this.lastElementLength || 0);
                            if (inserted.length > 0) {
                                this.processPastedText(inserted, event, timestamp);
                            }
                        }
                        this.lastElementLength = currentValue.length;
                    }
                }, 50);
                return;
            }
            
            // Обрабатываем полученный текст
            this.processPastedText(pastedText, event, timestamp);
            
        } catch (error) {
            console.error('[ClipboardMonitor] Ошибка при обработке paste:', error);
        }
    }

    /**
     * Обработать вставленный текст
     */
    processPastedText(text, event, timestamp) {
        if (!text || text.trim().length < this.config.minTextLength) {
            return;
        }
        
        // Дебаунс для группировки быстрых вставок
        const timeSinceLastPaste = timestamp - this.lastPasteTime;
        if (timeSinceLastPaste < this.config.debounceTime) {
            // Группируем с предыдущим событием
            if (this.pendingPasteEvent) {
                this.pendingPasteEvent.text += '\n' + text;
                this.pendingPasteEvent.textLength += text.length;
                this.pendingPasteEvent.lineCount = this.pendingPasteEvent.text.split('\n').length;
            } else {
                this.pendingPasteEvent = this.createPasteEvent(text, event, timestamp);
            }
            
            // Отложенная отправка группированных событий
            clearTimeout(this.pasteDebounceTimeout);
            this.pasteDebounceTimeout = setTimeout(() => {
                if (this.pendingPasteEvent) {
                    this.sendPasteEvent(this.pendingPasteEvent);
                    this.pendingPasteEvent = null;
                }
            }, this.config.debounceTime);
            
            return;
        }
        
        // Создаем событие для немедленной отправки
        const pasteEvent = this.createPasteEvent(text, event, timestamp);
        this.sendPasteEvent(pasteEvent);
        this.lastPasteTime = timestamp;
    }

    /**
     * Создать объект события вставки
     */
    createPasteEvent(text, event, timestamp) {
        const textLength = text.length;
        const lineCount = text.split('\n').length;
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        
        // Анализ содержимого
        const analysis = this.analyzeTextContent(text);
        
        // Определяем подозрительность
        const isSuspicious = this.isSuspiciousPaste(text, analysis);
        
        return {
            type: 'clipboard_paste',
            timestamp: timestamp,
            textLength: textLength,
            lineCount: lineCount,
            wordCount: wordCount,
            textPreview: this.getTextPreview(text, 200),  // Первые 200 символов
            context: this.getInsertionContext(event.target),
            analysis: analysis,
            suspicious: isSuspicious,
            riskScore: this.calculatePasteRiskScore(text, analysis)
        };
    }

    /**
     * Отправить событие вставки
     */
    sendPasteEvent(event) {
        // Сохраняем в историю
        this.pasteHistory.push({
            timestamp: event.timestamp,
            textLength: event.textLength,
            suspicious: event.suspicious
        });
        
        // Ограничиваем размер истории
        if (this.pasteHistory.length > this.config.historySize) {
            this.pasteHistory.shift();
        }
        
        // Вызываем callback
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Анализ содержимого текста
     */
    analyzeTextContent(text) {
        // Проверка на структуру кода
        const codeIndicators = {
            hasBrackets: /[{}[\]]/.test(text),
            hasParentheses: /\([^)]*\)/.test(text),
            hasSemicolons: text.includes(';'),
            hasEquals: /[=<>!]+/.test(text),
            hasKeywords: /\b(function|const|let|var|class|if|else|for|while|return|import|export)\b/.test(text),
            hasComments: /\/\/|\/\*|\*\/|#/.test(text),
            hasStrings: /(["'`])/.test(text),
            hasIndentation: /^\s{4,}|\t/.test(text.split('\n')[0] || ''),
            lineCount: text.split('\n').length
        };
        
        // Определяем, похоже ли это на код
        const codeScore = Object.values(codeIndicators).filter(Boolean).length;
        const isLikelyCode = codeScore >= 3 || codeIndicators.hasKeywords;
        
        return {
            codeIndicators,
            isLikelyCode,
            codeScore,
            hasStructure: codeIndicators.hasBrackets || codeIndicators.hasParentheses,
            hasKeywords: codeIndicators.hasKeywords
        };
    }

    /**
     * Определить, является ли вставка подозрительной
     */
    isSuspiciousPaste(text, analysis) {
        // Большой объем текста
        if (text.length > this.config.suspiciousThreshold * 10) {
            return true;
        }
        
        // Много строк (вероятно, скопирован целый блок кода)
        if (analysis.lineCount > 10) {
            return true;
        }
        
        // Структурированный код
        if (analysis.isLikelyCode && text.length > 50) {
            return true;
        }
        
        // Частые вставки (из истории)
        if (this.getRecentPasteCount(5000) > 3) {  // Больше 3 вставок за 5 секунд
            return true;
        }
        
        return false;
    }

    /**
     * Рассчитать риск вставки
     */
    calculatePasteRiskScore(text, analysis) {
        let score = 0;
        
        // Базовый риск по размеру
        if (text.length > 100) score += 10;
        if (text.length > 500) score += 20;
        if (text.length > 1000) score += 30;
        
        // Риск если это код
        if (analysis.isLikelyCode) {
            score += 15;
            if (text.length > 100) score += 20;
        }
        
        // Риск по количеству строк
        if (analysis.lineCount > 5) score += 10;
        if (analysis.lineCount > 20) score += 20;
        
        // Риск по частоте вставок
        const recentCount = this.getRecentPasteCount(10000);
        score += Math.min(recentCount * 5, 25);
        
        return Math.min(score, 100);
    }

    /**
     * Получить количество недавних вставок
     */
    getRecentPasteCount(timeWindow) {
        const now = Date.now();
        return this.pasteHistory.filter(p => 
            (now - p.timestamp) < timeWindow
        ).length;
    }

    /**
     * Получить контекст вставки
     */
    getInsertionContext(element) {
        if (!element) return null;
        
        return {
            tagName: element.tagName,
            id: element.id || null,
            className: element.className || null,
            isEditable: element.isContentEditable || 
                       element.tagName === 'INPUT' || 
                       element.tagName === 'TEXTAREA'
        };
    }

    /**
     * Получить превью текста
     */
    getTextPreview(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        
        const preview = text.substring(0, maxLength);
        const lastNewline = preview.lastIndexOf('\n');
        
        if (lastNewline > 0 && lastNewline < maxLength * 0.8) {
            return preview.substring(0, lastNewline) + '...';
        }
        
        return preview + '...';
    }

    /**
     * Обработка события копирования (copy)
     */
    handleCopy(event) {
        try {
            const timestamp = Date.now();
            let copiedText = '';
            
            if (window.getSelection) {
                copiedText = window.getSelection().toString();
            }
            
            if (!copiedText && document.selection && document.selection.type !== 'Control') {
                copiedText = document.selection.createRange().text;
            }
            
            if (copiedText && copiedText.length >= this.config.minTextLength) {
                const copyEvent = {
                    type: 'clipboard_copy',
                    timestamp: timestamp,
                    textLength: copiedText.length,
                    textPreview: this.getTextPreview(copiedText, 100),
                    analysis: this.analyzeTextContent(copiedText)
                };
                
                // Сохраняем в историю
                this.copyHistory.push({
                    timestamp: timestamp,
                    textLength: copiedText.length
                });
                
                if (this.copyHistory.length > this.config.historySize) {
                    this.copyHistory.shift();
                }
                
                // Отправляем событие
                if (this.eventCallback) {
                    this.eventCallback(copyEvent);
                }
            }
        } catch (error) {
            console.error('[ClipboardMonitor] Ошибка при обработке copy:', error);
        }
    }

    /**
     * Обработка события вырезания (cut)
     */
    handleCut(event) {
        // Аналогично copy, но с типом cut
        this.handleCopy(event);
        if (event && event.type) {
            event.type = 'clipboard_cut';
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        const now = Date.now();
        const timeWindow = 60000;  // Последняя минута
        
        return {
            totalPastes: this.pasteHistory.length,
            recentPastes: this.getRecentPasteCount(timeWindow),
            totalCopies: this.copyHistory.length,
            suspiciousPastes: this.pasteHistory.filter(p => p.suspicious).length
        };
    }
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardMonitor;
}

