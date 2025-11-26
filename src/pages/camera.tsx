import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const CameraPage = () => (
  <div className="section">
    <PageIntro
      title="Camera"
      description="Confirm the webcam position, framing and exposure before joining the call. Subtle tweaks can greatly improve how clear and confident you appear."
      tag="Step 1"
      actionLabel="Re-test"
    />
    <div className={styles.split}>
      <div className={styles.videoBox}>
        <div className={styles.panelTitle}>
          <h2>Preview</h2>
          <Badge label="HD 1080p" />
        </div>
        <div className={styles.videoPreview}>Live camera preview</div>
        <div className={styles.controls}>
          <PrimaryButton label="Center" variant="ghost" />
          <PrimaryButton label="Brightness +" variant="ghost" />
          <PrimaryButton label="Blur background" />
        </div>
      </div>
      <div className={styles.videoBox}>
        <div className={styles.panelTitle}>
          <h2>Quick checklist</h2>
          <span className={styles.muted}>2/3 ready</span>
        </div>
        <ul className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
          <li className="card">
            <h4>Lighting</h4>
            <p className={styles.muted}>Soft front light, no strong backlight.</p>
          </li>
          <li className="card">
            <h4>Background</h4>
            <p className={styles.muted}>Neutral wall, no moving objects.</p>
          </li>
          <li className="card">
            <h4>Eye line</h4>
            <p className={styles.muted}>Camera at eye level, shoulders visible.</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
);

export default CameraPage;
