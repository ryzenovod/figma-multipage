/**
 * DevTools Detection Module
 * Детектирует открытие консоли разработчика
 */
class DevToolsDetector {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        this.checkInterval = null;
        this.detectionMethods = {
            windowSize: true,
            debugger: true,
            console: true,
            focus: true
        };
        this.lastWindowSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        this.devToolsOpen = false;
        this.detectionHistory = [];
    }

    /**
     * Включить детектирование DevTools
     */
    enable() {
        if (this.isEnabled) return;
        
        // Метод 1: Размер окна
        if (this.detectionMethods.windowSize) {
            window.addEventListener('resize', this.handleResize.bind(this));
        }
        
        // Метод 2: Debugger detection
        if (this.detectionMethods.debugger) {
            this.startDebuggerCheck();
        }
        
        // Метод 3: Console detection
        if (this.detectionMethods.console) {
            this.interceptConsole();
        }
        
        // Метод 4: Focus/Blur
        if (this.detectionMethods.focus) {
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
            window.addEventListener('blur', this.handleBlur.bind(this));
            window.addEventListener('focus', this.handleFocus.bind(this));
        }
        
        // Метод 5: DevTools key shortcuts
        this.interceptKeyboardShortcuts();
        
        // Периодическая проверка
        this.checkInterval = setInterval(() => {
            this.performPeriodicCheck();
        }, 1000); // Проверка каждую секунду
        
        this.isEnabled = true;
        console.log('[DevToolsDetector] Enabled');
    }

    /**
     * Выключить детектирование
     */
    disable() {
        if (!this.isEnabled) return;
        
        window.removeEventListener('resize', this.handleResize.bind(this));
        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        window.removeEventListener('blur', this.handleBlur.bind(this));
        window.removeEventListener('focus', this.handleFocus.bind(this));
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.isEnabled = false;
        console.log('[DevToolsDetector] Disabled');
    }

    /**
     * Обработка изменения размера окна
     */
    handleResize() {
        const currentSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        const sizeDiff = Math.abs(currentSize.width - this.lastWindowSize.width) +
                        Math.abs(currentSize.height - this.lastWindowSize.height);
        
        // Значительное изменение размера может означать открытие DevTools
        if (sizeDiff > 100) {
            this.reportDetection('window_size', {
                previousSize: this.lastWindowSize,
                currentSize: currentSize,
                difference: sizeDiff
            });
        }
        
        this.lastWindowSize = currentSize;
    }

    /**
     * Проверка через debugger
     */
    startDebuggerCheck() {
        let devtools = false;
        const element = new Image();
        
        Object.defineProperty(element, 'id', {
            get: function() {
                devtools = true;
                this.triggerDetection('debugger', {
                    method: 'image_id_getter'
                });
            }.bind(this)
        });
        
        setInterval(() => {
            devtools = false;
            console.log(element);
            if (devtools) {
                this.reportDetection('debugger', {
                    method: 'image_id_getter'
                });
            }
        }, 2000);
    }

    /**
     * Перехват console методов
     */
    interceptConsole() {
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };
        
        const self = this;
        ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
            console[method] = function(...args) {
                // DevTools открыт, если эта функция вызвана
                self.reportDetection('console_access', {
                    method: method,
                    argsCount: args.length
                });
                originalConsole[method].apply(console, args);
            };
        });
    }

    /**
     * Обработка изменения видимости страницы
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.reportDetection('visibility_hidden', {
                timestamp: Date.now()
            });
        }
    }

    /**
     * Обработка потери фокуса
     */
    handleBlur() {
        this.reportDetection('window_blur', {
            timestamp: Date.now()
        });
    }

    /**
     * Обработка получения фокуса
     */
    handleFocus() {
        // Фокус восстановлен
    }

    /**
     * Перехват горячих клавиш для DevTools
     */
    interceptKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // F12
            if (event.keyCode === 123) {
                event.preventDefault();
                this.reportDetection('f12_pressed', {
                    timestamp: Date.now()
                });
                return false;
            }
            
            // Ctrl+Shift+I (Windows/Linux) или Cmd+Option+I (Mac)
            if (
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey &&
                event.keyCode === 73 // 'I'
            ) {
                event.preventDefault();
                this.reportDetection('devtools_shortcut', {
                    shortcut: 'Ctrl+Shift+I',
                    timestamp: Date.now()
                });
                return false;
            }
            
            // Ctrl+Shift+C (Element Inspector)
            if (
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey &&
                event.keyCode === 67 // 'C'
            ) {
                event.preventDefault();
                this.reportDetection('devtools_shortcut', {
                    shortcut: 'Ctrl+Shift+C',
                    timestamp: Date.now()
                });
                return false;
            }
            
            // Ctrl+U (View Source)
            if (
                (event.ctrlKey || event.metaKey) &&
                event.keyCode === 85 // 'U'
            ) {
                event.preventDefault();
                this.reportDetection('view_source_shortcut', {
                    shortcut: 'Ctrl+U',
                    timestamp: Date.now()
                });
                return false;
            }
        }, true);
    }

    /**
     * Периодическая проверка
     */
    performPeriodicCheck() {
        // Проверка через размер экрана
        const screenRatio = window.outerWidth / window.innerWidth;
        if (screenRatio > 1.1) {
            this.reportDetection('window_ratio', {
                ratio: screenRatio,
                outerWidth: window.outerWidth,
                innerWidth: window.innerWidth
            });
        }
    }

    /**
     * Сообщить о детектировании
     */
    reportDetection(method, metadata = {}) {
        if (this.devToolsOpen) return; // Уже зафиксировано
        
        const event = {
            type: 'devtools_detected',
            timestamp: Date.now(),
            method: method,
            metadata: metadata
        };
        
        this.detectionHistory.push(event);
        this.devToolsOpen = true;
        
        // Отправляем событие
        this.eventCallback(event);
        
        // Сброс флага через 5 секунд (DevTools мог закрыться)
        setTimeout(() => {
            this.devToolsOpen = false;
        }, 5000);
    }

    /**
     * Получить статистику детектирований
     */
    getStatistics() {
        const now = Date.now();
        const lastMinute = this.detectionHistory.filter(
            e => now - e.timestamp < 60000
        );
        
        return {
            totalDetections: this.detectionHistory.length,
            detectionsLastMinute: lastMinute.length,
            methods: lastMinute.reduce((acc, e) => {
                acc[e.method] = (acc[e.method] || 0) + 1;
                return acc;
            }, {}),
            currentlyOpen: this.devToolsOpen
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevToolsDetector;
}

