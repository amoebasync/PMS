#!/bin/bash
cd /home/ec2-user/pms_java
export PATH=$PATH:/home/ec2-user/.nvm/versions/node/v20.20.0/bin
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
pm2 restart pms
