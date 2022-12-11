module.exports = {
  apps: [
    {
      name: "KillFeed",
      script: "ts-node src/Bot.ts",
      instances: 1,
      autorestart: true,
    },
  ],
  deploy: {
    production: {
      user: "lakm",
      host: "140.82.112.4",
      path: "/home/lakm/KillFeed",
      repo: "git@github.com:LakMoore/KillFeed.git",
      ref: "origin/main",
      key: "deploy.key",
      "post-deploy": "npm i; pm2 reload ecosystem.config.js --env production",
    },
  },
};