import styles from './PrimaryButton.module.css';

type Variant = 'solid' | 'ghost';
type Size = 'md' | 'sm';

interface PrimaryButtonProps {
  label: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
}

const PrimaryButton = ({ label, onClick, variant = 'solid', size = 'md' }: PrimaryButtonProps) => (
  <button type="button" onClick={onClick} className={`${styles.button} ${styles[variant]} ${styles[size]}`}>
    {label}
  </button>
);

export default PrimaryButton;
