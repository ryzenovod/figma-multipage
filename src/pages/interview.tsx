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
        description="Все системы в порядке. Используйте панель, чтобы следить за временем, записью и быстрыми действиями во время разговора."
        tag="В эфире"
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
