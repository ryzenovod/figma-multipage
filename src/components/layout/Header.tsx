import { NavLink } from 'react-router-dom';
import styles from './Header.module.css';
import pageMap from '../../pages/page-map';
import PrimaryButton from '../ui/PrimaryButton';

interface HeaderProps {
  pages: typeof pageMap;
}

const Header = ({ pages }: HeaderProps) => (
  <header className={styles.header}>
    <div className="container">
      <div className={styles.inner}>
        <div className={styles.brand}>VibeCode IDE</div>
        <nav className={styles.nav} aria-label="Главная навигация">
          {pages.map((page) => (
            <NavLink
              key={page.path}
              to={page.path}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
            {page.label}
            </NavLink>
          ))}
        </nav>
        <PrimaryButton label="Запустить сессию" variant="ghost" size="sm" />
      </div>
    </div>
  </header>
);

export default Header;
