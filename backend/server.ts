import express from "express";

const app = express();
const DEFAULT_PORT = 4000;
const requestedPort = Number(process.env.PORT ?? DEFAULT_PORT);
const startPort = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_PORT;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend server is running" });
});

app.get("/api/data", (_req, res) => {
  res.json({ message: "Hello from the backend", timestamp: new Date().toISOString() });
});

function startServer(port: number) {
  const server = app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      if (process.env.PORT) {
        console.error(`Port ${port} is already in use. Set a different PORT value and try again.`);
        process.exit(1);
      }

      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
      return;
    }

    throw error;
  });
}

startServer(startPort);
