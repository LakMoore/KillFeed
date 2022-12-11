module.exports = {
  apps: [
    {
      name: "KillFeed",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
    },
  ]
};