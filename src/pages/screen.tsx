import PageIntro from '../components/sections/PageIntro';
import Badge from '../components/ui/Badge';
import PrimaryButton from '../components/ui/PrimaryButton';
import styles from './page.module.css';

const ScreenPage = () => (
  <div className="section">
    <PageIntro
      title="Screen"
      description="Prepare to share slides, code or a demo window. Pin your preferred sources and confirm that sensitive tabs are hidden before you present."
      tag="Step 3"
      actionLabel="Open presenter"
    />

    <div className={styles.split}>
      <div className={styles.screenBox}>
        <div className={styles.panelTitle}>
          <h2>Selected windows</h2>
          <Badge label="Ready" tone="success" />
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chip}>Chrome — Coding Exercise</span>
          <span className={styles.chip}>Slides — Portfolio</span>
          <span className={styles.chip}>Notes — Private</span>
        </div>
        <p className={styles.muted} style={{ marginTop: 12 }}>
          Choose what to broadcast. Hidden tabs stay private.
        </p>
        <div className={styles.videoPreview} style={{ height: 260 }}>
          Screen share preview
        </div>
      </div>
      <div className={styles.screenBox}>
        <div className={styles.panelTitle}>
          <h2>Settings</h2>
          <span className={styles.muted}>Quality &amp; privacy</span>
        </div>
        <ul className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <li className="card">
            <div className={styles.panelTitle}>
              <strong>Resolution</strong>
              <Badge label="1080p" />
            </div>
            <p className={styles.muted}>Balanced for clarity and bandwidth.</p>
          </li>
          <li className="card">
            <div className={styles.panelTitle}>
              <strong>Presenter notes</strong>
              <Badge label="Private" tone="warning" />
            </div>
            <p className={styles.muted}>Notes stay visible only to you.</p>
          </li>
          <li className="card">
            <div className={styles.panelTitle}>
              <strong>Recording</strong>
              <Badge label="Off" />
            </div>
            <p className={styles.muted}>Enable when interview starts.</p>
            <div className={styles.controls}>
              <PrimaryButton label="Enable recording" />
              <PrimaryButton label="Open folder" variant="ghost" />
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
);

export default ScreenPage;
