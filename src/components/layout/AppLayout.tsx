import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import styles from './AppLayout.module.css';
import pageMap from '../../pages/page-map';

const AppLayout = () => {
  const location = useLocation();
  const current = pageMap.find((page) => page.path === location.pathname) ?? pageMap[0];
  
 
  const noHeaderPages = ['/chat'];
  const showHeader = !noHeaderPages.includes(location.pathname);

  return (
    <div className={styles.wrapper}>
      {showHeader && <Header pages={pageMap} />}
      <main className={styles.main}>
        <div className="container">
          {showHeader && <div className={styles.breadcrumbs}>Главная / {current.label}</div>}
          <Outlet />
        </div>
      </main>
      {showHeader && <Footer />}
    </div>
  );
};

export default AppLayout;