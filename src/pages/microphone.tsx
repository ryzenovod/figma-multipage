import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const MicrophonePage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <PageIntro
        title="Микрофон"
        description="IDE слушает голос, а прокторинг отслеживает шумы и вставки кода. Волна показывает клиппинг, а метрики готовы уйти в FastAPI."
        tag="Шаг 2 · Аудио"
        actionLabel="Начать запись"
        onAction={() => navigate('/screen')}
      />

      <div className={styles.split}>
        <div className={styles.audioBox}>
          <div className={styles.panelTitle}>
            <h2>Волна</h2>
            <Badge label="Шумоподавление" tone="success" />
          </div>
          <div className={styles.waveform} aria-label="Audio waveform placeholder" />
          <div className={styles.controls}>
            <PrimaryButton label="Проиграть пример" variant="ghost" />
            <PrimaryButton label="Убрать шум" />
            <PrimaryButton label="Заглушить" variant="ghost" />
          </div>
        </div>
        <div className={styles.audioBox}>
          <div className={styles.panelTitle}>
            <h2>Устройства</h2>
            <span className={styles.muted}>Выберите основной источник</span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Устройство</th>
                <th>Статус</th>
                <th>Уровень</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>USB Studio Mic</td>
                <td>
                  <Badge label="Активно" tone="success" />
                </td>
                <td>82%</td>
              </tr>
              <tr>
                <td>MacBook Mic</td>
                <td>
                  <Badge label="Не используется" />
                </td>
                <td>36%</td>
              </tr>
              <tr>
                <td>Bluetooth Headset</td>
                <td>
                  <Badge label="Отключено" tone="warning" />
                </td>
                <td>--</td>
              </tr>
            </tbody>
          </table>

          <div className="card" style={{ marginTop: 12 }}>
            <div className={styles.panelTitle}>
              <strong>Поведенческий анализ</strong>
              <span className={styles.muted}>Для скоринга 0–100%</span>
            </div>
            <div className={styles.monitorGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Вставки &gt;5</div>
                <p className={styles.metricHint}>+20 баллов риска, событие шлём сразу.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Шум &lt; -42 dB</div>
                <p className={styles.metricHint}>Фильтр шумоподавления, готов к API.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>AI вердикт</div>
                <p className={styles.metricHint}>qwen3-coder + bge-m3 дают «Оригинально / Копия».</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MicrophonePage;
