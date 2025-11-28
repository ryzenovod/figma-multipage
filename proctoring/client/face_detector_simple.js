/**
 * Simple Face Detector - без MediaPipe
 * Использует простую детекцию движения и присутствия через Canvas API
 */

class SimpleFaceDetector {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.detectionInterval = null;
        this.onFaceCountChange = null;
        this.onScreenshot = null;
        this.currentFaceCount = 1; // Предполагаем, что один человек
        this.suspiciousEvents = [];
        this.screenshots = [];
        this.maxScreenshots = 50;
        
        // Параметры детекции
        this.motionThreshold = 10;
        this.lastFrame = null;
        this.noMotionCounter = 0;
        this.motionDetected = true;
    }

    /**
     * Инициализация детектора
     */
    async initialize() {
        try {
            console.log('[SimpleFaceDetector] Инициализация...');
            
            // Создаем видео элемент
            this.video = document.createElement('video');
            this.video.style.display = 'none';
            this.video.autoplay = true;
            this.video.playsInline = true;
            document.body.appendChild(this.video);

            // Создаем canvas для обработки
            this.canvas = document.createElement('canvas');
            this.canvas.style.display = 'none';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

            // Запрашиваем доступ к камере
            console.log('[SimpleFaceDetector] Запрос доступа к камере...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            
            // Ждем когда видео загрузится
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            // Устанавливаем размеры canvas
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            console.log('[SimpleFaceDetector] ✅ Инициализация успешна');
            console.log(`Разрешение камеры: ${this.canvas.width}x${this.canvas.height}`);
            
            return true;
        } catch (error) {
            console.error('[SimpleFaceDetector] ❌ Ошибка инициализации:', error);
            throw error;
        }
    }

    /**
     * Запуск детекции
     */
    startDetection(intervalMs = 3000) {
        if (this.isRunning) {
            console.warn('[SimpleFaceDetector] Детекция уже запущена');
            return;
        }

        this.isRunning = true;
        this.detectionInterval = setInterval(() => {
            this.detectPresence();
        }, intervalMs);

        console.log(`[SimpleFaceDetector] ✅ Детекция запущена (интервал: ${intervalMs}ms)`);
    }

    /**
     * Остановка детекции
     */
    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        this.isRunning = false;
        console.log('[SimpleFaceDetector] Детекция остановлена');
    }

    /**
     * Детекция присутствия через анализ движения
     */
    detectPresence() {
        if (!this.video || this.video.readyState !== 4) {
            return;
        }

        try {
            // Рисуем текущий кадр
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Получаем данные пикселей
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const currentFrame = imageData.data;

            // Анализируем наличие изображения
            const hasImage = this.analyzeImagePresence(currentFrame);
            
            if (!hasImage) {
                // Нет изображения (камера закрыта или очень темно)
                this.handleFaceCountChange(0, 'warning');
                return;
            }

            // Детекция движения
            if (this.lastFrame) {
                const motion = this.detectMotion(currentFrame, this.lastFrame);
                
                if (motion < this.motionThreshold) {
                    this.noMotionCounter++;
                    
                    // Если долго нет движения - возможно никого нет
                    if (this.noMotionCounter > 5) {
                        this.handleFaceCountChange(0, 'warning');
                    }
                } else {
                    this.noMotionCounter = 0;
                    // Есть движение - предполагаем 1 человек
                    this.handleFaceCountChange(1, 'normal');
                }
            }

            // Сохраняем текущий кадр
            this.lastFrame = new Uint8ClampedArray(currentFrame);

        } catch (error) {
            console.error('[SimpleFaceDetector] Ошибка детекции:', error);
        }
    }

    /**
     * Анализ наличия изображения
     */
    analyzeImagePresence(pixels) {
        let brightness = 0;
        let variance = 0;
        
        // Проверяем средний уровень яркости
        for (let i = 0; i < pixels.length; i += 40) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            brightness += (r + g + b) / 3;
        }
        
        brightness = brightness / (pixels.length / 40);
        
        // Слишком темно или слишком светло
        if (brightness < 10 || brightness > 250) {
            return false;
        }
        
        return true;
    }

    /**
     * Детекция движения между кадрами
     */
    detectMotion(current, previous) {
        let diff = 0;
        let samples = 0;
        
        // Сравниваем каждый 100-й пиксель для скорости
        for (let i = 0; i < current.length; i += 400) {
            const r1 = current[i];
            const g1 = current[i + 1];
            const b1 = current[i + 2];
            
            const r2 = previous[i];
            const g2 = previous[i + 1];
            const b2 = previous[i + 2];
            
            diff += Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            samples++;
        }
        
        return diff / samples;
    }

    /**
     * Обработка изменения количества лиц
     */
    handleFaceCountChange(newCount, severity) {
        if (newCount === this.currentFaceCount) {
            return;
        }

        const event = {
            timestamp: Date.now(),
            previousCount: this.currentFaceCount,
            currentCount: newCount,
            severity: severity,
            screenshotId: null
        };

        // Если критическое событие - делаем скриншот
        if (severity === 'critical' || severity === 'warning') {
            const screenshot = this.captureScreenshot(newCount, severity);
            if (screenshot) {
                event.screenshotId = screenshot.id;
            }
        }

        this.suspiciousEvents.push(event);
        this.currentFaceCount = newCount;

        // Оповещаем callback
        if (this.onFaceCountChange) {
            this.onFaceCountChange(event);
        }

        console.log(`[SimpleFaceDetector] Лиц: ${event.previousCount} → ${event.currentCount} (${severity})`);
    }

    /**
     * Захват скриншота
     */
    captureScreenshot(faceCount, severity) {
        try {
            // Рисуем аннотированное изображение
            const annotatedCanvas = this.drawAnnotations(faceCount, severity);
            
            // Конвертируем в blob
            const dataUrl = annotatedCanvas.toDataURL('image/jpeg', 0.85);
            
            // Создаем thumbnail
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 160;
            thumbnailCanvas.height = 120;
            const thumbCtx = thumbnailCanvas.getContext('2d');
            thumbCtx.drawImage(annotatedCanvas, 0, 0, 160, 120);
            const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.7);

            // Конвертируем dataUrl в blob
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], {type: mime});

            const screenshot = {
                id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                severity: severity,
                faceCount: faceCount,
                blob: blob,
                thumbnail: thumbnail,
                size: blob.size,
                uploaded: false
            };

            // Добавляем в хранилище
            this.screenshots.push(screenshot);

            // Ограничиваем количество
            if (this.screenshots.length > this.maxScreenshots) {
                this.screenshots.shift();
            }

            // Оповещаем callback
            if (this.onScreenshot) {
                this.onScreenshot(screenshot);
            }

            console.log(`[SimpleFaceDetector] 📸 Скриншот: ${screenshot.id} (${(blob.size / 1024).toFixed(2)} KB)`);

            return screenshot;

        } catch (error) {
            console.error('[SimpleFaceDetector] Ошибка захвата скриншота:', error);
            return null;
        }
    }

    /**
     * Рисование аннотаций
     */
    drawAnnotations(faceCount, severity) {
        const annotatedCanvas = document.createElement('canvas');
        annotatedCanvas.width = this.canvas.width;
        annotatedCanvas.height = this.canvas.height;
        const ctx = annotatedCanvas.getContext('2d');

        // Копируем изображение
        ctx.drawImage(this.canvas, 0, 0);

        // Добавляем информацию
        const padding = 10;
        const boxHeight = 80;
        
        // Полупрозрачный фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(padding, padding, 250, boxHeight);

        // Timestamp
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        const timestamp = new Date().toLocaleString('ru-RU');
        ctx.fillText(timestamp, padding + 10, padding + 25);

        // Статус
        ctx.font = '14px Arial';
        let statusText = '';
        let statusColor = '#FFFFFF';
        
        if (severity === 'critical') {
            statusText = '⚠️ КРИТИЧЕСКОЕ СОБЫТИЕ';
            statusColor = '#FF4444';
        } else if (severity === 'warning') {
            statusText = '⚠️ ПРЕДУПРЕЖДЕНИЕ';
            statusColor = '#FFA500';
        } else {
            statusText = '✓ Норма';
            statusColor = '#4CAF50';
        }
        
        ctx.fillStyle = statusColor;
        ctx.fillText(statusText, padding + 10, padding + 50);

        // Количество лиц
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Обнаружено: ${faceCount} 👤`, padding + 10, padding + 70);

        return annotatedCanvas;
    }

    /**
     * Получить скриншот по ID
     */
    getScreenshot(screenshotId) {
        return this.screenshots.find(s => s.id === screenshotId);
    }

    /**
     * Получить все скриншоты
     */
    getAllScreenshots() {
        return this.screenshots.map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            severity: s.severity,
            faceCount: s.faceCount,
            thumbnail: s.thumbnail,
            size: s.size,
            uploaded: s.uploaded
        }));
    }

    /**
     * Отметить как загруженный
     */
    markScreenshotAsUploaded(screenshotId) {
        const screenshot = this.getScreenshot(screenshotId);
        if (screenshot) {
            screenshot.uploaded = true;
        }
    }

    /**
     * Очистить скриншоты
     */
    clearScreenshots() {
        this.screenshots = [];
    }

    /**
     * Получить статистику
     */
    getStatistics() {
        const totalEvents = this.suspiciousEvents.length;
        const criticalEvents = this.suspiciousEvents.filter(e => e.severity === 'critical').length;
        const warningEvents = this.suspiciousEvents.filter(e => e.severity === 'warning').length;
        const maxFaces = Math.max(...this.suspiciousEvents.map(e => e.currentCount), this.currentFaceCount, 0);
        const totalScreenshotsSize = this.screenshots.reduce((sum, s) => sum + s.size, 0);

        return {
            currentFaceCount: this.currentFaceCount,
            totalEvents,
            criticalEvents,
            warningEvents,
            maxFacesDetected: maxFaces,
            events: this.suspiciousEvents,
            screenshots: {
                total: this.screenshots.length,
                uploaded: this.screenshots.filter(s => s.uploaded).length,
                pending: this.screenshots.filter(s => !s.uploaded).length,
                totalSize: totalScreenshotsSize,
                totalSizeMB: (totalScreenshotsSize / 1024 / 1024).toFixed(2)
            }
        };
    }

    /**
     * Уничтожение детектора
     */
    destroy() {
        this.stopDetection();

        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }

        if (this.video) {
            this.video.remove();
        }

        if (this.canvas) {
            this.canvas.remove();
        }
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleFaceDetector;
}

// Алиас для совместимости
if (typeof FaceDetector === 'undefined') {
    window.FaceDetector = SimpleFaceDetector;
}
