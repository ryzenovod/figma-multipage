/**
 * FaceDetector - Детектор лиц с захватом скриншотов при критических событиях
 * Использует MediaPipe Face Detection для подсчета количества людей в кадре
 */

class FaceDetector {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.faceDetection = null;
        this.isRunning = false;
        this.detectionInterval = null;
        this.onFaceCountChange = null; // Callback для изменения количества лиц
        this.onScreenshot = null; // Callback для новых скриншотов
        this.currentFaceCount = 0;
        this.suspiciousEvents = [];
        this.screenshots = []; // Хранилище скриншотов
        this.maxScreenshots = 50; // Максимум скриншотов в памяти
    }

    /**
     * Инициализация детектора: запрос камеры и загрузка модели
     */
    async initialize() {
        try {
            // Создаем видео элемент
            this.video = document.createElement('video');
            this.video.style.display = 'none';
            this.video.autoplay = true;
            document.body.appendChild(this.video);

            // Создаем canvas для обработки
            this.canvas = document.createElement('canvas');
            this.canvas.style.display = 'none';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');

            // Запрашиваем доступ к камере
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            await this.video.play();

            // Устанавливаем размеры canvas
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            // Загружаем MediaPipe Face Detection
            await this.loadFaceDetectionModel();

            console.log('Face detector initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize face detector:', error);
            throw error;
        }
    }

    /**
     * Загрузка модели MediaPipe Face Detection
     */
    async loadFaceDetectionModel() {
        try {
            // Проверяем доступность MediaPipe
            if (typeof FilesetResolver === 'undefined') {
                throw new Error('MediaPipe library not loaded. Check internet connection and CDN availability.');
            }

            // Используем MediaPipe Face Detection через CDN
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            // Используем правильное имя класса из MediaPipe
            const FaceDetectorClass = vision.FaceDetector || window.FaceDetector;
            
            if (!FaceDetectorClass) {
                throw new Error('FaceDetector class not found in MediaPipe library');
            }

            this.faceDetection = await FaceDetectorClass.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                minDetectionConfidence: 0.5
            });
            
            console.log('MediaPipe Face Detection model loaded successfully');
        } catch (error) {
            console.error('Failed to load MediaPipe model:', error);
            throw error;
        }
    }

    /**
     * Запуск периодической детекции лиц
     * @param {number} intervalMs - Интервал проверки в миллисекундах
     */
    startDetection(intervalMs = 3000) {
        if (this.isRunning) {
            console.warn('Detection already running');
            return;
        }

        this.isRunning = true;
        this.detectionInterval = setInterval(() => {
            this.detectFaces();
        }, intervalMs);

        console.log(`Face detection started (interval: ${intervalMs}ms)`);
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
        console.log('Face detection stopped');
    }

    /**
     * Основной метод детекции лиц
     */
    async detectFaces() {
        if (!this.faceDetection || this.video.readyState !== 4) {
            return;
        }

        try {
            // Рисуем текущий кадр на canvas
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // Детектируем лица
            const timestamp = performance.now();
            const detections = this.faceDetection.detectForVideo(this.video, timestamp);

            const faceCount = detections.detections.length;

            // Если количество лиц изменилось
            if (faceCount !== this.currentFaceCount) {
                await this.handleFaceCountChange(faceCount, detections);
            }

            this.currentFaceCount = faceCount;

        } catch (error) {
            console.error('Face detection error:', error);
        }
    }

    /**
     * Обработка изменения количества лиц
     * @param {number} newCount - Новое количество лиц
     * @param {Object} detections - Результаты детекции
     */
    async handleFaceCountChange(newCount, detections) {
        const severity = this.calculateSeverity(newCount);
        
        const event = {
            timestamp: Date.now(),
            previousCount: this.currentFaceCount,
            currentCount: newCount,
            severity: severity,
            screenshotId: null
        };

        // Если критическое событие - делаем скриншот
        if (severity === 'critical' || severity === 'warning') {
            const screenshot = await this.captureScreenshot(detections, severity);
            if (screenshot) {
                event.screenshotId = screenshot.id;
            }
        }

        this.suspiciousEvents.push(event);

        // Оповещаем callback
        if (this.onFaceCountChange) {
            this.onFaceCountChange(event);
        }

        console.log(`Face count changed: ${this.currentFaceCount} -> ${newCount}, severity: ${severity}`);
    }

    /**
     * Захват скриншота с аннотациями
     * @param {Object} detections - Результаты детекции
     * @param {string} severity - Уровень серьезности события
     * @returns {Object} Объект скриншота
     */
    async captureScreenshot(detections, severity) {
        try {
            // Рисуем прямоугольники вокруг лиц
            const annotatedCanvas = this.drawFaceAnnotations(detections);
            
            // Конвертируем canvas в blob
            const blob = await new Promise(resolve => {
                annotatedCanvas.toBlob(resolve, 'image/jpeg', 0.85);
            });

            // Создаем base64 для превью (уменьшенная версия)
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 160;
            thumbnailCanvas.height = 120;
            const thumbCtx = thumbnailCanvas.getContext('2d');
            thumbCtx.drawImage(annotatedCanvas, 0, 0, 160, 120);
            const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.7);

            const screenshot = {
                id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                severity: severity,
                faceCount: detections.detections.length,
                blob: blob,
                thumbnail: thumbnail,
                size: blob.size,
                uploaded: false
            };

            // Добавляем в хранилище
            this.screenshots.push(screenshot);

            // Ограничиваем количество скриншотов
            if (this.screenshots.length > this.maxScreenshots) {
                const removed = this.screenshots.shift();
                console.log(`Removed old screenshot: ${removed.id}`);
            }

            // Оповещаем callback для отправки на сервер
            if (this.onScreenshot) {
                this.onScreenshot(screenshot);
            }

            console.log(`Screenshot captured: ${screenshot.id}, size: ${(blob.size / 1024).toFixed(2)} KB`);

            return screenshot;

        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            return null;
        }
    }

    /**
     * Рисование аннотаций (рамок и меток) на изображении
     * @param {Object} detections - Результаты детекции
     * @returns {HTMLCanvasElement} Canvas с аннотациями
     */
    drawFaceAnnotations(detections) {
        // Создаем копию canvas для аннотаций
        const annotatedCanvas = document.createElement('canvas');
        annotatedCanvas.width = this.canvas.width;
        annotatedCanvas.height = this.canvas.height;
        const ctx = annotatedCanvas.getContext('2d');

        // Копируем изображение
        ctx.drawImage(this.canvas, 0, 0);

        // Рисуем рамки вокруг каждого лица
        detections.detections.forEach((detection, index) => {
            const bbox = detection.boundingBox;
            
            // Настройка стиля
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.fillStyle = '#FF0000';
            ctx.font = '16px Arial';

            // Рисуем прямоугольник
            ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);

            // Рисуем метку с номером лица
            const label = `Person ${index + 1}`;
            const confidence = (detection.categories[0].score * 100).toFixed(0);
            const text = `${label} (${confidence}%)`;
            
            ctx.fillText(text, bbox.originX, bbox.originY - 5);

            // Рисуем ключевые точки лица (если есть)
            if (detection.keypoints) {
                ctx.fillStyle = '#00FF00';
                detection.keypoints.forEach(keypoint => {
                    ctx.beginPath();
                    ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        });

        // Добавляем timestamp
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, 10, 200, 30);
        ctx.fillStyle = '#000000';
        ctx.font = '14px monospace';
        const timestamp = new Date().toLocaleString('ru-RU');
        ctx.fillText(timestamp, 15, 30);

        return annotatedCanvas;
    }

    /**
     * Получить скриншот по ID
     * @param {string} screenshotId - ID скриншота
     * @returns {Object} Объект скриншота
     */
    getScreenshot(screenshotId) {
        return this.screenshots.find(s => s.id === screenshotId);
    }

    /**
     * Получить все скриншоты (без blob для экономии памяти)
     * @returns {Array} Массив метаданных скриншотов
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
     * Отметить скриншот как загруженный
     * @param {string} screenshotId - ID скриншота
     */
    markScreenshotAsUploaded(screenshotId) {
        const screenshot = this.getScreenshot(screenshotId);
        if (screenshot) {
            screenshot.uploaded = true;
        }
    }

    /**
     * Очистить все скриншоты
     */
    clearScreenshots() {
        this.screenshots = [];
        console.log('All screenshots cleared');
    }

    /**
     * Определить уровень серьезности события
     * @param {number} faceCount - Количество лиц
     * @returns {string} Уровень серьезности
     */
    calculateSeverity(faceCount) {
        if (faceCount === 0) return 'warning'; // Участник вышел из кадра
        if (faceCount === 1) return 'normal';   // Нормальная ситуация
        if (faceCount >= 2) return 'critical';  // Посторонние в кадре
        return 'unknown';
    }

    /**
     * Получить статистику детекции
     * @returns {Object} Объект со статистикой
     */
    getStatistics() {
        const totalEvents = this.suspiciousEvents.length;
        const criticalEvents = this.suspiciousEvents.filter(e => e.severity === 'critical').length;
        const warningEvents = this.suspiciousEvents.filter(e => e.severity === 'warning').length;

        const maxFaces = Math.max(...this.suspiciousEvents.map(e => e.currentCount), this.currentFaceCount);

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
     * Уничтожение детектора и освобождение ресурсов
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

        this.faceDetection = null;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceDetector;
}
