import styles from './Badge.module.css';

interface BadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'info';
}

const Badge = ({ label, tone = 'info' }: BadgeProps) => (
  <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>
);

export default Badge;
