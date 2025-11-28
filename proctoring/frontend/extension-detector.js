/**
 * Extension Detector - Анализ браузерных расширений
 * Обнаруживает наличие и активность браузерных расширений
 */

class ExtensionDetector {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.isMonitoring = false;
        this.detectedExtensions = [];
        
        // Известные расширения, которые могут помочь в читерстве
        this.suspiciousExtensions = [
            'grammarly',      // Может помогать с кодом
            'language-tools', // Помощь с языком
            'code-assistant', // Помощь с кодом
            'github-copilot', // ИИ-помощник для кода
            'tabnine',        // Автодополнение кода
            'codota',         // Помощь с кодом
        ];

        // DOM-маркеры расширений
        this.extensionMarkers = {
            'grammarly': [
                '[data-gr-ext-installed]',
                '.gr_',
                '#grammarly-extension'
            ],
            'language-tools': [
                '[data-lt-installed]',
                '.lt-'
            ]
        };
    }

    /**
     * Начать мониторинг расширений
     */
    start() {
        if (this.isMonitoring) {
            console.warn('ExtensionDetector: уже запущен');
            return;
        }

        // Метод 1: Проверка DOM-маркеров
        this.detectByDOMMarkers();

        // Метод 2: Проверка глобальных объектов
        this.detectByGlobalObjects();

        // Метод 3: Проверка инжектированных скриптов
        this.detectByInjectedScripts();

        // Метод 4: Проверка переопределенных функций
        this.detectByFunctionOverrides();

        // Метод 5: Проверка через MutationObserver
        this.detectByDOMChanges();

        // Периодическая проверка
        const checkInterval = setInterval(() => {
            this.runAllChecks();
        }, 5000);

        this.intervals = [checkInterval];
        this.isMonitoring = true;
        console.log('ExtensionDetector: мониторинг запущен');
    }

    /**
     * Остановить мониторинг
     */
    stop() {
        if (!this.isMonitoring) return;

        if (this.intervals) {
            this.intervals.forEach(interval => clearInterval(interval));
        }

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        this.isMonitoring = false;
        console.log('ExtensionDetector: мониторинг остановлен');
    }

    /**
     * Метод 1: Детектирование по DOM-маркерам
     */
    detectByDOMMarkers() {
        for (const [extensionName, markers] of Object.entries(this.extensionMarkers)) {
            for (const marker of markers) {
                try {
                    const elements = document.querySelectorAll(marker);
                    if (elements.length > 0) {
                        this.reportExtension(extensionName, 'dom_marker', {
                            marker: marker,
                            elementsCount: elements.length
                        });
                    }
                } catch (e) {
                    // Игнорируем ошибки селекторов
                }
            }
        }

        // Проверка атрибутов документа
        if (document.documentElement.hasAttribute('data-gr-ext-installed')) {
            this.reportExtension('grammarly', 'document_attribute', {
                attribute: 'data-gr-ext-installed'
            });
        }
    }

    /**
     * Метод 2: Детектирование по глобальным объектам
     */
    detectByGlobalObjects() {
        // Расширения часто добавляют объекты в window
        const suspiciousObjects = [
            'grammarly',
            'lt',
            'copilot',
            'tabnine',
            '__GR',
            '__LANG_TOOLS'
        ];

        for (const objName of suspiciousObjects) {
            if (window[objName] !== undefined) {
                const objType = typeof window[objName];
                this.reportExtension(objName, 'global_object', {
                    type: objType,
                    value: this.safeStringify(window[objName])
                });
            }
        }

        // Проверка вложенных объектов
        if (window.chrome && window.chrome.runtime) {
            // Chrome extensions API доступен
            this.reportExtension('chrome_extension_api', 'global_object', {
                note: 'Chrome Extensions API доступен'
            });
        }
    }

    /**
     * Метод 3: Детектирование инжектированных скриптов
     */
    detectByInjectedScripts() {
        const scripts = document.querySelectorAll('script[src]');
        
        for (const script of scripts) {
            const src = script.src;
            
            // Проверяем URL на признаки расширений
            if (src.startsWith('chrome-extension://') || 
                src.startsWith('moz-extension://') ||
                src.startsWith('safari-extension://')) {
                
                const extensionId = this.extractExtensionId(src);
                this.reportExtension(extensionId || 'unknown', 'injected_script', {
                    src: src,
                    type: this.getExtensionType(src)
                });
            }

            // Проверяем inline скрипты на признаки расширений
            if (script.textContent) {
                const content = script.textContent.toLowerCase();
                for (const extName of this.suspiciousExtensions) {
                    if (content.includes(extName)) {
                        this.reportExtension(extName, 'inline_script', {
                            contentPreview: content.substring(0, 100)
                        });
                    }
                }
            }
        }
    }

    /**
     * Метод 4: Детектирование переопределенных функций
     */
    detectByFunctionOverrides() {
        // Расширения могут переопределять функции для перехвата
        const functionsToCheck = [
            'getSelection',
            'execCommand',
            'addEventListener'
        ];

        for (const funcName of functionsToCheck) {
            const originalFunc = window[funcName];
            if (originalFunc) {
                // Проверяем, не была ли функция переопределена
                const funcString = originalFunc.toString();
                
                // Если функция содержит код расширений, подозрительно
                for (const extName of this.suspiciousExtensions) {
                    if (funcString.toLowerCase().includes(extName)) {
                        this.reportExtension(extName, 'function_override', {
                            function: funcName
                        });
                    }
                }
            }
        }
    }

    /**
     * Метод 5: Детектирование через MutationObserver
     */
    detectByDOMChanges() {
        this.mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Проверяем добавленные узлы
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Проверяем классы и ID на признаки расширений
                        const classList = node.classList || [];
                        const id = node.id || '';
                        const tagName = node.tagName || '';

                        for (const extName of this.suspiciousExtensions) {
                            const extNameLower = extName.toLowerCase();
                            
                            // Проверка классов
                            for (const className of classList) {
                                if (className.toLowerCase().includes(extNameLower)) {
                                    this.reportExtension(extName, 'dom_insertion', {
                                        element: tagName,
                                        className: className
                                    });
                                }
                            }

                            // Проверка ID
                            if (id.toLowerCase().includes(extNameLower)) {
                                this.reportExtension(extName, 'dom_insertion', {
                                    element: tagName,
                                    id: id
                                });
                            }
                        }
                    }
                }
            }
        });

        // Наблюдаем за изменениями в document
        this.mutationObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id']
        });
    }

    /**
     * Запустить все проверки
     */
    runAllChecks() {
        this.detectByDOMMarkers();
        this.detectByGlobalObjects();
        this.detectByInjectedScripts();
        this.detectByFunctionOverrides();
    }

    /**
     * Сообщить об обнаружении расширения
     */
    reportExtension(extensionName, method, details = {}) {
        // Проверяем, не сообщали ли мы уже об этом расширении
        const existingReport = this.detectedExtensions.find(
            ext => ext.name === extensionName && ext.method === method
        );

        if (existingReport) {
            // Обновляем время последнего обнаружения
            existingReport.lastSeen = Date.now();
            return;
        }

        // Новое обнаружение
        const extensionData = {
            name: extensionName,
            method: method,
            timestamp: Date.now(),
            lastSeen: Date.now(),
            details: details,
            suspicious: this.suspiciousExtensions.includes(extensionName.toLowerCase())
        };

        this.detectedExtensions.push(extensionData);

        // Отправляем событие
        const eventData = {
            type: 'extension_detected',
            timestamp: Date.now(),
            extension: extensionName,
            method: method,
            suspicious: extensionData.suspicious,
            details: details
        };

        if (this.eventCallback) {
            this.eventCallback(eventData);
        }
    }

    /**
     * Извлечь ID расширения из URL
     */
    extractExtensionId(url) {
        const match = url.match(/(?:chrome|moz|safari)-extension:\/\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Определить тип расширения по URL
     */
    getExtensionType(url) {
        if (url.includes('chrome-extension://')) return 'chrome';
        if (url.includes('moz-extension://')) return 'firefox';
        if (url.includes('safari-extension://')) return 'safari';
        return 'unknown';
    }

    /**
     * Безопасное преобразование в строку
     */
    safeStringify(obj) {
        try {
            return JSON.stringify(obj).substring(0, 100);
        } catch (e) {
            return String(obj).substring(0, 100);
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            isMonitoring: this.isMonitoring,
            detectedExtensions: this.detectedExtensions.length,
            suspiciousExtensions: this.detectedExtensions.filter(ext => ext.suspicious).length,
            extensions: this.detectedExtensions.map(ext => ({
                name: ext.name,
                suspicious: ext.suspicious,
                method: ext.method
            }))
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionDetector;
}

