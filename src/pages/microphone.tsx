import PageIntro from '../components/sections/PageIntro';
import PrimaryButton from '../components/ui/PrimaryButton';
import Badge from '../components/ui/Badge';
import styles from './page.module.css';

const MicrophonePage = () => (
  <div className="section">
    <PageIntro
      title="Микрофон"
      description="Проверьте уровень входа и шумоподавление. Живая волна помогает сразу увидеть клиппинг или просадки громкости."
      tag="Шаг 2"
      actionLabel="Начать запись"
    />

    <div className={styles.split}>
      <div className={styles.audioBox}>
        <div className={styles.panelTitle}>
          <h2>Волна</h2>
          <Badge label="Шумоподавление" tone="success" />
        </div>
        <div className={styles.waveform} aria-label="Audio waveform placeholder" />
        <div className={styles.controls}>
          <PrimaryButton label="Проиграть пример" variant="ghost" />
          <PrimaryButton label="Убрать шум" />
          <PrimaryButton label="Заглушить" variant="ghost" />
        </div>
      </div>
      <div className={styles.audioBox}>
        <div className={styles.panelTitle}>
          <h2>Устройства</h2>
          <span className={styles.muted}>Выберите основной источник</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Устройство</th>
              <th>Статус</th>
              <th>Уровень</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>USB Studio Mic</td>
              <td>
                <Badge label="Активно" tone="success" />
              </td>
              <td>82%</td>
            </tr>
            <tr>
              <td>MacBook Mic</td>
              <td>
                <Badge label="Не используется" />
              </td>
              <td>36%</td>
            </tr>
            <tr>
              <td>Bluetooth Headset</td>
              <td>
                <Badge label="Отключено" tone="warning" />
              </td>
              <td>--</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default MicrophonePage;
