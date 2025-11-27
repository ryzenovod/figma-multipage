import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import styles from './AppLayout.module.css';
import pageMap from '../../pages/page-map';

const AppLayout = () => {
  const location = useLocation();
  const current = pageMap.find((page) => page.path === location.pathname) ?? pageMap[0];
<<<<<<< HEAD
  
 
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
=======

  return (
    <div className={styles.wrapper}>
      <Header pages={pageMap} />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.breadcrumbs}>Главная / {current.label}</div>
          <Outlet />
        </div>
      </main>
      <Footer />
>>>>>>> 54e247c10a677c793edcc2a5e2e49c1597e4b311
    </div>
  );
};

<<<<<<< HEAD
export default AppLayout;
=======
export default AppLayout;
>>>>>>> 54e247c10a677c793edcc2a5e2e49c1597e4b311
