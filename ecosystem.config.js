module.exports = {
  apps: [
    {
      name: "KillFeed",
      script: "npm",
      args: "run prod-build-run",
      instances: 1,
      autorestart: true,
    },
  ]
};