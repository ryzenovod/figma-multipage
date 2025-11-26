import PageIntro from '../components/sections/PageIntro';
import StepCard from '../components/sections/StepCard';
import styles from './page.module.css';

const BeforeInterviewPage = () => (
  <div className="section">
    <PageIntro
      title="Перед собеседованием"
      description="Пройдите короткий чек-лист, чтобы убедиться в стабильном соединении, настроенной камере, микрофоне и свете. Спокойная подготовка помогает начать разговор сфокусировано."
      tag="Подготовка"
      actionLabel="Начать проверку"
    />
    <div className={`${styles.grid} grid`}>
      <StepCard
        title="Тест соединения"
        description="Проверьте стабильность сети и задержку. Мы отслеживаем скачки и подскажем, если стоит перейти на проводное подключение."
        badge="Хорошо"
      />
      <StepCard
        title="Настройка места"
        description="Расположите камеру на уровне глаз, фон — простой и светлый. Избегайте подсветки сзади и закройте лишние вкладки."
      />
      <StepCard
        title="Документы"
        description="Держите резюме, портфолио и описание вакансии в соседнем окне. Закрепите их для быстрого доступа при демонстрации экрана."
      />
    </div>
  </div>
);

export default BeforeInterviewPage;
