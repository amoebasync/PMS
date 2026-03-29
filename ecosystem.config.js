require("dotenv").config();
module.exports = {
  apps: [{
    name: "pms",
    script: "./server.js",
    instances: 2,
    exec_mode: "cluster",
    env: Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        k.startsWith("DATABASE_") || k.startsWith("AWS_") || k.startsWith("NEXT_") ||
        k.startsWith("GOOGLE_") || k.startsWith("LINE_") || k.startsWith("CRON_") ||
        k.startsWith("NEXTAUTH_") || k.startsWith("ANTHROPIC_") || k.startsWith("DOCUSEAL_") ||
        k.startsWith("NEXT_PUBLIC_") || k === "NODE_ENV" || k === "PORT"
      )
    ),
  }],
};
