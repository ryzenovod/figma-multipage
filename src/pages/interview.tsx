import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const InterviewPage = () => {
  const [isEndCallOpen, setIsEndCallOpen] = useState(false);
  const navigate = useNavigate();

  const closeModal = () => setIsEndCallOpen(false);

  return (
    <div className="section">
      <PageIntro
        title="Интервью"
        description="В браузерной IDE идёт живой созвон. Видеопоток, код и метрики прокторинга отправляются на сервер для скоринга риска."
        tag="В эфире · IDE"
        actionLabel="Присоединиться"
      />

      <div className={styles.split}>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Сцена</h2>
            <Badge label="Запись" />
          </div>
          <div className={styles.videoPreview}>Окно интервью</div>
          <div className={styles.controls}>
            <PrimaryButton label="Камера" variant="ghost" />
            <PrimaryButton label="Микрофон" variant="ghost" />
            <PrimaryButton label="Поделиться экраном" />
            <PrimaryButton label="Завершить звонок" variant="ghost" onClick={() => setIsEndCallOpen(true)} />
          </div>
        </div>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Заметки и план</h2>
            <span className={styles.muted}>Видно только вам</span>
          </div>
          <ul className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <li className="card">
              <strong>Основное</strong>
              <p className={styles.muted}>Упомяните релевантные проекты и согласуйте ожидания по роли.</p>
            </li>
            <li className="card">
              <strong>Вопросы</strong>
              <p className={styles.muted}>Культура, рост, частота фидбэка.</p>
            </li>
            <li className="card">
              <strong>Следующие шаги</strong>
              <p className={styles.muted}>Подтвердите дальнейшие шаги и поблагодарите интервьюера.</p>
            </li>
          </ul>
        </div>
      </div>

      <div className={`${styles.grid} grid`} style={{ marginTop: 16 }}>
        <div className={styles.codePane}>
          <div className={styles.codeHeader}>
            <span>src/solution.ts · VibeCode IDE</span>
            <div className={styles.codeStatus}>
              <span>Ctrl+V: 2</span>
              <span>DevTools: закрыто</span>
              <span>Риск: 18/100</span>
            </div>
          </div>
          <div className={styles.codeContent}>
            {`// Реалтайм-код в браузерной IDE
export const detectCheating = (events) => {
  const pasteEvents = events.filter((e) => e.type === 'paste');
  const largePastes = pasteEvents.filter((e) => e.size > 500).length;
  const devtoolsOpen = events.some((e) => e.type === 'devtools');
  const risk = (largePastes * 25) + (pasteEvents.length > 5 ? 20 : 0) + (devtoolsOpen ? 30 : 0);
  return Math.min(risk, 100);
};

// Подключение к FastAPI WebSocket готово к интеграции
// ws://backend/events -> события для SciBox скоринга
`}
          </div>
        </div>

        <div className="card">
          <div className={styles.panelTitle}>
            <h3>Мониторинг в реальном времени</h3>
            <Badge label="WebSocket" />
          </div>
          <div className={styles.monitorGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>Пасты: 2</div>
              <p className={styles.metricHint}>Объём 340 символов. Лимит 500.</p>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>DevTools: закрыто</div>
              <p className={styles.metricHint}>Последнее событие: не обнаружено.</p>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>Расширения: нет</div>
              <p className={styles.metricHint}>Copilot / ChatGPT не активны.</p>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>AI вердикт</div>
              <p className={styles.metricHint}>Оригинальное решение (qwen3 + bge-m3).</p>
            </div>
          </div>
        </div>
      </div>

      {isEndCallOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Подтверждение завершения звонка">
          <div className={styles.modalCard}>
            <div className={styles.panelTitle}>
              <h3>Завершить звонок?</h3>
              <Badge label="Подтверждение" />
            </div>
            <p className={styles.muted} style={{ marginBottom: 12 }}>
              Сессия остановится, запись сохранится в папке интервью. Убедитесь, что сообщили о следующих шагах.
            </p>
            <div className={styles.controls}>
              <PrimaryButton
                label="Выйти"
                onClick={() => {
                  closeModal();
                  navigate('/');
                }}
              />
              <PrimaryButton label="Остаться" variant="ghost" onClick={closeModal} />
            </div>

            <div className={styles.toastCard} role="status">
              <strong>Запись сохранена</strong>
              <p className={styles.muted}>Файл доступен в разделе интервью.</p>
              <div className={styles.controls}>
                <PrimaryButton label="Открыть папку" variant="ghost" />
                <PrimaryButton label="К встречам" onClick={() => navigate('/')} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InterviewPage;
