import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const MicrophonePage = () => (
  <div className="section">
    <PageIntro
      title="Microphone"
      description="Test your input levels and noise suppression. We show a live waveform so you can quickly spot clipping or volume drops."
      tag="Step 2"
      actionLabel="Start recording"
    />

    <div className={styles.split}>
      <div className={styles.audioBox}>
        <div className={styles.panelTitle}>
          <h2>Waveform</h2>
          <Badge label="Noise filter on" tone="success" />
        </div>
        <div className={styles.waveform} aria-label="Audio waveform placeholder" />
        <div className={styles.controls}>
          <PrimaryButton label="Play sample" variant="ghost" />
          <PrimaryButton label="Reduce noise" />
          <PrimaryButton label="Mute" variant="ghost" />
        </div>
      </div>
      <div className={styles.audioBox}>
        <div className={styles.panelTitle}>
          <h2>Devices</h2>
          <span className={styles.muted}>Select preferred input</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Device</th>
              <th>Status</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>USB Studio Mic</td>
              <td>
                <Badge label="Active" tone="success" />
              </td>
              <td>82%</td>
            </tr>
            <tr>
              <td>MacBook Mic</td>
              <td>
                <Badge label="Idle" />
              </td>
              <td>36%</td>
            </tr>
            <tr>
              <td>Bluetooth Headset</td>
              <td>
                <Badge label="Disconnected" tone="warning" />
              </td>
              <td>--</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default MicrophonePage;
