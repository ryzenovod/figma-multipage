import React, { useState } from 'react';
import styles from './page.module.css';

const InterviewChatPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'Саша',
      text: 'Андрей, привет! Меня зовут Саша и сетевой в Риву президента твой интересно.',
      time: '01:24'
    },
    {
      id: 2,
      sender: 'Андрей', 
      text: 'Привет! Моей врагу! Андрей, а хочешь развернуться… У меня больше 30 лет опыта.',
      time: '01:24'
    },
    {
      id: 3,
      sender: 'Саша',
      text: '',
      time: '01:24'
    }
  ]);

  return (
    <div className={`${styles.split} ${styles['grid-chat-box']}`} style={{ gap: '20px', height: '100vh', padding: '20px' }}>
      {/* Большой экран вебки */}
      <div className={styles.videoBox} style={{ flex: 1 }}>
        <div className={styles.panelTitle}>
          <h2>Веб-камера</h2>
          <span className={styles.muted}>Андрей</span>
        </div>
        
        <div className={styles.videoPreview} style={{ height: '400px' }}>
          Видеопоток интервью
        </div>
        
        {/* Кнопки управления */}
        <div className={styles.controls}>
          <button className={`${styles.btn} ${styles['btn-secondary']}`}>
            📹 Камера
          </button>
          <button className={`${styles.btn} ${styles['btn-secondary']}`}>
            🎤 Микрофон
          </button>
          <button className={`${styles.btn} ${styles['btn-primary']}`}>
            📞 Скинь звонок
          </button>
        </div>
      </div>

      {/* Чат */}
      <div className={`interview-chat ${styles.card}`} style={{ maxWidth: '400px' }}>
        <div className="chat-header">
          <div className="chat-time">01:24</div>
          <div className="chat-participants">
            <span className="chat-participant">Саша</span>
            <span className="chat-divider">|</span>
            <span className="chat-participant">Андрей</span>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.sender === 'Саша' ? 'sasha' : 'andrey'}`}
            >
              <div className="message-header">
                <span className="message-sender">{message.sender}</span>
                <span className="message-time">{message.time}</span>
              </div>
              <div className="message-text">
                {message.text || '\u00A0'}
              </div>
            </div>
          ))}
        </div>

        {/* Поле ввода сообщения */}
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea 
              className="chat-input"
              placeholder="Введите сообщение..."
              rows={1}
            />
            <button className="chat-send-btn">
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewChatPage;