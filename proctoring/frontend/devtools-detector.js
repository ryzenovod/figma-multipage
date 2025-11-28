/**
 * DevTools Detector - Детектирование консолей разработчика
 * Обнаруживает открытие DevTools различными методами
 */

class DevToolsDetector {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isMonitoring = false;
        this.devToolsOpen = false;
        this.detectionMethods = [];
        
        // Интервалы для периодических проверок
        this.intervals = [];
        
        // Биндинги
        this.checkDevTools = this.checkDevTools.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * Начать мониторинг DevTools
     */
    start() {
        if (this.isMonitoring) {
            console.warn('DevToolsDetector: уже запущен');
            return;
        }

        // Метод 1: Размер окна (DevTools меняет размеры viewport)
        this.detectByWindowSize();

        // Метод 2: Debugger detection
        this.detectByDebugger();

        // Метод 3: Console detection
        this.detectByConsole();

        // Метод 4: Focus/Blur events
        this.detectByFocus();

        // Метод 5: Performance timing
        this.detectByPerformance();

        // Метод 6: Element inspector detection
        this.detectByInspector();

        // Обработчики событий
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        this.isMonitoring = true;
        console.log('DevToolsDetector: мониторинг запущен');
    }

    /**
     * Остановить мониторинг
     */
    stop() {
        if (!this.isMonitoring) return;

        // Очистка интервалов
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];

        // Удаление обработчиков
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        this.isMonitoring = false;
        this.devToolsOpen = false;
        console.log('DevToolsDetector: мониторинг остановлен');
    }

    /**
     * Метод 1: Детектирование по изменению размеров окна
     */
    detectByWindowSize() {
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;

        const checkInterval = setInterval(() => {
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;

            // DevTools может изменить размер viewport
            if (currentWidth !== lastWidth || currentHeight !== lastHeight) {
                // Игнорируем маленькие изменения (могут быть из-за других причин)
                const widthDiff = Math.abs(currentWidth - lastWidth);
                const heightDiff = Math.abs(currentHeight - lastHeight);

                if (widthDiff > 50 || heightDiff > 50) {
                    this.emitDevToolsEvent('window_size', {
                        width: currentWidth,
                        height: currentHeight,
                        widthDiff,
                        heightDiff
                    });
                }
            }

            lastWidth = currentWidth;
            lastHeight = currentHeight;
        }, 1000);

        this.intervals.push(checkInterval);
        this.detectionMethods.push('window_size');
    }

    /**
     * Метод 2: Детектирование через debugger statement
     */
    detectByDebugger() {
        let devToolsOpen = false;

        const checkInterval = setInterval(() => {
            const start = performance.now();
            
            // Если DevTools открыт, debugger может вызвать задержку
            try {
                eval('debugger;');
            } catch (e) {
                // Игнорируем ошибки
            }
            
            const end = performance.now();
            const executionTime = end - start;

            // Если выполнение заняло много времени (>100ms), возможно DevTools открыт
            if (executionTime > 100 && !devToolsOpen) {
                devToolsOpen = true;
                this.emitDevToolsEvent('debugger', {
                    executionTime,
                    threshold: 100
                });
            } else if (executionTime < 50 && devToolsOpen) {
                devToolsOpen = false;
            }
        }, 2000);

        this.intervals.push(checkInterval);
        this.detectionMethods.push('debugger');
    }

    /**
     * Метод 3: Детектирование через перехват console
     */
    detectByConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;

        let consoleUsed = false;
        let consoleUsedTime = null;

        // Перехватываем вызовы console
        console.log = function(...args) {
            consoleUsed = true;
            consoleUsedTime = Date.now();
            originalLog.apply(console, args);
        };

        console.error = function(...args) {
            consoleUsed = true;
            consoleUsedTime = Date.now();
            originalError.apply(console, args);
        };

        console.warn = function(...args) {
            consoleUsed = true;
            consoleUsedTime = Date.now();
            originalWarn.apply(console, args);
        };

        console.info = function(...args) {
            consoleUsed = true;
            consoleUsedTime = Date.now();
            originalInfo.apply(console, args);
        };

        // Проверяем использование console
        const checkInterval = setInterval(() => {
            if (consoleUsed && consoleUsedTime) {
                const timeSinceLastUse = Date.now() - consoleUsedTime;
                // Если console использовался недавно (в течение 5 секунд), возможно DevTools открыт
                if (timeSinceLastUse < 5000) {
                    this.emitDevToolsEvent('console_usage', {
                        timeSinceLastUse
                    });
                }
            }
        }, 3000);

        this.intervals.push(checkInterval);
        this.detectionMethods.push('console');
    }

    /**
     * Метод 4: Детектирование по потере фокуса
     */
    detectByFocus() {
        let blurTime = null;

        window.addEventListener('blur', () => {
            blurTime = Date.now();
        });

        window.addEventListener('focus', () => {
            if (blurTime) {
                const blurDuration = Date.now() - blurTime;
                // Если окно было не в фокусе менее 2 секунд, возможно открыли DevTools
                if (blurDuration < 2000 && blurDuration > 100) {
                    this.emitDevToolsEvent('focus_blur', {
                        blurDuration
                    });
                }
                blurTime = null;
            }
        });
    }

    /**
     * Метод 5: Детектирование через производительность
     */
    detectByPerformance() {
        const checkInterval = setInterval(() => {
            // DevTools может влиять на производительность
            const start = performance.now();
            
            // Выполняем простую операцию
            for (let i = 0; i < 1000; i++) {
                Math.random();
            }
            
            const end = performance.now();
            const executionTime = end - start;

            // Если выполнение замедлено, возможно DevTools открыт
            if (executionTime > 1) { // Нормально < 0.5ms
                this.emitDevToolsEvent('performance', {
                    executionTime,
                    threshold: 1
                });
            }
        }, 5000);

        this.intervals.push(checkInterval);
        this.detectionMethods.push('performance');
    }

    /**
     * Метод 6: Детектирование inspector через DOM элементы
     */
    detectByInspector() {
        // DevTools может оставлять следы в DOM
        const checkInterval = setInterval(() => {
            // Проверяем наличие элементов, связанных с DevTools
            const devtoolsElements = document.querySelectorAll('[id*="devtools"], [class*="devtools"]');
            
            if (devtoolsElements.length > 0) {
                this.emitDevToolsEvent('dom_inspector', {
                    elementsFound: devtoolsElements.length
                });
            }

            // Проверяем, не установлен ли обработчик на element selection
            // (это сложно, но можно попробовать через MutationObserver)
        }, 3000);

        this.intervals.push(checkInterval);
        this.detectionMethods.push('inspector');
    }

    /**
     * Обработчик изменения размера окна
     */
    handleResize() {
        // Дополнительная проверка при явном resize
        setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Если размеры нестандартные (например, слишком узкое окно),
            // возможно открыт DevTools
            if (width < 800) {
                this.emitDevToolsEvent('window_size', {
                    width,
                    height,
                    note: 'Нестандартно узкое окно'
                });
            }
        }, 500);
    }

    /**
     * Обработчик изменения видимости
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Страница скрыта - возможно открыли DevTools в отдельном окне
            this.emitDevToolsEvent('visibility', {
                hidden: true
            });
        }
    }

    /**
     * Отправить событие об обнаружении DevTools
     */
    emitDevToolsEvent(method, details = {}) {
        if (!this.devToolsOpen) {
            this.devToolsOpen = true;
            
            const eventData = {
                type: 'devtools_detected',
                timestamp: Date.now(),
                method: method,
                details: details,
                detectionMethods: this.detectionMethods
            };

            if (this.eventCallback) {
                this.eventCallback(eventData);
            }
        }
    }

    /**
     * Проверить статус DevTools (ручная проверка)
     */
    checkDevTools() {
        // Комплексная проверка всех методов
        const checks = {
            windowSize: window.innerWidth < 1000 || window.innerHeight < 600,
            performance: this.quickPerformanceCheck(),
            debugger: this.quickDebuggerCheck()
        };

        if (checks.windowSize || checks.performance || checks.debugger) {
            this.emitDevToolsEvent('manual_check', checks);
        }

        return checks;
    }

    /**
     * Быстрая проверка производительности
     */
    quickPerformanceCheck() {
        const start = performance.now();
        for (let i = 0; i < 100; i++) Math.random();
        const end = performance.now();
        return (end - start) > 0.1;
    }

    /**
     * Быстрая проверка через debugger
     */
    quickDebuggerCheck() {
        try {
            const start = performance.now();
            eval('debugger;');
            const end = performance.now();
            return (end - start) > 50;
        } catch (e) {
            return false;
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            isMonitoring: this.isMonitoring,
            devToolsOpen: this.devToolsOpen,
            detectionMethods: this.detectionMethods
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevToolsDetector;
}

