import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { loadAndAnalyzeEmails, getCache } from "./app/(dashboard)/calendar/emailService";
import { loadAndAnalyzeSchedule, getScheduleCache } from "./app/(dashboard)/calendar/scheduleService";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "./.env"),
});

const app = express();
app.use(cors());
app.use(express.json());

let analyzing = false;
let analysisError = null;
let scheduleAnalyzing = false;
let scheduleError = null;

async function runAnalysis(forceRefresh = false) {
  console.log("runAnalysis started")
    analyzing = true;
    scheduleAnalyzing = true;

    console.log("Before inbox task");
    analysisError = null;
    scheduleError = null;
    console.log('Starting inbox + schedule analysis...');
  
    const inboxTask = Promise.resolve()
  .then(() => loadAndAnalyzeEmails(forceRefresh))
      .catch(err => {
        analysisError = err.message;
        console.error('Inbox analysis error:', err.message);
      })
      .finally(() => { console.log("Inbox finished");
        analyzing = false; });

        console.log("Before schedule task");
  
    const scheduleTask = Promise.resolve()
  .then(() => loadAndAnalyzeSchedule(forceRefresh))
      .catch(err => {
        scheduleError = err.message;
        console.error('Schedule analysis error:', err.message);
      })
      .finally(() => { console.log("Schedule finished");
        scheduleAnalyzing = false; });
  
    await Promise.allSettled([inboxTask, scheduleTask]);
    console.log("runAnalysis complete");
    console.log('All analysis complete.');
  }

runAnalysis()

console.log("here")

app.get('/api/emails', (req, res) => {
    if (analyzing) return res.json({ status: 'analyzing', emails: [] });
    if (analysisError && getCache().length === 0) {
      return res.status(500).json({ error: analysisError });
    }
    res.json({ status: 'ready', emails: getCache() });
  });

  app.get('/api/schedule', (req, res) => {
    //console.log("Here")
    if (scheduleAnalyzing) return res.json({ status: 'analyzing', events: [] });
    if (scheduleError && getScheduleCache().length === 0) {
      return res.status(500).json({ error: scheduleError });
    }
    res.json({ status: 'ready', events: getScheduleCache() });
  });

  app.post('/api/refresh', async (req, res) => {
    if (analyzing || scheduleAnalyzing) {
      return res.status(409).json({ error: 'Analysis already in progress' });
    }
    res.json({ status: 'refresh started' });
    runAnalysis(true);
  });
  
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });