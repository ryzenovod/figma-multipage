import { useNavigate } from 'react-router-dom';
import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const CameraPage = () => {
  const navigate = useNavigate();

  return (
    <div className="section">
      <PageIntro
        title="Камера"
        description="Проверьте положение веб-камеры, кадрирование и экспозицию перед подключением. Небольшие правки сильно влияют на то, насколько уверенно вы выглядите."
        tag="Шаг 1"
        actionLabel="Перепроверить"
        onAction={() => navigate('/microphone')}
      />
      <div className={styles.split}>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Предпросмотр</h2>
            <Badge label="HD 1080p" />
          </div>
          <div className={styles.videoPreview}>Предпросмотр камеры</div>
          <div className={styles.controls}>
            <PrimaryButton label="По центру" variant="ghost" />
            <PrimaryButton label="Ярче" variant="ghost" />
            <PrimaryButton label="Размытие фона" />
          </div>
        </div>
        <div className={styles.videoBox}>
          <div className={styles.panelTitle}>
            <h2>Быстрый чек-лист</h2>
            <span className={styles.muted}>2/3 готово</span>
          </div>
          <ul className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))' }}>
            <li className="card">
              <h4>Свет</h4>
              <p className={styles.muted}>Мягкий фронтальный, без сильной подсветки сзади.</p>
            </li>
            <li className="card">
              <h4>Фон</h4>
              <p className={styles.muted}>Нейтральная стена, без движущихся объектов.</p>
            </li>
            <li className="card">
              <h4>Линия глаз</h4>
              <p className={styles.muted}>Камера на уровне глаз, плечи в кадре.</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CameraPage;
