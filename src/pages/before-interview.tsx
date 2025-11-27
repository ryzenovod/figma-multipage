import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import StepCard from '../components/sections/StepCard';
import styles from './page.module.css';

const BeforeInterviewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <PageIntro
        title="Перед собеседованием"
        description="Это браузерная IDE для VibeCode Jam с включённым прокторингом. Пройдите чек-лист: мы отслеживаем сеть, камеру, микрофон, чтобы ваша сессия передачи кода в облако была стабильной."
        tag="Подготовка · IDE"
        actionLabel="Начать проверку"
        onAction={() => navigate('/camera')}
      />
      <div className={`${styles.grid} grid`}>
        <StepCard
          title="Тест соединения"
          description="Проверьте стабильность сети и задержку. События отправляются в бек по WebSocket <50мс, чтобы IDE не обрывалась."
          badge="Хорошо"
        />
        <StepCard
          title="Настройка места"
          description="Камера на уровне глаз, фон — простой и светлый. Мгновенно сигнализируем, если обнаружен яркий фон или низкая освещённость."
        />
        <StepCard
          title="Документы"
          description="Держите резюме, портфолио и описание вакансии в соседнем окне. Закрепите их для быстрого доступа при демонстрации экрана."
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className={styles.panelTitle}>
          <h2>Мониторинг прокторинга</h2>
          <span className={styles.muted}>Работает незаметно, готов к подключению к FastAPI</span>
        </div>
        <div className={styles.monitorGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>Ctrl+C / Ctrl+V</div>
            <p className={styles.metricHint}>Ловим вставки кода &gt;500 символов (+25 баллов риска).</p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>DevTools</div>
            <p className={styles.metricHint}>Фиксируем F12/⌥⌘I и консоль, событие уходит в поток.</p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>AI-расширения</div>
            <p className={styles.metricHint}>Ищем Copilot, ChatGPT и подобные (+30 баллов риска).</p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>Скоринг 0–100%</div>
            <p className={styles.metricHint}>Облако SciBox + qwen3-coder / bge-m3. &gt;70 = красный уровень.</p>
          </div>
        </div>
        <p className={styles.muted} style={{ marginTop: 10 }}>
          «Мы создали интеллектуальную систему прокторинга, которая не просто фиксирует нарушения, а использует искусственный
          интеллект для оценки оригинальности кода. Система работает незаметно для участника, собирая поведенческие паттерны
          и отправляя финальное решение на анализ в облачную LLM. В результате организаторы получают не просто логи, а понятную
          оценку риска с рекомендациями».
        </p>
      </div>
    </div>
  );
};

export default BeforeInterviewPage;
