/**
 * Proctoring Client - Главный клиент прокторинг-системы
 * Объединяет все детекторы и отправляет события на сервер
 */

// Импорты (если используются модули)
// import ClipboardMonitor from './clipboard-monitor.js';
// import DevToolsDetector from './devtools-detector.js';
// import ExtensionDetector from './extension-detector.js';

class ProctoringClient {
    constructor(options = {}) {
        this.options = {
            apiUrl: options.apiUrl || '/api/proctoring',
            sessionId: options.sessionId || this.generateSessionId(),
            sendInterval: options.sendInterval || 5000, // Отправка событий каждые 5 секунд
            heartbeatInterval: options.heartbeatInterval || 10000, // Heartbeat каждые 10 секунд
            ...options
        };

        // Детекторы
        this.clipboardMonitor = null;
        this.devToolsDetector = null;
        this.extensionDetector = null;

        // Очередь событий
        this.eventQueue = [];
        this.isActive = false;
        this.sendIntervalId = null;
        this.heartbeatIntervalId = null;

        // WebSocket соединение (опционально)
        this.ws = null;
        this.useWebSocket = options.useWebSocket || false;

        // Статистика
        this.stats = {
            eventsSent: 0,
            eventsQueued: 0,
            lastSendTime: null,
            connectionStatus: 'disconnected'
        };

        // Callbacks
        this.onEvent = options.onEvent || null;
        this.onRiskUpdate = options.onRiskUpdate || null;
        this.onError = options.onError || null;
    }

    /**
     * Инициализировать и запустить прокторинг
     */
    async start() {
        if (this.isActive) {
            console.warn('ProctoringClient: уже запущен');
            return;
        }

        try {
            // Инициализация детекторов
            this.initializeDetectors();

            // Запуск детекторов
            this.clipboardMonitor.start();
            this.devToolsDetector.start();
            this.extensionDetector.start();

            // Подключение к серверу
            if (this.options.useWebSocket) {
                await this.connectWebSocket();
            }

            // Запуск отправки событий
            this.startEventSending();

            // Запуск heartbeat
            this.startHeartbeat();

            this.isActive = true;
            console.log('ProctoringClient: прокторинг запущен', {
                sessionId: this.options.sessionId,
                apiUrl: this.options.apiUrl
            });

            // Отправка события о запуске
            this.addEvent({
                type: 'proctoring_started',
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('ProctoringClient: ошибка при запуске', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Остановить прокторинг
     */
    stop() {
        if (!this.isActive) return;

        // Остановка детекторов
        if (this.clipboardMonitor) this.clipboardMonitor.stop();
        if (this.devToolsDetector) this.devToolsDetector.stop();
        if (this.extensionDetector) this.extensionDetector.stop();

        // Остановка интервалов
        if (this.sendIntervalId) clearInterval(this.sendIntervalId);
        if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);

        // Закрытие WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Отправка оставшихся событий
        this.flushEvents();

        // Отправка события об остановке
        this.addEvent({
            type: 'proctoring_stopped',
            timestamp: Date.now()
        });

        this.flushEvents();

        this.isActive = false;
        this.stats.connectionStatus = 'disconnected';
        console.log('ProctoringClient: прокторинг остановлен');
    }

    /**
     * Инициализировать детекторы
     */
    initializeDetectors() {
        // Инициализация ClipboardMonitor
        this.clipboardMonitor = new ClipboardMonitor((event) => {
            this.handleDetectorEvent('clipboard', event);
        });

        // Инициализация DevToolsDetector
        this.devToolsDetector = new DevToolsDetector((event) => {
            this.handleDetectorEvent('devtools', event);
        });

        // Инициализация ExtensionDetector
        this.extensionDetector = new ExtensionDetector((event) => {
            this.handleDetectorEvent('extension', event);
        });
    }

    /**
     * Обработка события от детектора
     */
    handleDetectorEvent(source, event) {
        // Добавляем метаданные
        const enrichedEvent = {
            ...event,
            sessionId: this.options.sessionId,
            source: source,
            timestamp: event.timestamp || Date.now()
        };

        // Добавляем в очередь
        this.addEvent(enrichedEvent);

        // Вызываем callback если есть
        if (this.onEvent) {
            this.onEvent(enrichedEvent);
        }
    }

    /**
     * Добавить событие в очередь
     */
    addEvent(event) {
        this.eventQueue.push(event);
        this.stats.eventsQueued++;

        // Если событие критичное, отправляем сразу
        if (this.isCriticalEvent(event)) {
            this.flushEvents();
        }
    }

    /**
     * Проверить, является ли событие критичным
     */
    isCriticalEvent(event) {
        const criticalTypes = [
            'devtools_detected',
            'extension_detected',
            'clipboard_paste' // если большой фрагмент
        ];

        if (criticalTypes.includes(event.type)) {
            // Если это вставка большого фрагмента, критично
            if (event.type === 'clipboard_paste' && event.textLength > 200) {
                return true;
            }
            // DevTools и расширения всегда критичны
            if (event.type === 'devtools_detected' || event.type === 'extension_detected') {
                return true;
            }
        }

        return false;
    }

    /**
     * Запустить периодическую отправку событий
     */
    startEventSending() {
        this.sendIntervalId = setInterval(() => {
            this.flushEvents();
        }, this.options.sendInterval);
    }

    /**
     * Отправить все события из очереди
     */
    async flushEvents() {
        if (this.eventQueue.length === 0) return;

        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];

        try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Отправка через WebSocket
                this.ws.send(JSON.stringify({
                    type: 'events',
                    sessionId: this.options.sessionId,
                    events: eventsToSend
                }));
            } else {
                // Отправка через HTTP
                await this.sendEventsHTTP(eventsToSend);
            }

            this.stats.eventsSent += eventsToSend.length;
            this.stats.eventsQueued = this.eventQueue.length;
            this.stats.lastSendTime = Date.now();

        } catch (error) {
            console.error('ProctoringClient: ошибка при отправке событий', error);
            // Возвращаем события в очередь при ошибке
            this.eventQueue.unshift(...eventsToSend);
            
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Отправить события через HTTP
     */
    async sendEventsHTTP(events) {
        const response = await fetch(`${this.options.apiUrl}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: this.options.sessionId,
                events: events
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Обновляем статистику риска если пришла
        if (data.riskScore !== undefined && this.onRiskUpdate) {
            this.onRiskUpdate(data.riskScore, data);
        }

        return data;
    }

    /**
     * Подключиться через WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.options.apiUrl.replace('http', 'ws') + '/ws';
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('ProctoringClient: WebSocket подключен');
                this.stats.connectionStatus = 'connected';
                resolve();

                // Отправка начального сообщения
                this.ws.send(JSON.stringify({
                    type: 'connect',
                    sessionId: this.options.sessionId
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('ProctoringClient: ошибка парсинга WebSocket сообщения', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('ProctoringClient: WebSocket ошибка', error);
                this.stats.connectionStatus = 'error';
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('ProctoringClient: WebSocket закрыт');
                this.stats.connectionStatus = 'disconnected';
                // Попытка переподключения
                if (this.isActive) {
                    setTimeout(() => this.connectWebSocket(), 5000);
                }
            };
        });
    }

    /**
     * Обработать сообщение от WebSocket
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'risk_update':
                if (this.onRiskUpdate) {
                    this.onRiskUpdate(data.riskScore, data);
                }
                break;

            case 'warning':
                console.warn('ProctoringClient: предупреждение', data.message);
                break;

            case 'ping':
                // Ответ на ping
                this.ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                console.log('ProctoringClient: неизвестное сообщение', data);
        }
    }

    /**
     * Запустить heartbeat
     */
    startHeartbeat() {
        this.heartbeatIntervalId = setInterval(() => {
            this.sendHeartbeat();
        }, this.options.heartbeatInterval);
    }

    /**
     * Отправить heartbeat
     */
    async sendHeartbeat() {
        try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'heartbeat',
                    sessionId: this.options.sessionId,
                    timestamp: Date.now()
                }));
            } else {
                // HTTP heartbeat
                await fetch(`${this.options.apiUrl}/heartbeat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: this.options.sessionId,
                        timestamp: Date.now()
                    })
                });
            }
        } catch (error) {
            console.error('ProctoringClient: ошибка heartbeat', error);
        }
    }

    /**
     * Отправить снимок кода для анализа
     */
    async sendCodeSnapshot(code, taskId, language) {
        const snapshot = {
            type: 'code_snapshot',
            sessionId: this.options.sessionId,
            taskId: taskId,
            code: code,
            language: language,
            timestamp: Date.now()
        };

        try {
            const response = await fetch(`${this.options.apiUrl}/code-snapshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('ProctoringClient: ошибка при отправке снимка кода', error);
            throw error;
        }
    }

    /**
     * Получить текущий риск
     */
    async getRiskScore() {
        try {
            const response = await fetch(`${this.options.apiUrl}/score/${this.options.sessionId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('ProctoringClient: ошибка при получении риска', error);
            throw error;
        }
    }

    /**
     * Сгенерировать ID сессии
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            ...this.stats,
            isActive: this.isActive,
            eventsInQueue: this.eventQueue.length,
            detectors: {
                clipboard: this.clipboardMonitor ? this.clipboardMonitor.getStats() : null,
                devtools: this.devToolsDetector ? this.devToolsDetector.getStats() : null,
                extensions: this.extensionDetector ? this.extensionDetector.getStats() : null
            }
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProctoringClient;
}

// Глобальный доступ
if (typeof window !== 'undefined') {
    window.ProctoringClient = ProctoringClient;
}

