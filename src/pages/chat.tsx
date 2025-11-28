import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './page.module.css';

const InterviewChatPage = () => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ИИ-Ассистент',
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
      sender: 'ИИ-Ассистент',
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
  const [code, setCode] = useState(`
`);

  useEffect(() => {
    localStorage.setItem('interviewTimeLeft', timeLeft.toString());
  }, [timeLeft]);

  useEffect(() => {
    let timer: any;
    if (isInterviewActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsInterviewActive(false);
    }

    return () => clearInterval(timer);
  }, [isInterviewActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatProgress = (seconds: number) => {
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

  const sendCodeToAI = async () => {
    try {

      const sendingMessage = {
        id: messages.length + 1,
        sender: 'Система',
        text: 'Отправляю код на анализ ИИ...',
        time: formatTime(3600 - timeLeft),
        type: 'system'
      };

      setMessages(prev => [...prev, sendingMessage]);

      // Имитация API запроса к ИИ
      const response = await fetch('https://API', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          language: 'javascript',
          context: 'technical_interview'
        })
      });

      if (response.ok) {
        const aiResponse = await response.json();

        // Добавляем ответ от ИИ
        const aiMessage = {
          id: messages.length + 2,
          sender: 'ИИ-Ассистент',
          text: `Анализ кода:\n\n${aiResponse.analysis || 'Код успешно проанализирован. Структура логичная, алгоритм эффективный.'}`,
          time: formatTime(3600 - timeLeft),
          type: 'ai'
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Ошибка API');
      }
    } catch (error) {
      console.error('Ошибка отправки кода:', error);

      const errorMessage = {
        id: messages.length + 2,
        sender: 'Система',
        text: '❌ Ошибка отправки кода. Проверьте подключение к интернету.',
        time: formatTime(3600 - timeLeft),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSendCode = () => {
    // Добавляем код в чат как сообщение от пользователя
    const codeMessage = {
      id: messages.length + 1,
      sender: 'Андрей',
      text: ` Отправлен код на проверку:\n\`\`\`javascript\n${code}\n\`\`\``,
      time: formatTime(3600 - timeLeft),
      type: 'code'
    };

    setMessages(prev => [...prev, codeMessage]);

    // Отправляем код на анализ ИИ
    sendCodeToAI();
  };

  return (
    <div className={styles['grid-chat-ide']}>
      {/* Верхний ряд: видео и чат */}
      <div className={styles.topRow}>
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


          <div className={styles.messagesContainer}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${message.sender === 'ИИ-Ассистент' ? styles.ai :
                  message.sender === 'Система' ? styles.system :
                    styles.andrey
                  }`}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.messageSender}>{message.sender}</span>
                  <span className={styles.messageTime}>{message.time}</span>
                </div>
                <div className={styles.messageText}>
                  {message.text.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
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
      </div>

      {/* Нижний ряд: IDE */}
      <div className={styles.ideContainer}>
        <div className={styles.ideHeader}>
          <span>Редактор кода</span>
          <button
            className={styles.sendCodeButton}
            onClick={handleSendCode}
            style={{ backgroundColor: ' #2b80ff' }}
          >
            Отправить код ИИ
          </button>
        </div>
        <textarea
          className={styles.codeEditor}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Напишите ваш код здесь..."
          rows={8}
        />
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
                style={{ background: '#2b80ff', color: 'white' }}
              >
                Завершить интервью
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => setShowEndModal(false)}
                style={{ background: '#e0edff', color: '#2b80ff' }}
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