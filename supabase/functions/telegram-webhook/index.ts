// ============================================================
// Supabase Edge Function: telegram-webhook
// Nhận lệnh /duyet từ Telegram và duyệt đơn nạp trực tiếp trên Supabase.
// Chạy 24/7 trên hạ tầng Supabase, không cần mở trang Quản trị.
//
// Biến môi trường cần đặt trong Supabase Dashboard (Edge Functions > Secrets):
//   TELEGRAM_BOT_TOKEN        - token bot Telegram
//   TELEGRAM_ADMIN_CHAT_ID    - chat id của admin
//   TELEGRAM_WEBHOOK_SECRET   - (khuyến nghị) chuỗi bí mật để xác thực webhook
// SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY do Supabase tự cấp.
// ============================================================

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type Order = {
  id: number;
  username: string;
  amount: number;
  content: string;
  status: string;
};

const HELP_TEXT =
  'Lệnh quản trị CodeNest:\n' +
  '/duyet <mã đơn> - duyệt đơn nạp và cộng tiền vào ví\n' +
  '/help - xem hướng dẫn này';

function normalizeCode(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '');
}

function money(value: unknown): string {
  return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
}

async function sendMessage(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function findOrder(code: string): Promise<Order | null> {
  const target = normalizeCode(code);
  const response = await db('orders?select=*&order=created_at.desc&limit=300');
  if (!response.ok) return null;
  const rows = (await response.json()) as Order[];
  return rows.find((row) => normalizeCode(row.content) === target) ?? null;
}

async function approveOrder(order: Order): Promise<number> {
  const filter = `username=eq.${encodeURIComponent(order.username)}`;
  const userResponse = await db(`users?select=balance&${filter}`);
  const users = userResponse.ok ? ((await userResponse.json()) as { balance: number }[]) : [];
  const newBalance = Number(users[0]?.balance ?? 0) + Number(order.amount || 0);

  await db(`users?${filter}`, {
    method: 'PATCH',
    body: JSON.stringify({ balance: newBalance }),
  });

  await db(`orders?id=eq.${order.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' }),
  });

  return newBalance;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('telegram-webhook OK', { status: 200 });
  }

  if (WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  let update: { message?: { chat?: { id?: number }; from?: { id?: number }; text?: string } };
  try {
    update = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const message = update?.message;
  const chatId = String(message?.chat?.id ?? '');
  const senderId = String(message?.from?.id ?? '');

  // Chỉ xử lý lệnh gửi từ đúng tài khoản admin.
  if (!message || chatId !== ADMIN_CHAT_ID || senderId !== ADMIN_CHAT_ID) {
    return new Response('ignored', { status: 200 });
  }

  const text = String(message.text ?? '').trim();
  const command = (text.split(/\s+/)[0] ?? '').split('@')[0].toLowerCase();

  try {
    if (command === '/start' || command === '/help' || command === '/trogiup') {
      await sendMessage(chatId, HELP_TEXT);
    } else if (command === '/duyet') {
      const code = text.replace(/^\/duyet(@[A-Za-z0-9_]+)?/i, '').trim();
      if (!code) {
        await sendMessage(chatId, 'Cú pháp đúng: /duyet <mã đơn>');
      } else {
        const order = await findOrder(code);
        if (!order) {
          await sendMessage(chatId, `Không tìm thấy đơn ${code}.\nKiểm tra lại mã đơn trên trang Ví tiền của khách.`);
        } else if (order.status === 'approved') {
          await sendMessage(chatId, `Đơn ${order.content} đã được duyệt trước đó.`);
        } else {
          const newBalance = await approveOrder(order);
          await sendMessage(
            chatId,
            `Đã duyệt đơn ${order.content}\n` +
              `Khách hàng: ${order.username}\n` +
              `Số tiền: ${money(order.amount)}\n` +
              `Số dư mới: ${money(newBalance)}`,
          );
        }
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await sendMessage(chatId, `Lỗi khi duyệt đơn: ${reason}`);
  }

  return new Response('ok', { status: 200 });
});
