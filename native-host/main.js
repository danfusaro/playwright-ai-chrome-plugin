const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { dialog } = require("@electron/remote/main");

// Initialize remote module
require("@electron/remote/main").initialize();

// Create Express app
const expressApp = express();
const port = 3005;

// Enable CORS and JSON parsing
expressApp.use(cors());
expressApp.use(express.json());

// Handle test exports
expressApp.post("/export-tests", async (req, res) => {
  try {
    const { tests } = req.body;

    // Show directory picker dialog
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Directory to Export Tests",
      defaultPath: path.join(process.env.HOME, "playwright-tests"),
    });

    if (!result.filePaths || result.filePaths.length === 0) {
      return res.json({
        success: false,
        error: "No directory selected",
      });
    }

    const testDir = result.filePaths[0];

    // Save each test to a file
    const savedFiles = await Promise.all(
      tests.map(async (test) => {
        const filePath = path.join(testDir, test.filename);
        await fs.promises.writeFile(filePath, test.body);
        return filePath;
      })
    );

    res.json({
      success: true,
      message: `Exported ${tests.length} tests successfully`,
      files: savedFiles,
    });
  } catch (error) {
    console.error("Error exporting tests:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start Express server
expressApp.listen(port, () => {
  console.log(`Native host server running at http://localhost:${port}`);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  require("@electron/remote/main").enable(win.webContents);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
