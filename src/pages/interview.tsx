import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const InterviewPage = () => (
  <div className="section">
    <PageIntro
      title="Interview"
      description="All systems are green. Use the dashboard to keep an eye on time, recording status and quick actions while you speak with the interviewer."
      tag="Live"
      actionLabel="Join room"
    />

    <div className={styles.split}>
      <div className={styles.videoBox}>
        <div className={styles.panelTitle}>
          <h2>Stage</h2>
          <Badge label="Recording" />
        </div>
        <div className={styles.videoPreview}>Interview view</div>
        <div className={styles.controls}>
          <PrimaryButton label="Toggle camera" variant="ghost" />
          <PrimaryButton label="Toggle mic" variant="ghost" />
          <PrimaryButton label="Share screen" />
        </div>
      </div>
      <div className={styles.videoBox}>
        <div className={styles.panelTitle}>
          <h2>Notes &amp; agenda</h2>
          <span className={styles.muted}>Visible only to you</span>
        </div>
        <ul className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <li className="card">
            <strong>Highlights</strong>
            <p className={styles.muted}>Mention relevant projects and align on role expectations.</p>
          </li>
          <li className="card">
            <strong>Questions</strong>
            <p className={styles.muted}>Culture, growth path, feedback cadence.</p>
          </li>
          <li className="card">
            <strong>Next steps</strong>
            <p className={styles.muted}>Confirm follow-up and thank the interviewer.</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
);

export default InterviewPage;
