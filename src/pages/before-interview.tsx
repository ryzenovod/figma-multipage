import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import PrimaryButton from '../components/ui/PrimaryButton';
import styles from './page.module.css';

const riskMetrics = [
  { title: 'Пасты', value: '7', note: '2 крупных (>500 симв.)' },
  { title: 'Объём вставок', value: '2 340 симв.', note: 'Агрегация за 5 минут' },
  { title: 'DevTools', value: 'закрыто', note: 'последняя попытка не удалась' },
  { title: 'Расширения', value: 'AI не обнаружены', note: 'Copilot/ChatGPT off' },
  { title: 'Риск', value: '62 / 100', note: 'жёлтая зона, >70 = красная' },
  { title: 'AI вердикт', value: 'Оригинально', note: 'qwen3-coder + bge-m3' },
];

const pipeline = [
  {
    title: 'Клиентский мониторинг',
    detail: 'JS-агент ловит Ctrl+C/V, DevTools, вкладки, расширения. Событие уходит в поток <50 мс.',
  },
  {
    title: 'Серверный анализ',
    detail: 'FastAPI + WebSocket. Подсчёт частоты вставок, размера фрагментов и статуса DevTools.',
  },
  {
    title: 'AI-проверка SciBox',
    detail: 'qwen3-coder и bge-m3 строят отпечаток кода, сравнивают с базой. Скоринг 3–7 секунд.',
  },
  {
    title: 'Рекомендация',
    detail: '0–30: зелёный, 31–70: жёлтый, 71–100: красный. Организатор видит готовый вердикт.',
  },
];

const riskRules = [
  ['0–30', '🟢 Низкий', 'Честное решение'],
  ['31–70', '🟡 Средний', 'Нужно проверить вручную'],
  ['71–100', '🔴 Высокий', 'Вероятное читерство'],
  ['+25', 'Большие вставки', '>500 символов за раз'],
  ['+20', 'Частые вставки', '>5 раз за короткий период'],
  ['+30', 'AI-расширения', 'Copilot / ChatGPT в браузере'],
  ['+50', 'AI вердикт «Копия»', 'SciBox обнаружил плагиат'],
];

const BeforeInterviewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <div className={styles.hero}>
        <div className={styles.heroCard}>
          <Badge label="VibeCode Jam · прокторинг" />
          <h1 className={styles.heroTitle}>Интеллектуальная защита от читерства для онлайн-хакатона</h1>
          <p className={styles.heroSubtitle}>
            Мы создаём фронтенд для прокторинга: JS-агент следит за поведением, FastAPI поток анализирует риски,
            SciBox LLM сверяет код на оригинальность. Всё работает незаметно, но даёт прозрачный скоринг 0–100.
          </p>
          <div className={styles.heroActions}>
            <PrimaryButton label="Запустить проверку" onClick={() => navigate('/camera')} />
            <PrimaryButton label="Посмотреть дашборд" variant="ghost" onClick={() => navigate('/interview')} />
            <span className={styles.badgeNeutral}>Сессия интервью: 1 час</span>
          </div>
          <div className={styles.statPills}>
            <div className={styles.statPill}>
              <div className={styles.statValue}>WS &lt; 50 мс</div>
              <div className={styles.statLabel}>Реалтайм передача событий</div>
            </div>
            <div className={styles.statPill}>
              <div className={styles.statValue}>AI 3–7 с</div>
              <div className={styles.statLabel}>Облачная проверка SciBox</div>
            </div>
            <div className={styles.statPill}>
              <div className={styles.statValue}>Docker-ready</div>
              <div className={styles.statLabel}>Никакого Firebase, только контейнер</div>
            </div>
          </div>
        </div>

        <div className={styles.heroBoard}>
          <div className={styles.panelTitle}>
            <h2>Организаторский дашборд</h2>
            <Badge label="Live" tone="success" />
          </div>
          <div className={styles.monitorGrid}>
            {riskMetrics.map((metric) => (
              <div key={metric.title} className={styles.metricCard}>
                <div className={styles.metricValue}>{metric.value}</div>
                <p className={styles.metricHint}>{metric.title}</p>
                <p className={styles.muted}>{metric.note}</p>
              </div>
            ))}
          </div>
          <p className={styles.muted}>
            «Мы создали интеллектуальную систему прокторинга, которая не просто фиксирует нарушения, а использует искусственный
            интеллект для оценки оригинальности кода. Система работает незаметно для участника, собирая поведенческие паттерны
            и отправляя финальное решение на анализ в облачную LLM. В результате организаторы получают не просто логи, а понятную
            оценку риска с рекомендациями».
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.sectionHeader}>
          <h2>Архитектура и ограничения</h2>
          <span className={styles.badgeNeutral}>Без внешних API · только SciBox</span>
        </div>
        <div className={styles.gridHighlights}>
          <div className={styles.highlightCard}>
            <strong>LLM-окружение</strong>
            <p className={styles.muted}>Единственная точка — SciBox (qwen3-coder, bge-m3). Любые внешние API отключены.</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>Контейнеризация</strong>
            <p className={styles.muted}>Деплой через Docker вместо Firebase: предсказуемые зависимости, запуск с ноутбука ментора.</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>Доп. модели</strong>
            <p className={styles.muted}>Разрешены классические модели (XGBoost) для скоринга вероятности читерства.</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>Производительность</strong>
            <p className={styles.muted}>Без аудио/голосовых моделей. UI оптимизирован под быстрый отклик и лёгкий трафик.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.sectionHeader}>
          <h2>Пайплайн проверки</h2>
          <Badge label="Realtime + AI" />
        </div>
        <div className={styles.timeline}>
          {pipeline.map((step, index) => (
            <div key={step.title} className={styles.timelineCard}>
              <div className={styles.timelineStep}>Шаг {index + 1}</div>
              <h4>{step.title}</h4>
              <p className={styles.muted}>{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.sectionHeader}>
          <h2>Риск-матрица</h2>
          <Badge label="Скоринг 0–100" />
        </div>
        <table className={styles.riskTable}>
          <thead>
            <tr>
              <th>Правило</th>
              <th>Статус</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {riskRules.map(([rule, status, note]) => (
              <tr key={rule}>
                <td>{rule}</td>
                <td>{status}</td>
                <td className={styles.muted}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.sectionHeader}>
          <h2>Резюме и собеседование</h2>
          <Badge label="Таймер 1 час" />
        </div>
        <div className={styles.gridHighlights}>
          <div className={styles.highlightCard}>
            <strong>Анализ резюме</strong>
            <p className={styles.muted}>Парсим CV, выделяем сильные стороны, подсказываем интервьюеру, в чём кандидат «глубокий».</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>План интервью</strong>
            <p className={styles.muted}>Чёткий тайм-слот на час: быстрые вопросы + глубокие задачи, фиксируем переходы.</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>Полевые условия</strong>
            <p className={styles.muted}>Реалтайм мониторинг без остановки кандидата: собираем доказательства, не блокируя поток.</p>
          </div>
          <div className={styles.highlightCard}>
            <strong>Люди на финал</strong>
            <p className={styles.muted}>Если выходим в финал — срочно ищем людей. «Мёртвые души» можно провести через поддержку.</p>
          </div>
        </div>
        <div className={styles.callout} style={{ marginTop: 12 }}>
          Главная ценность: организатору не нужно вручную проверять каждого участника — AI делает это объективно и сразу после
          отправки решения.
        </div>
      </div>
    </div>
  );
};

export default BeforeInterviewPage;
