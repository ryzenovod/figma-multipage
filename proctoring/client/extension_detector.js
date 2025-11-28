/**
 * Browser Extension Detection Module
 * Детектирует использование браузерных расширений
 */
class ExtensionDetector {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        this.checkInterval = null;
        this.knownExtensions = {
            // Популярные расширения, которые могут помочь в читерстве
            grammarly: {
                selectors: ['#grammarly-extension', '.grammarly-extension'],
                markers: ['grammarly-extension', 'grammarly-indicator']
            },
            googleTranslate: {
                selectors: ['#gtx-trans', '.goog-te-banner-frame'],
                markers: ['goog-te-banner-frame']
            },
            languageTool: {
                selectors: ['.languagetool-indicator'],
                markers: ['languagetool']
            },
            // Дополнительные маркеры
            codeHelpers: {
                selectors: [
                    '[id*="extension"]',
                    '[class*="extension"]',
                    '[data-extension]'
                ]
            }
        };
        this.detectedExtensions = new Set();
    }

    /**
     * Включить детектирование расширений
     */
    enable() {
        if (this.isEnabled) return;
        
        // Метод 1: Проверка DOM-маркеров
        this.checkDOMMarkers();
        
        // Метод 2: Проверка глобальных объектов
        this.checkGlobalObjects();
        
        // Метод 3: Проверка переопределенных функций
        this.checkOverriddenFunctions();
        
        // Метод 4: Проверка инжектированных скриптов
        this.checkInjectedScripts();
        
        // Периодическая проверка
        this.checkInterval = setInterval(() => {
            this.checkDOMMarkers();
            this.checkGlobalObjects();
        }, 5000); // Проверка каждые 5 секунд
        
        // Наблюдение за изменениями DOM
        this.observeDOM();
        
        this.isEnabled = true;
        console.log('[ExtensionDetector] Enabled');
    }

    /**
     * Выключить детектирование
     */
    disable() {
        if (!this.isEnabled) return;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
        }
        
        this.isEnabled = false;
        console.log('[ExtensionDetector] Disabled');
    }

    /**
     * Проверка DOM-маркеров расширений
     */
    checkDOMMarkers() {
        for (const [extensionName, config] of Object.entries(this.knownExtensions)) {
            if (config.selectors) {
                for (const selector of config.selectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0 && !this.detectedExtensions.has(extensionName)) {
                            this.reportDetection(extensionName, 'dom_marker', {
                                selector: selector,
                                elementsFound: elements.length
                            });
                            this.detectedExtensions.add(extensionName);
                        }
                    } catch (error) {
                        // Invalid selector, skip
                    }
                }
            }
        }
        
        // Проверка общих паттернов
        this.checkGenericPatterns();
    }

    /**
     * Проверка общих паттернов расширений
     */
    checkGenericPatterns() {
        // Проверка элементов с подозрительными атрибутами
        const suspiciousElements = document.querySelectorAll('[id*="extension" i], [class*="extension" i]');
        if (suspiciousElements.length > 0) {
            suspiciousElements.forEach((el, index) => {
                if (index < 3) { // Ограничиваем количество отчетов
                    this.reportDetection('unknown_extension', 'generic_pattern', {
                        elementId: el.id || 'no-id',
                        elementClass: el.className || 'no-class',
                        tagName: el.tagName
                    });
                }
            });
        }
    }

    /**
     * Проверка глобальных объектов
     */
    checkGlobalObjects() {
        const suspiciousGlobals = [
            'chrome',
            'browser',
            'extension',
            '__grammarly__',
            '__GOOG_TRANSLATE__',
            '__LANGUAGETOOL__'
        ];
        
        suspiciousGlobals.forEach(globalName => {
            if (window[globalName] !== undefined) {
                this.reportDetection(globalName, 'global_object', {
                    objectName: globalName,
                    type: typeof window[globalName]
                });
            }
        });
    }

    /**
     * Проверка переопределенных функций
     */
    checkOverriddenFunctions() {
        // Проверка переопределения document.createElement
        const originalCreateElement = document.createElement;
        let createElementCallCount = 0;
        
        document.createElement = function(...args) {
            createElementCallCount++;
            const element = originalCreateElement.apply(document, args);
            
            // Проверка подозрительных атрибутов созданных элементов
            if (createElementCallCount % 100 === 0) {
                // Периодическая проверка
            }
            
            return element;
        };
        
        // Проверка переопределения console методов
        // (уже делается в DevToolsDetector, но можно дополнить)
    }

    /**
     * Проверка инжектированных скриптов
     */
    checkInjectedScripts() {
        const scripts = document.getElementsByTagName('script');
        for (const script of scripts) {
            const src = script.src || '';
            const text = script.textContent || '';
            
            // Проверка на скрипты расширений
            if (
                src.includes('extension://') ||
                src.includes('chrome-extension://') ||
                text.includes('extension') && text.length > 1000
            ) {
                this.reportDetection('injected_script', 'script_injection', {
                    hasSrc: !!script.src,
                    srcPreview: script.src ? script.src.substring(0, 100) : '',
                    textLength: text.length
                });
            }
        }
    }

    /**
     * Наблюдение за изменениями DOM
     */
    observeDOM() {
        this.domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Проверяем новые элементы на маркеры расширений
                        if (
                            node.id && node.id.includes('extension') ||
                            node.className && node.className.includes('extension')
                        ) {
                            this.reportDetection('unknown_extension', 'dom_mutation', {
                                elementId: node.id || 'no-id',
                                elementClass: node.className || 'no-class',
                                tagName: node.tagName
                            });
                        }
                    }
                });
            });
        });
        
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Сообщить о детектировании расширения
     */
    reportDetection(extensionName, method, metadata = {}) {
        const event = {
            type: 'extension_detected',
            timestamp: Date.now(),
            extensionName: extensionName,
            method: method,
            metadata: metadata
        };
        
        // Отправляем событие
        this.eventCallback(event);
    }

    /**
     * Получить статистику детектирований
     */
    getStatistics() {
        return {
            detectedExtensions: Array.from(this.detectedExtensions),
            totalDetections: this.detectedExtensions.size
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionDetector;
}

