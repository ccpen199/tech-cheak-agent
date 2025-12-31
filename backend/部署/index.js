// backend/src/index.js

// 若后端是 Python/FastAPI，
// 只要同理把 static/ 目录挂进 StaticFiles，
// 并在 deploy.sh 里用 uvicorn 启动即可。
import express from 'express';
import path from 'node:path';
const app = express();
const PORT = process.env.PORT || 3000;

// 静态资源
app.use(express.static(path.join(__dirname, '../static')));

// SPA 刷新兜底
app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '../static/index.html'))
);

// API 示例
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`服务运行在 http://localhost:${PORT}`));