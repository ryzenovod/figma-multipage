/**
 * DevTools Detector - Детектирование консоли разработчика
 * 
 * Отслеживает открытие консоли разработчика (DevTools).
 * Критерий: Анализ консолей
 */

class DevToolsDetector {
    constructor(eventCallback, options = {}) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        
        // Конфигурация
        this.config = {
            checkInterval: options.checkInterval || 1000,  // Интервал проверки в мс
            debuggerCheckInterval: options.debuggerCheckInterval || 3000,  // Интервал debugger проверки
            threshold: options.threshold || 160,  // Порог изменения размера окна
            ...options
        };
        
        // Состояние
        this.isDevToolsOpen = false;
        this.lastWindowSize = { width: 0, height: 0 };
        this.lastCheckTime = 0;
        
        // Таймеры
        this.checkTimer = null;
        this.debuggerTimer = null;
        
        // Методы
        this.checkDevTools = this.checkDevTools.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.runDebuggerCheck = this.runDebuggerCheck.bind(this);
    }

    /**
     * Включить детектирование
     */
    enable() {
        if (this.isEnabled) return;
        
        // Инициализация размера окна
        this.lastWindowSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Метод 1: Периодическая проверка через размер окна
        this.checkTimer = setInterval(this.checkDevTools, this.config.checkInterval);
        
        // Метод 2: Проверка через debugger
        this.debuggerTimer = setInterval(this.runDebuggerCheck, this.config.debuggerCheckInterval);
        
        // Метод 3: Отслеживание изменения размера окна
        window.addEventListener('resize', this.handleResize);
        
        // Метод 4: Отслеживание горячих клавиш
        document.addEventListener('keydown', this.handleKeyDown, true);
        
        // Метод 5: Отслеживание фокуса
        window.addEventListener('focus', this.handleFocus);
        window.addEventListener('blur', this.handleBlur);
        
        // Метод 6: Перехват console
        this.interceptConsole();
        
        // Метод 7: Проверка через devtools-detect библиотеку (если доступна)
        if (typeof devtools !== 'undefined') {
            devtools.on('change', (isOpen) => {
                this.onDevToolsDetected(isOpen, 'library');
            });
        }
        
        this.isEnabled = true;
        console.log('[DevToolsDetector] Enabled');
        
        // Первоначальная проверка
        this.checkDevTools();
    }

    /**
     * Выключить детектирование
     */
    disable() {
        if (!this.isEnabled) return;
        
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        
        if (this.debuggerTimer) {
            clearInterval(this.debuggerTimer);
            this.debuggerTimer = null;
        }
        
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        window.removeEventListener('focus', this.handleFocus);
        window.removeEventListener('blur', this.handleBlur);
        
        this.restoreConsole();
        
        this.isEnabled = false;
        console.log('[DevToolsDetector] Disabled');
    }

    /**
     * Метод 1: Проверка через изменение размера окна
     */
    checkDevTools() {
        const currentSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        const widthDiff = Math.abs(currentSize.width - this.lastWindowSize.width);
        const heightDiff = Math.abs(currentSize.height - this.lastWindowSize.height);
        
        // DevTools обычно открывается сбоку (изменяет width) или снизу (изменяет height)
        const significantChange = widthDiff > this.config.threshold || 
                                  heightDiff > this.config.threshold;
        
        if (significantChange) {
            const isLikelyOpen = this.isLikelyDevToolsOpen(currentSize);
            if (isLikelyOpen && !this.isDevToolsOpen) {
                this.onDevToolsDetected(true, 'window_size');
            } else if (!isLikelyOpen && this.isDevToolsOpen) {
                this.onDevToolsDetected(false, 'window_size');
            }
        }
        
        this.lastWindowSize = currentSize;
    }

    /**
     * Определить, вероятно ли открыт DevTools по размеру окна
     */
    isLikelyDevToolsOpen(size) {
        // Если окно стало значительно уже или ниже - вероятно открыт DevTools
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        // DevTools обычно занимает ~30-50% от экрана
        const narrowRatio = size.width / screenWidth;
        const shortRatio = size.height / screenHeight;
        
        // Если окно сузилось более чем на 25% или уменьшилось по высоте
        return narrowRatio < 0.75 || shortRatio < 0.75;
    }

    /**
     * Метод 2: Проверка через debugger trap
     */
    runDebuggerCheck() {
        const startTime = performance.now();
        
        try {
            // Если DevTools открыт, debugger приостановит выполнение
            eval('debugger;');
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Если выполнение заняло много времени (>50мс), вероятно DevTools открыт
            if (duration > 50 && !this.isDevToolsOpen) {
                this.onDevToolsDetected(true, 'debugger');
            }
        } catch (e) {
            // Игнорируем ошибки
        }
    }

    /**
     * Метод 3: Обработка изменения размера
     */
    handleResize() {
        // Проверяем немедленно при resize
        setTimeout(() => {
            this.checkDevTools();
        }, 100);
    }

    /**
     * Метод 4: Отслеживание горячих клавиш для открытия DevTools
     */
    handleKeyDown(event) {
        const key = event.key || event.keyCode;
        const isF12 = key === 'F12' || key === 123;
        const isCtrlShiftI = (event.ctrlKey || event.metaKey) && 
                             event.shiftKey && 
                             (key === 'I' || key === 73);
        const isCtrlShiftJ = (event.ctrlKey || event.metaKey) && 
                             event.shiftKey && 
                             (key === 'J' || key === 74);
        const isCtrlShiftC = (event.ctrlKey || event.metaKey) && 
                             event.shiftKey && 
                             (key === 'C' || key === 67);
        const isCtrlU = (event.ctrlKey || event.metaKey) && 
                       (key === 'U' || key === 85);
        
        if (isF12 || isCtrlShiftI || isCtrlShiftJ || isCtrlShiftC) {
            // Предупреждение о попытке открыть DevTools
            this.onDevToolsShortcutPressed({
                key: key,
                combination: this.getKeyCombination(event)
            });
            
            // Небольшая задержка и проверка
            setTimeout(() => {
                this.checkDevTools();
            }, 500);
        }
        
        if (isCtrlU) {
            // Попытка посмотреть исходный код
            this.onSuspiciousAction('view_source', {
                key: 'Ctrl+U',
                timestamp: Date.now()
            });
        }
    }

    /**
     * Получить комбинацию клавиш
     */
    getKeyCombination(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.metaKey) parts.push('Cmd');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        parts.push(event.key || 'Key');
        return parts.join('+');
    }

    /**
     * Метод 5: Обработка потери фокуса
     */
    handleBlur() {
        // Потеря фокуса может указывать на открытие DevTools
        setTimeout(() => {
            if (document.hidden) {
                // Страница скрыта - это не DevTools, а смена вкладки
                return;
            }
            // Проверяем размер окна
            this.checkDevTools();
        }, 200);
    }

    /**
     * Метод 5: Обработка получения фокуса
     */
    handleFocus() {
        // При возврате фокуса проверяем размер окна
        setTimeout(() => {
            this.checkDevTools();
        }, 200);
    }

    /**
     * Метод 6: Перехват console методов
     */
    interceptConsole() {
        if (this.originalConsole) return;  // Уже перехвачено
        
        // Сохраняем оригинальные методы
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        // Перехватываем console.log
        console.log = (...args) => {
            this.onConsoleUsed('log');
            return this.originalConsole.log.apply(console, args);
        };
        
        console.error = (...args) => {
            this.onConsoleUsed('error');
            return this.originalConsole.error.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.onConsoleUsed('warn');
            return this.originalConsole.warn.apply(console, args);
        };
    }

    /**
     * Восстановить оригинальный console
     */
    restoreConsole() {
        if (!this.originalConsole) return;
        
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
        
        this.originalConsole = null;
    }

    /**
     * Обработка обнаружения DevTools
     */
    onDevToolsDetected(isOpen, method) {
        if (this.isDevToolsOpen === isOpen) {
            return;  // Состояние не изменилось
        }
        
        this.isDevToolsOpen = isOpen;
        
        const event = {
            type: 'devtools_detected',
            timestamp: Date.now(),
            isOpen: isOpen,
            method: method,
            windowSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            riskScore: isOpen ? 30 : 0  // Высокий риск при открытии
        };
        
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Обработка нажатия горячих клавиш для DevTools
     */
    onDevToolsShortcutPressed(data) {
        const event = {
            type: 'devtools_shortcut',
            timestamp: Date.now(),
            key: data.key,
            combination: data.combination,
            riskScore: 25  // Средний-высокий риск
        };
        
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Обработка использования console
     */
    onConsoleUsed(method) {
        // Использование console само по себе не критично
        // Но если используется часто - может быть подозрительно
        // Здесь просто логируем, не повышая риск
    }

    /**
     * Обработка подозрительных действий
     */
    onSuspiciousAction(action, data) {
        const event = {
            type: 'suspicious_action',
            timestamp: Date.now(),
            action: action,
            data: data,
            riskScore: 15
        };
        
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Проверить состояние DevTools (синхронно)
     */
    checkState() {
        return {
            isOpen: this.isDevToolsOpen,
            windowSize: this.lastWindowSize,
            enabled: this.isEnabled
        };
    }
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevToolsDetector;
}

