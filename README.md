
ssh -i \
/Users/chen/Desktop/Cursor_project/parttime-job-agnet/tech-cheak-agent/chenTcent.pem \
ubuntu@111.230.16.233

ssh ubuntu@111.230.16.233

chmod +x deploy_local.sh

1.安全组 在腾讯云入站规则放行所有要用的端口
例：3000, 4004, 5000 …
2.服务器目录
sudo mkdir -p /home/ubuntu/appA /home/ubuntu/appB

3.给密钥免密（若仍会要密码）
ssh-keygen -y -f chenTcent.pem | ssh ubuntu@IP 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'


以 项目 A 为例，打开对应脚本并修改：
deploy_local.sh（本地）
REMOTE_IP=111.230.16.233       # 服务器 IP
REMOTE_DIR=/home/ubuntu/appA   # ←①
REMOTE_DEPLOY_SCRIPT=$REMOTE_DIR/deploy.sh

deploy.sh（服务器，放在 /appA 目录下）
APP_DIR="/home/ubuntu/appA"    # ←①
PORT=3000                      # ←②
NAME="appA"                    # ←③

项目 B / C 同理改成自己的目录-端口-名称即可。
三、一次完整发布流程

在 项目根目录（本地）执行：

./deploy_local.sh
脚本做了什么？
rsync → 服务器 /appX
前端 npm build → dist 复制到 backend/static
后端依赖安装
pm2 delete NAME → PORT=xxxx pm2 start → pm2 save
四、验证

curl -I http://<IP>:3000/            # 前端 HTML
curl -I http://<IP>:3000/api/health  # 后端 API
pm2 list                             # 看到 appA online, appB online …
sudo ss -ltnp | grep 3000            # LISTEN *:3000 (node / uvicorn)

   构建前端
   ssh ubuntu@111.230.16.233        # 用免密或密码
   cd ~/app/frontend
   npm ci                            # 已装可跳过
   npm run build    

   复制到 backend/static
   cd ~/app
   rm -rf backend/static
   mkdir -p backend/static


   确保后端挂载静态（backend/src/index.js）
      import path from 'node:path';
   import express from 'express';
   const app = express();
   app.use(express.static(path.join(__dirname, '../static')));
   app.get('*', (_,res)=>res.sendFile(path.join(__dirname,'../static/index.html')));

   pm2 restart tech-agent