@echo off
chcp 65001 >nul
echo إيقاف عمليات Node الخاصة بـ Maktaba...
taskkill /FI "WINDOWTITLE eq Maktaba API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Maktaba Web*" /F >nul 2>&1
echo تم إرسال أمر الإيقاف لنوافذ التشغيل.
echo لو السيرفر لسه شغال، أغلق نافذتي Maktaba API و Maktaba Web يدويًا.
pause
