/**
 * Clipboard Monitor - Детектирование скопированного кода
 * Отслеживает события копирования и вставки для обнаружения читерства
 */

class ClipboardMonitor {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isMonitoring = false;
        this.clipboardHistory = [];
        this.maxHistorySize = 50;
        
        // Биндинги методов
        this.handleCopy = this.handleCopy.bind(this);
        this.handlePaste = this.handlePaste.bind(this);
        this.handleCut = this.handleCut.bind(this);
    }

    /**
     * Начать мониторинг буфера обмена
     */
    start() {
        if (this.isMonitoring) {
            console.warn('ClipboardMonitor: уже запущен');
            return;
        }

        // Отслеживание событий на уровне документа
        document.addEventListener('copy', this.handleCopy, true);
        document.addEventListener('paste', this.handlePaste, true);
        document.addEventListener('cut', this.handleCut, true);

        // Отслеживание через API буфера обмена (если доступно)
        if (navigator.clipboard) {
            this.monitorClipboardAPI();
        }

        this.isMonitoring = true;
        console.log('ClipboardMonitor: мониторинг запущен');
    }

    /**
     * Остановить мониторинг
     */
    stop() {
        if (!this.isMonitoring) return;

        document.removeEventListener('copy', this.handleCopy, true);
        document.removeEventListener('paste', this.handlePaste, true);
        document.removeEventListener('cut', this.handleCut, true);

        this.isMonitoring = false;
        console.log('ClipboardMonitor: мониторинг остановлен');
    }

    /**
     * Обработка события копирования
     */
    handleCopy(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length === 0) return;

        const eventData = {
            type: 'clipboard_copy',
            timestamp: Date.now(),
            textLength: selectedText.length,
            textPreview: this.getTextPreview(selectedText),
            selectionRange: this.getSelectionRange(selection)
        };

        this.clipboardHistory.push({
            text: selectedText,
            timestamp: eventData.timestamp
        });

        // Ограничиваем размер истории
        if (this.clipboardHistory.length > this.maxHistorySize) {
            this.clipboardHistory.shift();
        }

        this.emitEvent(eventData);
    }

    /**
     * Обработка события вставки
     */
    async handlePaste(event) {
        // Пытаемся получить текст из события
        let pastedText = '';
        
        try {
            // Метод 1: из clipboardData события
            if (event.clipboardData) {
                pastedText = event.clipboardData.getData('text/plain');
            }
            
            // Метод 2: через Async Clipboard API
            if (!pastedText && navigator.clipboard) {
                try {
                    pastedText = await navigator.clipboard.readText();
                } catch (err) {
                    // Clipboard API может быть недоступен
                    console.debug('ClipboardMonitor: не удалось прочитать через Clipboard API');
                }
            }
            
            // Метод 3: чтение из элемента (если это input/textarea)
            if (!pastedText && event.target) {
                // Даем время на вставку
                setTimeout(() => {
                    const elementValue = event.target.value || event.target.textContent || '';
                    // Сравниваем с предыдущим значением для определения вставленного текста
                    const newText = elementValue.slice(0, pastedText.length);
                    if (newText !== pastedText) {
                        pastedText = newText;
                    }
                }, 10);
            }
        } catch (err) {
            console.warn('ClipboardMonitor: ошибка при чтении вставленного текста', err);
            // Используем оценку по длине
            pastedText = '[не удалось прочитать]';
        }

        if (!pastedText || pastedText.trim().length === 0) {
            return;
        }

        // Получаем позицию курсора/вставки
        const position = this.getCursorPosition(event.target);

        const eventData = {
            type: 'clipboard_paste',
            timestamp: Date.now(),
            textLength: pastedText.length,
            textPreview: this.getTextPreview(pastedText),
            position: position,
            codeContext: this.getCodeContext(event.target, position),
            // Проверяем, был ли этот текст скопирован ранее в этой сессии
            matchesRecentCopy: this.checkRecentCopy(pastedText)
        };

        // Определяем подозрительность
        eventData.suspiciousScore = this.calculateSuspiciousScore(eventData);

        this.emitEvent(eventData);
    }

    /**
     * Обработка события вырезания
     */
    handleCut(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length === 0) return;

        const eventData = {
            type: 'clipboard_cut',
            timestamp: Date.now(),
            textLength: selectedText.length,
            textPreview: this.getTextPreview(selectedText)
        };

        this.emitEvent(eventData);
    }

    /**
     * Мониторинг через Clipboard API
     */
    async monitorClipboardAPI() {
        // Периодическая проверка изменений в буфере обмена
        // (работает только в контексте расширений или с разрешениями)
        setInterval(async () => {
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText && clipboardText.length > 50) {
                    // Проверяем, не является ли это большим фрагментом кода
                    const eventData = {
                        type: 'clipboard_large_content',
                        timestamp: Date.now(),
                        textLength: clipboardText.length,
                        textPreview: this.getTextPreview(clipboardText),
                        note: 'Обнаружен большой фрагмент в буфере обмена'
                    };
                    this.emitEvent(eventData);
                }
            } catch (err) {
                // Игнорируем ошибки доступа к clipboard
            }
        }, 5000); // Проверка каждые 5 секунд
    }

    /**
     * Получить превью текста (первые N символов)
     */
    getTextPreview(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Получить диапазон выделения
     */
    getSelectionRange(selection) {
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        return {
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            startContainer: range.startContainer.nodeName,
            endContainer: range.endContainer.nodeName
        };
    }

    /**
     * Получить позицию курсора
     */
    getCursorPosition(element) {
        if (!element) return null;

        // Для input/textarea
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return {
                type: 'input',
                selectionStart: element.selectionStart,
                selectionEnd: element.selectionEnd
            };
        }

        // Для contenteditable
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            return {
                type: 'contenteditable',
                offset: range.startOffset
            };
        }

        return null;
    }

    /**
     * Получить контекст кода вокруг позиции вставки
     */
    getCodeContext(element, position, contextLength = 50) {
        if (!element || !position) return null;

        try {
            let text = '';
            if (element.value) {
                text = element.value;
            } else if (element.textContent) {
                text = element.textContent;
            } else {
                return null;
            }

            const offset = position.selectionStart || position.offset || 0;
            const start = Math.max(0, offset - contextLength);
            const end = Math.min(text.length, offset + contextLength);

            return {
                before: text.substring(start, offset),
                after: text.substring(offset, end)
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * Проверить, был ли этот текст скопирован недавно
     */
    checkRecentCopy(pastedText) {
        if (!pastedText || pastedText.length < 10) return false;

        // Проверяем последние 10 записей в истории
        const recentHistory = this.clipboardHistory.slice(-10);
        
        for (const entry of recentHistory) {
            // Проверяем точное совпадение или частичное (для больших фрагментов)
            if (entry.text === pastedText) {
                return true;
            }
            if (pastedText.includes(entry.text) || entry.text.includes(pastedText)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Рассчитать подозрительность события
     */
    calculateSuspiciousScore(eventData) {
        let score = 0;

        // Большие фрагменты кода подозрительны
        if (eventData.textLength > 200) score += 30;
        else if (eventData.textLength > 100) score += 15;
        else if (eventData.textLength > 50) score += 5;

        // Если текст был скопирован в этой сессии - менее подозрительно
        if (eventData.matchesRecentCopy) {
            score -= 10;
        }

        // Проверка на код-паттерны (функции, классы, etc.)
        const codePatterns = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /const\s+\w+\s*=/,
            /import\s+.*\s+from/,
            /\w+\.prototype/,
            /async\s+function/,
            /=>\s*{/
        ];

        let patternMatches = 0;
        for (const pattern of codePatterns) {
            if (pattern.test(eventData.textPreview)) {
                patternMatches++;
            }
        }

        if (patternMatches >= 3) {
            score += 20; // Высокая вероятность кода
        } else if (patternMatches >= 1) {
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Отправить событие обратно
     */
    emitEvent(eventData) {
        if (this.eventCallback) {
            this.eventCallback(eventData);
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            isMonitoring: this.isMonitoring,
            historySize: this.clipboardHistory.length,
            totalCopyEvents: this.clipboardHistory.length
        };
    }
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardMonitor;
}

