import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './page.module.css';

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  type?: 'ai' | 'system' | 'andrey' | 'code';
}

const INTERVIEW_DURATION = 60 * 60; // 1 hour

const InterviewChatPage = () => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ИИ-Ассистент',
      text: 'Стартую сессию. Таймер — 1 час. Напоминаю: единственное LLM-окружение — SciBox, внешние API отключены.',
      time: '00:00',
      type: 'ai',
    },
    {
      id: 2,
      sender: 'Система',
      text: 'WebSocket подключён: события paste/devtools будут отправляться &lt;50 мс.',
      time: '00:01',
      type: 'system',
    },
  ]);

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const savedTime = localStorage.getItem('interviewTimeLeft');
    return savedTime ? Number(savedTime) : INTERVIEW_DURATION;
  });

  const [isInterviewActive, setIsInterviewActive] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);
  const [code, setCode] = useState<string>(
    `// Подсчёт риска с учётом ограничений ТЗ
export function scoreRisk(events) {
  const pasteEvents = events.filter((e) => e.type === 'paste');
  const largePastes = pasteEvents.filter((e) => e.size > 500).length * 25;
  const frequentPastes = pasteEvents.length > 5 ? 20 : 0;
  const devtools = events.some((e) => e.type === 'devtools') ? 30 : 0;
  const aiExtensions = events.some((e) => e.type === 'extension:ai') ? 30 : 0;
  return Math.min(largePastes + frequentPastes + devtools + aiExtensions, 100);
}

// Готово для отправки в SciBox API (qwen3-coder + bge-m3)
// Без внешних API: работаем только с облаком менторов.`,
  );

  useEffect(() => {
    localStorage.setItem('interviewTimeLeft', timeLeft.toString());
  }, [timeLeft]);

  useEffect(() => {
    if (!isInterviewActive) return undefined;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isInterviewActive]);

  useEffect(() => {
    if (timeLeft === 0) {
      setIsInterviewActive(false);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatProgress = (seconds: number) => {
    const remaining = INTERVIEW_DURATION - seconds;
    return (remaining / INTERVIEW_DURATION) * 100;
  };

  const progressColor = useMemo(() => {
    if (timeLeft > 1200) return '#10b981';
    if (timeLeft > 300) return '#f59e0b';
    return '#ef4444';
  }, [timeLeft]);

  const appendMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const sendCodeToAI = async () => {
    const sendingMessage: Message = {
      id: messages.length + 1,
      sender: 'Система',
      text: 'Отправляю код на анализ SciBox (qwen3-coder + bge-m3)...',
      time: formatTime(INTERVIEW_DURATION - timeLeft),
      type: 'system',
    };

    appendMessage(sendingMessage);

    const aiResponse = await new Promise<string>((resolve) => {
      window.setTimeout(() => {
        resolve(
          'Анализ завершён. Код выглядит оригинально: частота вставок в норме, DevTools закрыт, расширения AI не активны. Риск <70 — жёлтая зона, можно принять сессию.',
        );
      }, 600);
    });

    const aiMessage: Message = {
      id: messages.length + 2,
      sender: 'ИИ-Ассистент',
      text: aiResponse,
      time: formatTime(INTERVIEW_DURATION - timeLeft),
      type: 'ai',
    };

    appendMessage(aiMessage);
  };

  const handleSendCode = () => {
    if (!code.trim()) return;

    const codeMessage: Message = {
      id: messages.length + 1,
      sender: 'Андрей',
      text: `Отправлен код на проверку:\n\n${code}`,
      time: formatTime(INTERVIEW_DURATION - timeLeft),
      type: 'andrey',
    };

    appendMessage(codeMessage);
    void sendCodeToAI();
  };

  return (
    <div className={styles['grid-chat-ide']}>
      <div className={styles.topRow}>
        <div className={styles.videoContainer}>
          <div className={styles.videoContent} style={{ position: 'relative', height: '100%', width: '100%' }}>
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: timeLeft < 300 ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 500,
                zIndex: 10,
              }}
            >
              {formatTime(timeLeft)}
            </div>

            <div
              style={{
                position: 'absolute',
                top: '50px',
                left: '12px',
                right: '12px',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
                overflow: 'hidden',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: `${formatProgress(timeLeft)}%`,
                  height: '100%',
                  background: progressColor,
                  transition: 'width 1s linear, background 0.3s ease',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 500,
                zIndex: 10,
              }}
            >
              Андрей
            </div>

            <div
              style={{
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
                fontSize: '16px',
              }}
            >
              Веб-камера (видеопоток)
            </div>

            <div
              className={styles.controls}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '12px',
                zIndex: 10,
              }}
            >
              <button
                className={`${styles.btn} ${styles['btn-secondary']}`}
                style={{
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                🎤
              </button>

              <button
                className={`${styles.btn} ${styles['call-btn']}`}
                onClick={() => setShowEndModal(true)}
                style={{
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                }}
              >
                📞
              </button>

              <button
                className={`${styles.btn} ${styles['btn-secondary']}`}
                style={{
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                📹
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: 'var(--muted)',
            }}
          >
            <span>Осталось: {formatTime(timeLeft)}</span>
            <span>Прошло: {formatTime(INTERVIEW_DURATION - timeLeft)}</span>
            <span
              style={{
                color: timeLeft < 300 ? '#ef4445' : 'var(--muted)',
                fontWeight: timeLeft < 300 ? 600 : 'normal',
              }}
            >
              {Math.round(formatProgress(timeLeft))}%
            </span>
          </div>
        </div>

        <div className={styles.chatContainer}>
          <div className={styles.messagesContainer}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${styles[message.type ?? 'andrey']}`}
              >
                <div className={styles.messageHeader}>
                  <span className={styles.messageSender}>{message.sender}</span>
                  <span className={styles.messageTime}>{message.time}</span>
                </div>
                <div className={styles.messageText}>
                  {message.text.split('\n').map((line, index) => (
                    <div key={`${message.id}-${index}`}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.chatInputContainer}>
            <div className={styles.chatInputWrapper}>
              <textarea className={styles.chatInput} placeholder="Введите сообщение..." rows={1} />
              <button className={styles.chatSendBtn}>Отправить</button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.ideContainer}>
        <div className={styles.ideHeader}>
          <span>Редактор кода</span>
          <button className={styles.sendCodeButton} onClick={handleSendCode}>
            Отправить код в SciBox
          </button>
        </div>
        <textarea
          className={styles.codeEditor}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Напишите ваш код здесь..."
          rows={8}
        />
      </div>

      {showEndModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.endModal}>
            <h3>Завершить интервью досрочно</h3>
            <p>Интервью остановится, а ответы и метрики будут сохранены и отправлены в отчёт.</p>
            <div className={styles.modalButtons}>
              <button
                className={styles.confirmButton}
                onClick={() => {
                  setShowEndModal(false);
                  setIsInterviewActive(false);
                  navigate('/');
                }}
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
