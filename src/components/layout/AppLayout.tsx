import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import styles from './AppLayout.module.css';
import pageMap from '../../pages/page-map';

const AppLayout = () => {
  const location = useLocation();
  const current = pageMap.find((page) => page.path === location.pathname) ?? pageMap[0];

  return (
    <div className={styles.wrapper}>
      <Header pages={pageMap} />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.breadcrumbs}>Home / {current.label}</div>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;
