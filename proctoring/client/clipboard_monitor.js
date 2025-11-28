/**
 * Clipboard Monitoring Module
 * Отслеживает операции копирования и вставки кода
 */
class ClipboardMonitor {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        this.pasteHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Включить мониторинг буфера обмена
     */
    enable() {
        if (this.isEnabled) return;
        
        // Отслеживание событий paste
        document.addEventListener('paste', this.handlePaste.bind(this), true);
        
        // Отслеживание событий copy
        document.addEventListener('copy', this.handleCopy.bind(this), true);
        
        // Отслеживание событий cut
        document.addEventListener('cut', this.handleCut.bind(this), true);
        
        this.isEnabled = true;
        console.log('[ClipboardMonitor] Enabled');
    }

    /**
     * Выключить мониторинг
     */
    disable() {
        if (!this.isEnabled) return;
        
        document.removeEventListener('paste', this.handlePaste.bind(this), true);
        document.removeEventListener('copy', this.handleCopy.bind(this), true);
        document.removeEventListener('cut', this.handleCut.bind(this), true);
        
        this.isEnabled = false;
        console.log('[ClipboardMonitor] Disabled');
    }

    /**
     * Обработка события вставки (paste)
     */
    async handlePaste(event) {
        try {
            const clipboardData = event.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text/plain');
            
            if (!pastedText || pastedText.length === 0) return;
            
            // Получаем контекст вставки
            const context = this.getInsertionContext(event.target);
            
            // Создаем событие прокторинга
            const proctoringEvent = {
                type: 'clipboard_paste',
                timestamp: Date.now(),
                textLength: pastedText.length,
                textPreview: this.getTextPreview(pastedText, 200),
                lineCount: pastedText.split('\n').length,
                context: context,
                metadata: {
                    hasCodeStructure: this.detectCodeStructure(pastedText),
                    containsComments: pastedText.includes('//') || pastedText.includes('/*'),
                    likelyPasted: this.isLikelyPasted(pastedText)
                }
            };
            
            // Сохраняем в историю
            this.pasteHistory.push({
                timestamp: proctoringEvent.timestamp,
                length: pastedText.length,
                preview: proctoringEvent.textPreview
            });
            
            if (this.pasteHistory.length > this.maxHistorySize) {
                this.pasteHistory.shift();
            }
            
            // Отправляем событие
            this.eventCallback(proctoringEvent);
            
        } catch (error) {
            console.error('[ClipboardMonitor] Error handling paste:', error);
        }
    }

    /**
     * Обработка события копирования (copy)
     */
    handleCopy(event) {
        try {
            const selection = window.getSelection();
            const copiedText = selection.toString();
            
            if (!copiedText || copiedText.length === 0) return;
            
            const proctoringEvent = {
                type: 'clipboard_copy',
                timestamp: Date.now(),
                textLength: copiedText.length,
                textPreview: this.getTextPreview(copiedText, 100),
                context: this.getSelectionContext(selection)
            };
            
            this.eventCallback(proctoringEvent);
            
        } catch (error) {
            console.error('[ClipboardMonitor] Error handling copy:', error);
        }
    }

    /**
     * Обработка события вырезания (cut)
     */
    handleCut(event) {
        try {
            const selection = window.getSelection();
            const cutText = selection.toString();
            
            if (!cutText || cutText.length === 0) return;
            
            const proctoringEvent = {
                type: 'clipboard_cut',
                timestamp: Date.now(),
                textLength: cutText.length,
                textPreview: this.getTextPreview(cutText, 100)
            };
            
            this.eventCallback(proctoringEvent);
            
        } catch (error) {
            console.error('[ClipboardMonitor] Error handling cut:', error);
        }
    }

    /**
     * Получить контекст вставки
     */
    getInsertionContext(element) {
        try {
            // Для Monaco Editor или CodeMirror
            if (element.classList && element.classList.contains('monaco-editor')) {
                return {
                    editor: 'monaco',
                    // Можно получить позицию курсора через API редактора
                };
            }
            
            return {
                tagName: element.tagName,
                className: element.className || '',
                id: element.id || ''
            };
        } catch (error) {
            return { error: 'Unable to get context' };
        }
    }

    /**
     * Получить контекст выделения
     */
    getSelectionContext(selection) {
        try {
            const range = selection.getRangeAt(0);
            return {
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                commonAncestor: range.commonAncestorContainer?.nodeName || 'unknown'
            };
        } catch (error) {
            return {};
        }
    }

    /**
     * Получить превью текста
     */
    getTextPreview(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Определить структуру кода во вставленном тексте
     */
    detectCodeStructure(text) {
        const codeIndicators = [
            /\bfunction\s+\w+\s*\(/,
            /\bclass\s+\w+/,
            /\bdef\s+\w+\s*\(/,
            /^\s*import\s+.*from/,
            /^\s*const\s+\w+\s*=/,
            /^\s*let\s+\w+\s*=/,
            /^\s*var\s+\w+\s*=/
        ];
        
        return codeIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Определить, похоже ли на вставленный код (большой объем, структурированный)
     */
    isLikelyPasted(text) {
        const lines = text.split('\n');
        const minSuspiciousLength = 50;
        const minSuspiciousLines = 3;
        
        return (
            text.length > minSuspiciousLength &&
            lines.length >= minSuspiciousLines &&
            this.detectCodeStructure(text)
        );
    }

    /**
     * Получить статистику вставок
     */
    getStatistics() {
        const now = Date.now();
        const lastMinute = this.pasteHistory.filter(
            h => now - h.timestamp < 60000
        );
        
        return {
            totalPastes: this.pasteHistory.length,
            pastesLastMinute: lastMinute.length,
            totalPastedChars: lastMinute.reduce((sum, h) => sum + h.length, 0),
            averagePasteSize: lastMinute.length > 0
                ? lastMinute.reduce((sum, h) => sum + h.length, 0) / lastMinute.length
                : 0
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardMonitor;
}

