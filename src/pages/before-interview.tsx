import PageIntro from '../components/sections/PageIntro';
import StepCard from '../components/sections/StepCard';
import styles from './page.module.css';

const BeforeInterviewPage = () => (
  <div className="section">
    <PageIntro
      title="Before the interview"
      description="Walk through a short checklist to ensure your connection, camera, microphone and lighting are ready. A calm pre-flight helps you enter the conversation focused."
      tag="Preparation"
      actionLabel="Begin checks"
    />
    <div className={`${styles.grid} grid`}>
      <StepCard
        title="Connection test"
        description="Verify network stability and latency. We automatically detect jitter and recommend switching to wired connection if spikes appear."
        badge="Good"
      />
      <StepCard
        title="Space setup"
        description="Position yourself at eye-level with the camera. Keep background simple and light. Avoid backlight and close unused tabs."
      />
      <StepCard
        title="Documents"
        description="Keep your resume, portfolio and job description open in a nearby window. You can pin them to quick access for screen sharing."
      />
    </div>
  </div>
);

export default BeforeInterviewPage;
