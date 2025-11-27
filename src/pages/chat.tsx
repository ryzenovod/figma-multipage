import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './page.module.css';

const InterviewChatPage = () => {
  const navigate = useNavigate();
    
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

  const [timeLeft, setTimeLeft] = useState(() => {
    const savedTime = localStorage.getItem('interviewTimeLeft');
    return savedTime ? parseInt(savedTime) : 3600;
  });
  
  const [isInterviewActive, setIsInterviewActive] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('interviewTimeLeft', timeLeft.toString());
  }, [timeLeft]);

  useEffect(() => {
    let timer;
    if (isInterviewActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsInterviewActive(false);
    }

    return () => clearInterval(timer);
  }, [isInterviewActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatProgress = (seconds) => {
    const totalDuration = 3600;
    const remaining = totalDuration - seconds;
    return (remaining / totalDuration) * 100;
  };

  const getProgressColor = () => {
    if (timeLeft > 1200) return '#10b981';
    if (timeLeft > 300) return '#f59e0b';
    return '#ef4444';
  };

  const handleEndInterview = () => {
    setIsInterviewActive(false);
    setShowEndModal(false);
    navigate('/interview');
  };

  return (
    <div className={styles['grid-chat-box']} style={{ gap: '20px', height: '100vh', padding: '20px' }}>
      <div className={styles.videoContainer}>
        <div className={styles.videoContent} style={{ position: 'relative', height: '100%', width: '100%' }}>
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 10
          }}>
            {formatTime(timeLeft)}
          </div>

          <div style={{
            position: 'absolute',
            top: '50px',
            left: '12px',
            right: '12px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
            overflow: 'hidden',
            zIndex: 10
          }}>
            <div style={{
              width: `${formatProgress(timeLeft)}%`,
              height: '100%',
              background: getProgressColor(),
              transition: 'width 1s linear, background 0.3s ease'
            }} />
          </div>

          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 10
          }}>
            Андрей
          </div>

          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
            fontSize: '16px'
          }}>
            Веб-камера (видеопоток)
          </div>
          
          <div className={styles.controls} style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            zIndex: 10
          }}>
            <button className={`${styles.btn} ${styles['btn-secondary']}`} style={{
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              🎤
            </button>
            
            <button 
              className={`${styles.btn} ${styles['call-btn']}`} 
              onClick={() => setShowEndModal(true)}
              style={{
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                background: '#ef4444',
                border: 'none',
                color: 'white'
              }}
            >
              📞
            </button>
            
            <button className={`${styles.btn} ${styles['btn-secondary']}`} style={{
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              📹
            </button>
          </div>
        </div>

        <div style={{ 
          marginTop: '12px', 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '14px',
          color: 'var(--muted)'
        }}>
          <span>Осталось: {formatTime(timeLeft)}</span>
          <span>Прошло: {formatTime(3600 - timeLeft)}</span>
          <span style={{ 
            color: timeLeft < 300 ? '#ef4445' : 'var(--muted)',
            fontWeight: timeLeft < 300 ? '600' : 'normal'
          }}>
            {Math.round(formatProgress(timeLeft))}%
          </span>
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.chatHeader}>
          <div className={styles.chatTime} style={{
            color: timeLeft < 300 ? '#ef4444' : 'white',
            fontWeight: timeLeft < 300 ? '600' : 'normal'
          }}>
            {formatTime(timeLeft)}
          </div>
          <div className={styles.chatParticipants}>
            <span className={styles.chatParticipant}>Саша</span>
            <span className={styles.chatDivider}>|</span>
            <span className={styles.chatParticipant}>Андрей</span>
          </div>
        </div>

        <div className={styles.messagesContainer}>
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`${styles.message} ${message.sender === 'Саша' ? styles.sasha : styles.andrey}`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.messageSender}>{message.sender}</span>
                <span className={styles.messageTime}>{message.time}</span>
              </div>
              <div className={styles.messageText}>
                {message.text || '\u00A0'}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chatInputContainer}>
          <div className={styles.chatInputWrapper}>
            <textarea 
              className={styles.chatInput}
              placeholder="Введите сообщение..."
              rows={1}
            />
            <button className={styles.chatSendBtn}>
              Отправить
            </button>
          </div>
        </div>
      </div>

      {showEndModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.endModal}>
            <h3>Завершить интервью досрочно</h3>
            <p>Интервью автоматически завершится, а ваш ответы будут отправлены на проверку</p>
            <div className={styles.modalButtons}>
              <button 
                className={styles.confirmButton}
                onClick={handleEndInterview}
                style={{background: '#2b80ff', color: 'white'}}
              >
                Завершить интервью
              </button>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowEndModal(false)}
                style={{background: '#e0edff', color: '#2b80ff'}}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewChatPage;