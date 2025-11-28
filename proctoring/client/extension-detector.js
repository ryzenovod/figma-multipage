/**
 * Extension Detector - Детектирование браузерных расширений
 * 
 * Отслеживает известные браузерные расширения, которые могут помочь в читерстве.
 * Критерий: Анализ браузерных расширений
 */

class ExtensionDetector {
    constructor(eventCallback, options = {}) {
        this.eventCallback = eventCallback;
        this.isEnabled = false;
        
        // Конфигурация
        this.config = {
            checkInterval: options.checkInterval || 2000,  // Интервал проверки
            ...options
        };
        
        // Известные расширения и их маркеры
        this.knownExtensions = {
            'grammarly': {
                name: 'Grammarly',
                domMarkers: [
                    '[data-gr-ext-installed]',
                    '#grammarly-extension',
                    '.grammarly-extension',
                    '[data-grammarly-shadow-root]'
                ],
                windowObjects: ['grammarly', '__GRAMMARLY__'],
                riskScore: 10
            },
            'google-translate': {
                name: 'Google Translate',
                domMarkers: [
                    '#gtx-trans',
                    '.goog-te-banner-frame',
                    '[id^="google_translate"]',
                    '.goog-te-combo'
                ],
                windowObjects: ['google', 'gtx'],
                riskScore: 15
            },
            'github-copilot': {
                name: 'GitHub Copilot',
                domMarkers: [],
                windowObjects: ['__GITHUB_COPILOT__'],
                scripts: ['github-copilot'],
                riskScore: 40  // Высокий риск для кодинга
            },
            'chatgpt': {
                name: 'ChatGPT Extension',
                domMarkers: [
                    '[data-chatgpt]',
                    '#chatgpt-extension'
                ],
                windowObjects: ['ChatGPT', '__CHATGPT__'],
                riskScore: 50  // Очень высокий риск
            },
            'code-completion': {
                name: 'Code Completion Extension',
                windowObjects: ['Codeium', 'Tabnine', '__CODEIUM__', '__TABNINE__'],
                riskScore: 45
            },
            'screen-capture': {
                name: 'Screen Capture',
                windowObjects: ['ScreenCapture', '__SCREEN_CAPTURE__'],
                riskScore: 20
            }
        };
        
        // Обнаруженные расширения
        this.detectedExtensions = new Set();
        
        // Таймер проверки
        this.checkTimer = null;
        
        // Биндинги
        this.checkExtensions = this.checkExtensions.bind(this);
        this.handleMutation = this.handleMutation.bind(this);
    }

    /**
     * Включить детектирование
     */
    enable() {
        if (this.isEnabled) return;
        
        // Метод 1: Периодическая проверка DOM
        this.checkTimer = setInterval(this.checkExtensions, this.config.checkInterval);
        
        // Метод 2: Наблюдение за изменениями DOM
        this.observer = new MutationObserver(this.handleMutation);
        this.observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'class', 'data-*']
        });
        
        // Метод 3: Проверка глобальных объектов
        this.checkWindowObjects();
        
        // Метод 4: Проверка инжектированных скриптов
        this.checkInjectedScripts();
        
        this.isEnabled = true;
        console.log('[ExtensionDetector] Enabled');
        
        // Первоначальная проверка
        this.checkExtensions();
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
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.isEnabled = false;
        console.log('[ExtensionDetector] Disabled');
    }

    /**
     * Метод 1: Проверка DOM на наличие маркеров расширений
     */
    checkExtensions() {
        for (const [key, ext] of Object.entries(this.knownExtensions)) {
            // Проверка DOM маркеров
            if (ext.domMarkers && ext.domMarkers.length > 0) {
                for (const marker of ext.domMarkers) {
                    try {
                        const element = document.querySelector(marker);
                        if (element) {
                            this.onExtensionDetected(key, ext, 'dom_marker', {
                                marker: marker,
                                element: element.tagName
                            });
                            break;  // Не нужно проверять другие маркеры для этого расширения
                        }
                    } catch (e) {
                        // Игнорируем ошибки селекторов
                    }
                }
            }
        }
        
        // Проверка глобальных объектов
        this.checkWindowObjects();
    }

    /**
     * Метод 2: Обработка изменений DOM
     */
    handleMutation(mutations) {
        // Проверяем новые элементы на наличие маркеров расширений
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkElementForExtensions(node);
                    }
                }
            } else if (mutation.type === 'attributes') {
                // Проверяем измененные атрибуты
                this.checkElementForExtensions(mutation.target);
            }
        }
    }

    /**
     * Проверить элемент на наличие маркеров расширений
     */
    checkElementForExtensions(element) {
        if (!element || !element.nodeType) return;
        
        for (const [key, ext] of Object.entries(this.knownExtensions)) {
            if (!ext.domMarkers) continue;
            
            for (const marker of ext.domMarkers) {
                try {
                    // Проверяем сам элемент
                    if (element.matches && element.matches(marker)) {
                        this.onExtensionDetected(key, ext, 'dom_mutation', {
                            marker: marker
                        });
                        return;
                    }
                    
                    // Проверяем потомков
                    if (element.querySelector && element.querySelector(marker)) {
                        this.onExtensionDetected(key, ext, 'dom_mutation', {
                            marker: marker
                        });
                        return;
                    }
                } catch (e) {
                    // Игнорируем ошибки
                }
            }
        }
    }

    /**
     * Метод 3: Проверка глобальных объектов window
     */
    checkWindowObjects() {
        for (const [key, ext] of Object.entries(this.knownExtensions)) {
            if (!ext.windowObjects) continue;
            
            for (const objName of ext.windowObjects) {
                // Проверяем прямые свойства window
                if (window[objName] !== undefined) {
                    this.onExtensionDetected(key, ext, 'window_object', {
                        objectName: objName
                    });
                    break;
                }
                
                // Проверяем вложенные объекты
                const parts = objName.split('.');
                let obj = window;
                let found = true;
                
                for (const part of parts) {
                    if (obj[part] === undefined) {
                        found = false;
                        break;
                    }
                    obj = obj[part];
                }
                
                if (found) {
                    this.onExtensionDetected(key, ext, 'window_object', {
                        objectName: objName
                    });
                    break;
                }
            }
        }
        
        // Проверка на общие паттерны расширений
        this.checkCommonExtensionPatterns();
    }

    /**
     * Проверка общих паттернов расширений
     */
    checkCommonExtensionPatterns() {
        // Паттерн 1: Инжектированные скрипты с data-атрибутами
        const scripts = document.querySelectorAll('script[data-extension], script[data-injected]');
        if (scripts.length > 0) {
            this.onGenericExtensionDetected('injected_script', {
                count: scripts.length
            });
        }
        
        // Паттерн 2: iframe от расширений
        const iframes = document.querySelectorAll('iframe[id^="chrome-extension"], iframe[src^="chrome-extension://"]');
        if (iframes.length > 0) {
            this.onGenericExtensionDetected('extension_iframe', {
                count: iframes.length
            });
        }
        
        // Паттерн 3: Shadow DOM от расширений
        // Сложно проверить напрямую, но можно попытаться найти элементы с shadow-root
        const allElements = document.querySelectorAll('*');
        for (const elem of allElements) {
            if (elem.shadowRoot) {
                // Проверяем, есть ли в shadow root что-то подозрительное
                const shadowContent = elem.shadowRoot.innerHTML;
                if (shadowContent.includes('extension') || 
                    shadowContent.includes('chrome-extension')) {
                    this.onGenericExtensionDetected('shadow_dom', {
                        element: elem.tagName
                    });
                    break;
                }
            }
        }
    }

    /**
     * Метод 4: Проверка инжектированных скриптов
     */
    checkInjectedScripts() {
        // Проверяем все скрипты на странице
        const scripts = document.querySelectorAll('script[src], script:not([src])');
        
        for (const script of scripts) {
            const src = script.src;
            const content = script.textContent || script.innerHTML;
            
            // Проверяем источники скриптов
            if (src) {
                if (src.includes('chrome-extension://') || 
                    src.includes('moz-extension://') ||
                    src.includes('safari-extension://')) {
                    this.onGenericExtensionDetected('script_source', {
                        src: src.substring(0, 100)
                    });
                }
            }
            
            // Проверяем содержимое скриптов на известные паттерны
            if (content) {
                for (const [key, ext] of Object.entries(this.knownExtensions)) {
                    if (ext.scripts) {
                        for (const scriptName of ext.scripts) {
                            if (content.toLowerCase().includes(scriptName.toLowerCase())) {
                                this.onExtensionDetected(key, ext, 'script_content', {
                                    scriptName: scriptName
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Обработка обнаружения конкретного расширения
     */
    onExtensionDetected(extensionKey, extensionInfo, method, details) {
        // Проверяем, не было ли уже обнаружено это расширение
        if (this.detectedExtensions.has(extensionKey)) {
            return;  // Уже детектировано
        }
        
        this.detectedExtensions.add(extensionKey);
        
        const event = {
            type: 'extension_detected',
            timestamp: Date.now(),
            extensionKey: extensionKey,
            extensionName: extensionInfo.name,
            method: method,
            details: details,
            riskScore: extensionInfo.riskScore
        };
        
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Обработка обнаружения общих паттернов расширений
     */
    onGenericExtensionDetected(method, details) {
        const event = {
            type: 'generic_extension_detected',
            timestamp: Date.now(),
            method: method,
            details: details,
            riskScore: 20  // Средний риск для неизвестных расширений
        };
        
        if (this.eventCallback) {
            this.eventCallback(event);
        }
    }

    /**
     * Получить список обнаруженных расширений
     */
    getDetectedExtensions() {
        return Array.from(this.detectedExtensions);
    }

    /**
     * Получить общий риск от расширений
     */
    getTotalRiskScore() {
        let totalRisk = 0;
        
        for (const extKey of this.detectedExtensions) {
            const ext = this.knownExtensions[extKey];
            if (ext) {
                totalRisk += ext.riskScore;
            }
        }
        
        return Math.min(totalRisk, 100);
    }

    /**
     * Сбросить список обнаруженных расширений
     */
    reset() {
        this.detectedExtensions.clear();
    }
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionDetector;
}

