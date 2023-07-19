module.exports = {
  apps: [
    {
      name: "KillFeed",
      script: "dist/Bot.js",
      instances: 1,
      autorestart: true,
    },
  ],
};
