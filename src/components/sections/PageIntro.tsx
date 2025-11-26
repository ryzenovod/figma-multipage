import PrimaryButton from '../ui/PrimaryButton';
import Badge from '../ui/Badge';
import styles from './PageIntro.module.css';

interface PageIntroProps {
  title: string;
  description: string;
  tag?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const PageIntro = ({ title, description, tag, actionLabel, onAction }: PageIntroProps) => (
  <div className={`${styles.intro} card`}>
    <div>
      {tag ? <Badge label={tag} /> : null}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {actionLabel ? <PrimaryButton label={actionLabel} onClick={onAction} /> : null}
    </div>
    <div className={styles.badgeBox}>
      <div className={styles.metric}>
        <span className={styles.metricLabel}>Уверенность</span>
        <strong className={styles.metricValue}>92%</strong>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricLabel}>Осталось времени</span>
        <strong className={styles.metricValue}>15:30</strong>
      </div>
    </div>
  </div>
);

export default PageIntro;
