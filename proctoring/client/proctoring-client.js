/**
 * Proctoring Client - Главный клиент прокторинг-системы
 * 
 * Объединяет все модули детектирования:
 * - Clipboard Monitor (детектирование скопированного кода)
 * - DevTools Detector (детектирование консоли)
 * - Extension Detector (детектирование расширений)
 * 
 * Отправляет события на сервер для анализа.
 */

class ProctoringClient {
    constructor(config = {}) {
        this.config = {
            sessionId: config.sessionId || this.generateSessionId(),
            apiEndpoint: config.apiEndpoint || '/api/proctoring',
            useWebSocket: config.useWebSocket !== false,
            batchInterval: config.batchInterval || 2000,  // Интервал отправки батчами
            maxBatchSize: config.maxBatchSize || 50,
            heartbeatInterval: config.heartbeatInterval || 5000,
            ...config
        };
        
        // Состояние
        this.isActive = false;
        this.eventBuffer = [];
        this.totalRiskScore = 0;
        
        // Модули детектирования
        this.clipboardMonitor = null;
        this.devtoolsDetector = null;
        this.extensionDetector = null;
        
        // WebSocket соединение
        this.ws = null;
        
        // Таймеры
        this.batchTimer = null;
        this.heartbeatTimer = null;
        
        // Колбэки
        this.onRiskUpdate = config.onRiskUpdate || null;
        
        // Биндинги
        this.handleEvent = this.handleEvent.bind(this);
        this.sendBatch = this.sendBatch.bind(this);
        this.sendHeartbeat = this.sendHeartbeat.bind(this);
    }

    /**
     * Начать прокторинг
     */
    async start() {
        if (this.isActive) {
            console.warn('[ProctoringClient] Already active');
            return;
        }
        
        console.log('[ProctoringClient] Starting proctoring...');
        console.log(`[ProctoringClient] Session ID: ${this.config.sessionId}`);
        
        // Инициализация модулей
        this.initializeDetectors();
        
        // Подключение к серверу
        if (this.config.useWebSocket) {
            await this.connectWebSocket();
        }
        
        // Запуск периодических задач
        this.startPeriodicTasks();
        
        this.isActive = true;
        
        // Отправка события начала сессии
        this.sendEvent({
            type: 'session_start',
            timestamp: Date.now()
        });
        
        console.log('[ProctoringClient] Proctoring started');
    }

    /**
     * Остановить прокторинг
     */
    stop() {
        if (!this.isActive) return;
        
        console.log('[ProctoringClient] Stopping proctoring...');
        
        // Останавливаем модули
        if (this.clipboardMonitor) {
            this.clipboardMonitor.disable();
        }
        if (this.devtoolsDetector) {
            this.devtoolsDetector.disable();
        }
        if (this.extensionDetector) {
            this.extensionDetector.disable();
        }
        
        // Останавливаем периодические задачи
        this.stopPeriodicTasks();
        
        // Отправляем оставшиеся события
        if (this.eventBuffer.length > 0) {
            this.sendBatch(true);  // Синхронная отправка
        }
        
        // Отправка события завершения сессии
        this.sendEvent({
            type: 'session_end',
            timestamp: Date.now(),
            totalRiskScore: this.totalRiskScore
        });
        
        // Закрываем WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isActive = false;
        console.log('[ProctoringClient] Proctoring stopped');
    }

    /**
     * Инициализация модулей детектирования
     */
    initializeDetectors() {
        // Clipboard Monitor
        this.clipboardMonitor = new ClipboardMonitor(this.handleEvent);
        this.clipboardMonitor.enable();
        
        // DevTools Detector
        this.devtoolsDetector = new DevToolsDetector(this.handleEvent);
        this.devtoolsDetector.enable();
        
        // Extension Detector
        this.extensionDetector = new ExtensionDetector(this.handleEvent);
        this.extensionDetector.enable();
        
        console.log('[ProctoringClient] All detectors initialized');
    }

    /**
     * Обработка события от модулей
     */
    handleEvent(event) {
        // Добавляем метаданные
        const enrichedEvent = {
            ...event,
            sessionId: this.config.sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: event.timestamp || Date.now()
        };
        
        // Обновляем общий риск
        if (event.riskScore) {
            this.totalRiskScore = Math.min(this.totalRiskScore + event.riskScore, 100);
        }
        
        // Уведомляем об обновлении риска
        if (this.onRiskUpdate) {
            this.onRiskUpdate(this.totalRiskScore, event);
        }
        
        // Добавляем в буфер
        this.eventBuffer.push(enrichedEvent);
        
        // Отправляем критичные события немедленно
        if (this.isCriticalEvent(event)) {
            this.sendEvent(enrichedEvent, true);
        }
        
        // Отправляем батчами, если буфер заполнен
        if (this.eventBuffer.length >= this.config.maxBatchSize) {
            this.sendBatch();
        }
    }

    /**
     * Проверить, является ли событие критичным
     */
    isCriticalEvent(event) {
        const criticalTypes = [
            'devtools_detected',
            'extension_detected',
            'suspicious_action'
        ];
        
        return criticalTypes.includes(event.type) && 
               event.riskScore && 
               event.riskScore >= 30;
    }

    /**
     * Подключиться к WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.config.wsUrl || 
                             this.config.apiEndpoint.replace(/^http/, 'ws') + '/ws/' + this.config.sessionId;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('[ProctoringClient] WebSocket connected');
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleServerMessage(data);
                    } catch (e) {
                        console.error('[ProctoringClient] Error parsing WebSocket message:', e);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('[ProctoringClient] WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('[ProctoringClient] WebSocket closed');
                    // Попытка переподключения
                    if (this.isActive) {
                        setTimeout(() => {
                            this.connectWebSocket().catch(console.error);
                        }, 5000);
                    }
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Обработка сообщений от сервера
     */
    handleServerMessage(data) {
        switch (data.type) {
            case 'risk_update':
                this.totalRiskScore = data.riskScore || this.totalRiskScore;
                if (this.onRiskUpdate) {
                    this.onRiskUpdate(this.totalRiskScore, data);
                }
                break;
                
            case 'warning':
                console.warn('[ProctoringClient] Server warning:', data.message);
                break;
                
            case 'heartbeat_ack':
                // Подтверждение heartbeat
                break;
        }
    }

    /**
     * Отправка события на сервер
     */
    async sendEvent(event, immediate = false) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Отправка через WebSocket
            this.ws.send(JSON.stringify(event));
        } else {
            // Fallback на HTTP
            try {
                const response = await fetch(`${this.config.apiEndpoint}/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(event)
                });
                
                if (!response.ok) {
                    console.error('[ProctoringClient] Failed to send event:', response.statusText);
                }
            } catch (error) {
                console.error('[ProctoringClient] Error sending event:', error);
            }
        }
    }

    /**
     * Отправка батча событий
     */
    sendBatch(immediate = false) {
        if (this.eventBuffer.length === 0) return;
        
        const batch = this.eventBuffer.splice(0, this.config.maxBatchSize);
        
        this.sendEvent({
            type: 'events_batch',
            timestamp: Date.now(),
            events: batch,
            count: batch.length
        }, immediate);
    }

    /**
     * Отправка heartbeat
     */
    sendHeartbeat() {
        this.sendEvent({
            type: 'heartbeat',
            timestamp: Date.now(),
            riskScore: this.totalRiskScore
        });
    }

    /**
     * Запуск периодических задач
     */
    startPeriodicTasks() {
        // Отправка батчей
        this.batchTimer = setInterval(() => {
            this.sendBatch();
        }, this.config.batchInterval);
        
        // Heartbeat
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }

    /**
     * Остановка периодических задач
     */
    stopPeriodicTasks() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Генерация ID сессии
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Получить текущую статистику
     */
    getStats() {
        return {
            sessionId: this.config.sessionId,
            isActive: this.isActive,
            totalRiskScore: this.totalRiskScore,
            eventsInBuffer: this.eventBuffer.length,
            clipboardStats: this.clipboardMonitor ? this.clipboardMonitor.getStats() : null,
            devtoolsState: this.devtoolsDetector ? this.devtoolsDetector.checkState() : null,
            detectedExtensions: this.extensionDetector ? this.extensionDetector.getDetectedExtensions() : []
        };
    }

    /**
     * Отправить снимок кода
     */
    async sendCodeSnapshot(code, taskId, language) {
        const snapshot = {
            type: 'code_snapshot',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            taskId: taskId,
            code: code,
            language: language
        };
        
        await this.sendEvent(snapshot, true);
    }
}

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProctoringClient;
}

