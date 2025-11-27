import Badge from '../ui/Badge';
import styles from './StepCard.module.css';

interface StepCardProps {
  title: string;
  description: string;
  badge?: string;
}

const StepCard = ({ title, description, badge }: StepCardProps) => (
  <div className={styles.card}>
    <div className={styles.header}>
      <h3>{title}</h3>
      {badge ? <Badge label={badge} /> : null}
    </div>
    <p className={styles.description}>{description}</p>
  </div>
);

export default StepCard;
