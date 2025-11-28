/**
 * Main Proctoring Client
 * Объединяет все модули прокторинга и отправляет события на сервер
 */
class ProctoringClient {
    constructor(config = {}) {
        this.config = {
            apiUrl: config.apiUrl || '/api/proctoring',
            sessionId: config.sessionId || this.generateSessionId(),
            sendInterval: config.sendInterval || 5000, // Отправка каждые 5 секунд
            enableWebSocket: config.enableWebSocket !== false,
            enableFaceDetection: config.enableFaceDetection !== false,
            enableScreenshotUpload: config.enableScreenshotUpload !== false,
            ...config
        };
        
        // Модули прокторинга
        this.clipboardMonitor = null;
        this.devtoolsDetector = null;
        this.extensionDetector = null;
        this.faceDetector = null;
        
        // Буфер событий
        this.eventBuffer = [];
        this.sendTimer = null;
        this.isEnabled = false;
        
        // WebSocket соединение (опционально)
        this.ws = null;
        
        // Очередь скриншотов для загрузки
        this.screenshotQueue = [];
        
        // Статистика
        this.statistics = {
            eventsSent: 0,
            eventsBuffered: 0,
            lastSentTime: null
        };
    }

    /**
     * Инициализировать и запустить прокторинг
     */
    async start() {
        if (this.isEnabled) {
            console.warn('[ProctoringClient] Already started');
            return;
        }
        
        console.log('[ProctoringClient] Starting proctoring system...');
        
        // Инициализируем модули
        await this.initModules();
        
        // Подключаем WebSocket если нужно
        if (this.config.enableWebSocket) {
            await this.connectWebSocket();
        }
        
        // Запускаем периодическую отправку
        this.startPeriodicSend();
        
        // Отслеживаем закрытие страницы
        window.addEventListener('beforeunload', () => {
            this.sendBufferedEvents(true); // Срочная отправка
        });
        
        // Heartbeat для проверки активности
        this.startHeartbeat();
        
        this.isEnabled = true;
        console.log('[ProctoringClient] Started successfully');
    }

    /**
     * Остановить прокторинг
     */
    stop() {
        if (!this.isEnabled) return;
        
        console.log('[ProctoringClient] Stopping proctoring system...');
        
        // Отключаем модули
        if (this.clipboardMonitor) this.clipboardMonitor.disable();
        if (this.devtoolsDetector) this.devtoolsDetector.disable();
        if (this.extensionDetector) this.extensionDetector.disable();
        if (this.faceDetector) {
            this.faceDetector.stopDetection();
            this.faceDetector.destroy();
        }
        
        // Останавливаем таймеры
        if (this.sendTimer) {
            clearInterval(this.sendTimer);
            this.sendTimer = null;
        }
        
        // Закрываем WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Отправляем оставшиеся события
        this.sendBufferedEvents(true);
        
        this.isEnabled = false;
        console.log('[ProctoringClient] Stopped');
    }

    /**
     * Инициализировать модули прокторинга
     */
    async initModules() {
        // Clipboard Monitor
        this.clipboardMonitor = new ClipboardMonitor((event) => {
            this.addEvent(event);
        });
        this.clipboardMonitor.enable();
        
        // DevTools Detector
        this.devtoolsDetector = new DevToolsDetector((event) => {
            this.addEvent(event);
        });
        this.devtoolsDetector.enable();
        
        // Extension Detector
        this.extensionDetector = new ExtensionDetector((event) => {
            this.addEvent(event);
        });
        this.extensionDetector.enable();
        
        // Face Detector
        if (this.config.enableFaceDetection && typeof FaceDetector !== 'undefined') {
            try {
                this.faceDetector = new FaceDetector();
                await this.faceDetector.initialize();
                
                // Подписываемся на изменения количества лиц
                this.faceDetector.onFaceCountChange = (event) => {
                    this.handleFaceDetectionEvent(event);
                };
                
                // Подписываемся на события скриншотов
                this.faceDetector.onScreenshot = (screenshot) => {
                    this.handleScreenshot(screenshot);
                };
                
                // Запускаем детекцию (проверка каждые 3 секунды)
                this.faceDetector.startDetection(3000);
                
                console.log('[ProctoringClient] Face detection enabled');
            } catch (error) {
                console.error('[ProctoringClient] Failed to initialize face detection:', error);
            }
        }
    }

    /**
     * Добавить событие в буфер
     */
    addEvent(event) {
        const enrichedEvent = {
            ...event,
            sessionId: this.config.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: event.timestamp || Date.now()
        };
        
        this.eventBuffer.push(enrichedEvent);
        this.statistics.eventsBuffered++;
        
        // Если критичное событие - отправляем немедленно
        if (this.isCriticalEvent(event)) {
            this.sendBufferedEvents(true);
        }
        
        // Отправляем через WebSocket если доступно
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(enrichedEvent));
            } catch (error) {
                console.error('[ProctoringClient] WebSocket send error:', error);
            }
        }
    }

    /**
     * Проверить, является ли событие критичным
     */
    isCriticalEvent(event) {
        const criticalTypes = [
            'devtools_detected',
            'extension_detected',
            'clipboard_paste', // Большие вставки
            'face_detection' // События детекции лиц
        ];
        
        if (criticalTypes.includes(event.type)) {
            // Для вставок проверяем размер
            if (event.type === 'clipboard_paste') {
                return event.textLength > 200; // Больше 200 символов
            }
            // Для face detection проверяем severity
            if (event.type === 'face_detection') {
                return event.data.severity === 'critical';
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Обработать событие детекции лиц
     */
    handleFaceDetectionEvent(event) {
        const proctoringEvent = {
            type: 'face_detection',
            timestamp: event.timestamp,
            sessionId: this.config.sessionId,
            data: {
                previousCount: event.previousCount,
                currentCount: event.currentCount,
                severity: event.severity,
                screenshotId: event.screenshotId
            }
        };
        
        this.addEvent(proctoringEvent);
        
        console.log('[ProctoringClient] Face detection event:', proctoringEvent);
    }
    
    /**
     * Обработать новый скриншот
     */
    handleScreenshot(screenshot) {
        console.log(`[ProctoringClient] New screenshot captured: ${screenshot.id}`);
        
        // Добавляем в очередь на отправку
        this.screenshotQueue.push(screenshot);
        
        // Если включена автоматическая загрузка - отправляем немедленно
        if (this.config.enableScreenshotUpload) {
            this.uploadScreenshot(screenshot);
        }
    }
    
    /**
     * Загрузить скриншот на сервер
     */
    async uploadScreenshot(screenshot) {
        try {
            const formData = new FormData();
            formData.append('screenshot', screenshot.blob, `${screenshot.id}.jpg`);
            formData.append('sessionId', this.config.sessionId);
            formData.append('timestamp', screenshot.timestamp);
            formData.append('severity', screenshot.severity);
            formData.append('faceCount', screenshot.faceCount);
            
            const response = await fetch(`${this.config.apiUrl}/screenshot`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`[ProctoringClient] Screenshot uploaded: ${screenshot.id}`, result);
                
                // Помечаем как загруженный
                if (this.faceDetector) {
                    this.faceDetector.markScreenshotAsUploaded(screenshot.id);
                }
                
                // Удаляем из очереди
                this.screenshotQueue = this.screenshotQueue.filter(s => s.id !== screenshot.id);
                
                return result;
            } else {
                console.error(`[ProctoringClient] Failed to upload screenshot: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error('[ProctoringClient] Error uploading screenshot:', error);
            return null;
        }
    }
    
    /**
     * Загрузить все ожидающие скриншоты
     */
    async uploadPendingScreenshots() {
        console.log(`[ProctoringClient] Uploading ${this.screenshotQueue.length} pending screenshots...`);
        
        const uploadPromises = this.screenshotQueue.map(screenshot => 
            this.uploadScreenshot(screenshot)
        );
        
        const results = await Promise.allSettled(uploadPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        console.log(`[ProctoringClient] Uploaded ${successful}/${results.length} screenshots`);
        
        return { total: results.length, successful };
    }

    /**
     * Подключиться к WebSocket
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.config.wsUrl || 
                    this.config.apiUrl.replace('http', 'ws') + '/ws/' + this.config.sessionId;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('[ProctoringClient] WebSocket connected');
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleServerMessage(message);
                    } catch (error) {
                        console.error('[ProctoringClient] Error parsing WebSocket message:', error);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('[ProctoringClient] WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('[ProctoringClient] WebSocket closed');
                    // Пытаемся переподключиться через 5 секунд
                    setTimeout(() => {
                        if (this.isEnabled) {
                            this.connectWebSocket();
                        }
                    }, 5000);
                };
                
            } catch (error) {
                console.error('[ProctoringClient] WebSocket connection error:', error);
                reject(error);
            }
        });
    }

    /**
     * Обработать сообщение от сервера
     */
    handleServerMessage(message) {
        switch (message.type) {
            case 'risk_update':
                this.onRiskUpdate(message);
                break;
            case 'warning':
                this.onWarning(message);
                break;
            default:
                console.log('[ProctoringClient] Unknown message type:', message.type);
        }
    }

    /**
     * Обработчик обновления риска
     */
    onRiskUpdate(message) {
        // Можно показать предупреждение пользователю
        if (message.risk_score > 70) {
            console.warn(`[ProctoringClient] High risk detected: ${message.risk_score}`);
        }
    }

    /**
     * Обработчик предупреждения
     */
    onWarning(message) {
        console.warn(`[ProctoringClient] Warning: ${message.message}`);
        // Можно показать UI предупреждение
    }

    /**
     * Запустить периодическую отправку событий
     */
    startPeriodicSend() {
        this.sendTimer = setInterval(() => {
            this.sendBufferedEvents();
        }, this.config.sendInterval);
    }

    /**
     * Отправить буферизованные события
     */
    async sendBufferedEvents(urgent = false) {
        if (this.eventBuffer.length === 0) return;
        
        const eventsToSend = [...this.eventBuffer];
        this.eventBuffer = [];

        // Normalize events for backend schema
        const serverEvents = eventsToSend.map(e => {
            const { type, timestamp, metadata, data, ...rest } = e || {};
            const md = metadata || (data ? data : rest);
            return { type, timestamp: timestamp || Date.now(), metadata: md };
        });
        
        try {
            const response = await fetch(`${this.config.apiUrl}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.config.sessionId,
                    events: serverEvents,
                    urgent: urgent
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.statistics.eventsSent += eventsToSend.length;
            this.statistics.lastSentTime = Date.now();
            
            // Обработка ответа от сервера
            if (result.risk_score !== undefined) {
                this.onRiskUpdate(result);
            }
            
        } catch (error) {
            console.error('[ProctoringClient] Error sending events:', error);
            // Возвращаем события в буфер для повторной отправки
            this.eventBuffer.unshift(...eventsToSend);
        }
    }

    /**
     * Отправить снимок кода для анализа
     */
    async sendCodeSnapshot(code, taskId, language) {
        try {
            const response = await fetch(`${this.config.apiUrl}/code-snapshot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.config.sessionId,
                    taskId: taskId,
                    code: code,
                    language: language,
                    timestamp: Date.now()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('[ProctoringClient] Error sending code snapshot:', error);
            throw error;
        }
    }

    /**
     * Получить текущий скор риска
     */
    async getRiskScore() {
        try {
            const response = await fetch(
                `${this.config.apiUrl}/score/${this.config.sessionId}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('[ProctoringClient] Error getting risk score:', error);
            throw error;
        }
    }

    /**
     * Запустить heartbeat
     */
    startHeartbeat() {
        setInterval(() => {
            this.sendHeartbeat();
        }, 10000); // Каждые 10 секунд
    }

    /**
     * Отправить heartbeat
     */
    async sendHeartbeat() {
        try {
            await fetch(`${this.config.apiUrl}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.config.sessionId,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.error('[ProctoringClient] Heartbeat error:', error);
        }
    }

    /**
     * Получить статистику
     */
    getStatistics() {
        const stats = {
            ...this.statistics,
            bufferSize: this.eventBuffer.length,
            clipboardStats: this.clipboardMonitor?.getStatistics() || {},
            devtoolsStats: this.devtoolsDetector?.getStatistics() || {},
            extensionStats: this.extensionDetector?.getStatistics() || {},
            websocketConnected: this.ws?.readyState === WebSocket.OPEN
        };
        
        // Добавляем статистику детекции лиц
        if (this.faceDetector) {
            stats.faceDetection = this.faceDetector.getStatistics();
            stats.screenshots = this.faceDetector.getAllScreenshots();
        }
        
        return stats;
    }

    /**
     * Сгенерировать ID сессии
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProctoringClient;
}

// Auto-initialize if in browser and config provided
if (typeof window !== 'undefined' && window.PROCTORING_CONFIG) {
    window.proctoringClient = new ProctoringClient(window.PROCTORING_CONFIG);
    window.proctoringClient.start();
}

