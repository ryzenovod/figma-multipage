import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const CameraPage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <PageIntro
        title="Камера"
        description="В браузерной IDE видео идёт параллельно с кодом. Камера и освещение фиксируются как часть сессии, чтобы прокторинг видел только нужный кадр."
        tag="Шаг 1 · Видео"
        actionLabel="Перепроверить"
        onAction={() => navigate('/microphone')}
      />
      <div className={styles.split}>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Предпросмотр</h2>
            <Badge label="HD 1080p" />
          </div>
          <div className={styles.videoPreview}>Предпросмотр камеры</div>
          <div className={styles.controls}>
            <PrimaryButton label="По центру" variant="ghost" />
            <PrimaryButton label="Ярче" variant="ghost" />
            <PrimaryButton label="Размытие фона" />
          </div>
        </div>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Быстрый чек-лист</h2>
            <span className={styles.muted}>2/3 готово</span>
          </div>
          <ul className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
            <li className="card">
              <h4>Свет</h4>
              <p className={styles.muted}>Мягкий фронтальный, без сильной подсветки сзади.</p>
            </li>
            <li className="card">
              <h4>Фон</h4>
              <p className={styles.muted}>Нейтральная стена, без движущихся объектов.</p>
            </li>
            <li className="card">
              <h4>Линия глаз</h4>
              <p className={styles.muted}>Камера на уровне глаз, плечи в кадре.</p>
            </li>
          </ul>

          <div className="card" style={{ marginTop: 12 }}>
            <div className={styles.panelTitle}>
              <strong>Что уходит на сервер</strong>
              <span className={styles.muted}>Готово для WebSocket-стрима</span>
            </div>
            <div className={styles.monitorGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Latency &lt;50 мс</div>
                <p className={styles.metricHint}>Пинг камеры перед отправкой кадра.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>DevTools статусы</div>
                <p className={styles.metricHint}>Запрещённые окна блокируются и логируются.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Слежение за вкладками</div>
                <p className={styles.metricHint}>Приватные вкладки скрываются из трансляции.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraPage;
