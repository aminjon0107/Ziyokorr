require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && (supabaseAnonKey || supabaseServiceRoleKey))
  ? createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey)
  : null;
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

function requireSupabase(res) {
  if (!supabase) {
    res.status(503).json({
      error: 'Supabase sozlanmagan. Render Environment Variables bo‘limiga SUPABASE_URL va SUPABASE_ANON_KEY kiriting.'
    });
    return false;
  }
  return true;
}

async function getUserFromRequest(req) {
  if (!supabase) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Avval tizimga kiring.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Avtorizatsiya amalga oshmadi.' });
  }
}

// Health-check endpoint: Render service holatini tekshirishi uchun.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'AIEdu', time: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'AIEdu' });
});

// Ro‘yxatdan o‘tish.
app.post('/api/auth/register', async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const { email, password, fullName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parolni kiriting.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo‘lsin.' });
    }
    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim(),
      password: String(password),
      options: { data: { full_name: fullName || '' } }
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({
      message: 'Ro‘yxatdan o‘tish so‘rovi yuborildi.',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ro‘yxatdan o‘tishda server xatosi.' });
  }
});

// Tizimga kirish.
app.post('/api/auth/login', async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email va parolni kiriting.' });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password)
    });
    if (error) return res.status(401).json({ error: error.message });
    res.json({ user: data.user, session: data.session });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Tizimga kirishda server xatosi.' });
  }
});

// Joriy foydalanuvchi.
app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// Kurslar ro‘yxati. Supabase sozlanmagan bo‘lsa, bo‘sh ro‘yxat qaytariladi.
app.get('/api/courses', async (req, res) => {
  if (!supabase) return res.json({ courses: [] });
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ courses: data || [] });
  } catch (error) {
    console.error('Courses error:', error);
    res.status(500).json({ error: 'Kurslarni olishda xatolik.' });
  }
});

// Sun’iy intellekt bilan suhbat. AI_API_URL va AI_API_KEY OpenAI-compatible API uchun.
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Savolingizni yozing.' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'AI xizmati hali sozlanmagan. AI_API_KEY kerak.' });
    }

    const messages = [
      { role: 'system', content: 'Siz AIEdu ta’lim platformasining yordamchi ustozisiz. O‘zbek tilida aniq, sodda va tushunarli javob bering.' },
      ...(Array.isArray(history) ? history.slice(-10).filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').map(item => ({ role: item.role, content: item.content })) : []),
      { role: 'user', content: String(message).slice(0, 8000) }
    ];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('AI provider error:', result);
      return res.status(502).json({ error: result.error?.message || 'AI xizmatidan javob olishda xatolik.' });
    }
    const answer = result.choices?.[0]?.message?.content;
    res.json({ answer: answer || 'Hozircha javob olinmadi.' });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'AI suhbatida server xatosi.' });
  }
});

// Admin foydalanuvchilar ro‘yxati (faqat service-role kaliti mavjud bo‘lsa).
app.get('/api/admin/users', requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Admin API sozlanmagan.' });
  }
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: data.users || [] });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Foydalanuvchilarni olishda xatolik.' });
  }
});

// Noma’lum API yo‘llari uchun 404. Wildcard route ishlatilmaydi.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API manzili topilmadi.' });
});

// SPA fallback. app.get('*') kabi path-to-regexp xatolarini oldini olish uchun middleware ishlatiladi.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (error) => {
    if (error) next(error);
  });
});

// Markaziy xato ishlovchisi.
app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Serverda kutilmagan xatolik yuz berdi.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AIEdu server ${PORT}-portda ishga tushdi.`);
});
