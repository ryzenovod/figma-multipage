"""
Утилита для просмотра скриншотов прокторинга
Генерирует HTML отчеты с галереей скриншотов
"""
from pathlib import Path
from typing import List, Dict
from datetime import datetime


class ScreenshotViewer:
    """Просмотрщик скриншотов прокторинга"""
    
    def __init__(self, screenshots_dir: str = "screenshots"):
        self.screenshots_dir = Path(screenshots_dir)
    
    def get_all_sessions(self) -> List[str]:
        """Получить список всех сессий со скриншотами"""
        if not self.screenshots_dir.exists():
            return []
        
        return [d.name for d in self.screenshots_dir.iterdir() if d.is_dir()]
    
    def get_session_screenshots(self, session_id: str) -> List[Dict]:
        """Получить скриншоты для конкретной сессии"""
        session_dir = self.screenshots_dir / session_id
        
        if not session_dir.exists():
            return []
        
        screenshots = []
        for filepath in sorted(session_dir.glob("*.jpg")):
            # Парсим имя файла: timestamp_severity_Nfaces.jpg
            parts = filepath.stem.split('_')
            
            try:
                timestamp = int(parts[0]) if len(parts) > 0 else 0
                severity = parts[1] if len(parts) > 1 else "unknown"
                face_count_str = parts[2] if len(parts) > 2 else "0faces"
                face_count = int(face_count_str.replace('faces', ''))
            except (ValueError, IndexError):
                timestamp = 0
                severity = "unknown"
                face_count = 0
            
            screenshot = {
                "filename": filepath.name,
                "filepath": str(filepath),
                "timestamp": timestamp,
                "severity": severity,
                "faceCount": face_count,
                "size": filepath.stat().st_size,
                "created": datetime.fromtimestamp(filepath.stat().st_ctime).isoformat()
            }
            screenshots.append(screenshot)
        
        return screenshots
    
    def generate_html_report(self, session_id: str, output_file: str = None) -> str:
        """Сгенерировать HTML отчет со скриншотами"""
        screenshots = self.get_session_screenshots(session_id)
        
        if not screenshots:
            return f"No screenshots found for session {session_id}"
        
        # Статистика
        total_size = sum(s['size'] for s in screenshots)
        critical_count = sum(1 for s in screenshots if s['severity'] == 'critical')
        warning_count = sum(1 for s in screenshots if s['severity'] == 'warning')
        
        html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshots Report - {session_id}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }}
        
        h1 {{
            color: #333;
            margin-bottom: 10px;
        }}
        
        h2 {{
            color: #667eea;
            margin-top: 30px;
            margin-bottom: 20px;
        }}
        
        .session-id {{
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
        }}
        
        .stats {{
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }}
        
        .stat-item {{
            text-align: center;
        }}
        
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }}
        
        .stat-label {{
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }}
        
        .gallery {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }}
        
        .screenshot {{
            border: 3px solid #ddd;
            padding: 10px;
            border-radius: 12px;
            background: white;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }}
        
        .screenshot:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }}
        
        .screenshot.critical {{
            border-color: #f44336;
        }}
        
        .screenshot.warning {{
            border-color: #ff9800;
        }}
        
        .screenshot.normal {{
            border-color: #4CAF50;
        }}
        
        .screenshot img {{
            width: 100%;
            height: auto;
            border-radius: 8px;
            cursor: pointer;
        }}
        
        .info {{
            margin-top: 10px;
            font-size: 12px;
            color: #666;
        }}
        
        .info p {{
            margin: 5px 0;
        }}
        
        .severity-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            margin-right: 5px;
        }}
        
        .severity-badge.critical {{
            background: #f44336;
            color: white;
        }}
        
        .severity-badge.warning {{
            background: #ff9800;
            color: white;
        }}
        
        .severity-badge.normal {{
            background: #4CAF50;
            color: white;
        }}
        
        /* Модальное окно */
        .modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }}
        
        .modal-content {{
            margin: 2% auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
        }}
        
        .close {{
            position: absolute;
            top: 30px;
            right: 50px;
            color: #f1f1f1;
            font-size: 50px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.3s;
        }}
        
        .close:hover {{
            color: #ff4444;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📸 Proctoring Screenshots Report</h1>
        <p class="session-id">Session ID: <strong>{session_id}</strong></p>
        
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">{len(screenshots)}</div>
                <div class="stat-label">Total Screenshots</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">{critical_count}</div>
                <div class="stat-label">Critical Events</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">{warning_count}</div>
                <div class="stat-label">Warning Events</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">{total_size / 1024 / 1024:.2f} MB</div>
                <div class="stat-label">Total Size</div>
            </div>
        </div>
        
        <h2>📷 Gallery</h2>
        <div class="gallery">
"""
        
        for screenshot in screenshots:
            timestamp_str = datetime.fromtimestamp(screenshot['timestamp'] / 1000).strftime('%Y-%m-%d %H:%M:%S')
            severity_class = screenshot['severity']
            
            html += f"""
            <div class="screenshot {severity_class}">
                <img src="{screenshot['filepath']}" alt="{screenshot['filename']}" onclick="openModal(this.src)">
                <div class="info">
                    <p>
                        <span class="severity-badge {severity_class}">{screenshot['severity']}</span>
                        {screenshot['faceCount']} 👤
                    </p>
                    <p><strong>Time:</strong> {timestamp_str}</p>
                    <p><strong>Size:</strong> {screenshot['size'] / 1024:.1f} KB</p>
                </div>
            </div>
"""
        
        html += """
        </div>
    </div>
    
    <!-- Модальное окно -->
    <div id="imageModal" class="modal" onclick="closeModal()">
        <span class="close">&times;</span>
        <img class="modal-content" id="modalImage">
    </div>
    
    <script>
        function openModal(src) {
            document.getElementById('imageModal').style.display = 'block';
            document.getElementById('modalImage').src = src;
        }
        
        function closeModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        
        // Закрытие по Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
    </script>
</body>
</html>
"""
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html)
            return f"Report saved to {output_file}"
        
        return html


if __name__ == "__main__":
    import sys
    
    viewer = ScreenshotViewer()
    sessions = viewer.get_all_sessions()
    
    if not sessions:
        print("No screenshot sessions found.")
        sys.exit(0)
    
    print(f"Found {len(sessions)} sessions with screenshots:\n")
    
    for i, session_id in enumerate(sessions, 1):
        screenshots = viewer.get_session_screenshots(session_id)
        print(f"{i}. {session_id}: {len(screenshots)} screenshots")
    
    print("\nGenerating HTML reports...")
    
    for session_id in sessions:
        screenshots = viewer.get_session_screenshots(session_id)
        if screenshots:
            report_file = f"screenshot_report_{session_id}.html"
            result = viewer.generate_html_report(session_id, report_file)
            print(f"  ✓ {result}")
    
    print("\nDone! Open the HTML files in your browser to view the reports.")
