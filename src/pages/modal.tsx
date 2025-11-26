import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const ModalPage = () => (
  <div className="section">
    <PageIntro
      title="Модалка"
      description="Используйте модальные окна, чтобы показывать подтверждения во время интервью, не останавливая процесс. Держите текст коротким и понятным, разделяйте главное и второстепенное действие."
      tag="UI-паттерн"
      actionLabel="Посмотреть модалку"
    />

    <div className={`${styles.modalPreview} grid`} style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div>
        <div className={styles.panelTitle}>
          <h2>Оверлей</h2>
          <Badge label="New" />
        </div>
        <div className={styles.modalOverlay}>
          <p style={{ marginBottom: 12 }}>Вы собираетесь начать запись сессии.</p>
          <div className={styles.controls}>
            <PrimaryButton label="Начать" />
            <PrimaryButton label="Отмена" variant="ghost" />
          </div>
        </div>
      </div>
      <div>
        <div className={styles.panelTitle}>
          <h2>Тост</h2>
          <span className={styles.muted}>Без блокировки</span>
        </div>
        <div className="card">
          <strong>Запись сохранена</strong>
          <p className={styles.muted}>Файл доступен в папке интервью.</p>
          <div className={styles.controls}>
            <PrimaryButton label="Открыть папку" variant="ghost" />
            <PrimaryButton label="Закрыть" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ModalPage;
