import styles from './Footer.module.css';
import pageMap from '../../pages/page-map';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className={styles.footer}>
    <div className="container">
      <div className={styles.inner}>
        <div>
          <div className={styles.logo}>TalkReady</div>
          <p className={styles.muted}>Tools to get ready for remote interviews.</p>
        </div>
        <div className={styles.links}>
          {pageMap.map((page) => (
            <Link key={page.path} to={page.path} className={styles.link}>
              {page.label}
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.bottom}>© {new Date().getFullYear()} TalkReady. All rights reserved.</div>
    </div>
  </footer>
);

export default Footer;
