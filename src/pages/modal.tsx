import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const ModalPage = () => (
  <div className="section">
    <PageIntro
      title="Модалка"
      description="Use modals to surface confirmations during the interview without blocking the flow. Keep copy concise, with clear primary and secondary actions."
      tag="UI pattern"
      actionLabel="Preview modal"
    />

    <div className={`${styles.modalPreview} grid`} style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div>
        <div className={styles.panelTitle}>
          <h2>Overlay</h2>
          <Badge label="New" />
        </div>
        <div className={styles.modalOverlay}>
          <p style={{ marginBottom: 12 }}>You are about to start recording the session.</p>
          <div className={styles.controls}>
            <PrimaryButton label="Start" />
            <PrimaryButton label="Cancel" variant="ghost" />
          </div>
        </div>
      </div>
      <div>
        <div className={styles.panelTitle}>
          <h2>Toast</h2>
          <span className={styles.muted}>Non-blocking</span>
        </div>
        <div className="card">
          <strong>Recording saved</strong>
          <p className={styles.muted}>Find the file in your interview folder.</p>
          <div className={styles.controls}>
            <PrimaryButton label="Open folder" variant="ghost" />
            <PrimaryButton label="Close" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ModalPage;
