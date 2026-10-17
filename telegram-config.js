/* ============================================================
   telegram-config.js — Gửi thông báo Telegram trực tiếp từ trình duyệt.
   Dùng cho web tĩnh (GitHub Pages) khi không có backend.
   LƯU Ý: token nằm ngay trong file này nên bất kỳ ai xem source đều đọc được.
   ============================================================ */

const TELEGRAM_BOT_TOKEN = '8865358889:AAF1eUi6XRW4C9OCmlVXc1k-RwvJG1EnQr0';
const TELEGRAM_ADMIN_CHAT_ID = '8592672929';

async function notifyAdminTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      body: new URLSearchParams({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.description || `Telegram trả về mã ${response.status}`);
    }
    return true;
  } catch (error) {
    console.warn('Không gửi được thông báo Telegram:', error);
    return false;
  }
}
