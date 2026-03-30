import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const NOTEBOOK_FILE = path.join(process.cwd(), "notebook.txt");

  // Initialize notebook file if it doesn't exist
  try {
    await fs.access(NOTEBOOK_FILE);
  } catch {
    await fs.writeFile(NOTEBOOK_FILE, "Write your chores and thoughts here...\n\n- [ ] Morning prayer\n- [ ] Read the Gospel", "utf-8");
  }

  app.get("/api/notebook", async (req, res) => {
    try {
      const content = await fs.readFile(NOTEBOOK_FILE, "utf-8");
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: "Failed to read notebook" });
    }
  });

  app.post("/api/notebook", async (req, res) => {
    if (typeof req.body.content === 'string') {
      try {
        await fs.writeFile(NOTEBOOK_FILE, req.body.content, "utf-8");
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to save notebook" });
      }
    } else {
      res.status(400).json({ error: "Invalid content" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
