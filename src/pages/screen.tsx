import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import Badge from '../components/ui/Badge';
import PrimaryButton from '../components/ui/PrimaryButton';
import styles from './page.module.css';

const ScreenPage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <PageIntro
        title="Экран"
        description="IDE выводит код, слайды и окна демо. Приватные вкладки скрыты, открытые окна логируются в поток прокторинга."
        tag="Шаг 3 · Шеринг"
        actionLabel="Открыть презентер"
        onAction={() => navigate('/interview')}
      />

      <div className={styles.split}>
        <div className={styles.screenBox}>
          <div className={styles.panelTitle}>
            <h2>Выбранные окна</h2>
            <Badge label="Готово" tone="success" />
          </div>
          <div className={styles.chipRow}>
            <span className={styles.chip}>Chrome — Coding Exercise</span>
            <span className={styles.chip}>Slides — Portfolio</span>
            <span className={styles.chip}>Notes — Private</span>
          </div>
          <p className={styles.muted} style={{ marginTop: 12 }}>
            Выберите, что показывать. Скрытые вкладки останутся приватными.
          </p>
          <div className={styles.videoPreview} style={{ height: 260 }}>
            Превью трансляции
          </div>
        </div>
        <div className={styles.screenBox}>
          <div className={styles.panelTitle}>
            <h2>Настройки</h2>
            <span className={styles.muted}>Качество и приватность</span>
          </div>
          <ul className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <li className="card">
              <div className={styles.panelTitle}>
                <strong>Разрешение</strong>
                <Badge label="1080p" />
              </div>
              <p className={styles.muted}>Баланс между чёткостью и трафиком.</p>
            </li>
            <li className="card">
              <div className={styles.panelTitle}>
                <strong>Заметки ведущего</strong>
                <Badge label="Приватно" tone="warning" />
              </div>
              <p className={styles.muted}>Заметки видите только вы.</p>
            </li>
            <li className="card">
              <div className={styles.panelTitle}>
                <strong>Запись</strong>
                <Badge label="Выкл" />
              </div>
              <p className={styles.muted}>Включите при старте интервью.</p>
              <div className={styles.controls}>
                <PrimaryButton label="Включить запись" />
                <PrimaryButton label="Открыть папку" variant="ghost" />
              </div>
            </li>
          </ul>

          <div className="card" style={{ marginTop: 12 }}>
            <div className={styles.panelTitle}>
              <strong>Аналитика окна</strong>
              <span className={styles.muted}>Отправляется в облако SciBox</span>
            </div>
            <div className={styles.monitorGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Объём вставок</div>
                <p className={styles.metricHint}>Подсчёт символов на окне IDE.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>Риск &gt;70</div>
                <p className={styles.metricHint}>Красный статус — вероятное читерство.</p>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>DevTools</div>
                <p className={styles.metricHint}>Фиксируем открытие инструментов разработчика.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenPage;
