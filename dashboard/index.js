require('dotenv').config({ path: require('path').join(__dirname, './.env') });

const express = require('express');
const cors = require('cors');
const { loadAndAnalyzeEmails, getCache } = require('./app/calendar/emailService');
const { loadAndAnalyzeSchedule, getScheduleCache } = require('./app/calendar/scheduleService');

const app = express();
app.use(cors());
app.use(express.json());

let analyzing = false;
let analysisError = null;
let scheduleAnalyzing = false;
let scheduleError = null;

async function runAnalysis(forceRefresh = false) {
    analyzing = true;
    scheduleAnalyzing = true;
    analysisError = null;
    scheduleError = null;
    console.log('Starting inbox + schedule analysis...');
  
    const inboxTask = loadAndAnalyzeEmails(forceRefresh)
      .catch(err => {
        analysisError = err.message;
        console.error('Inbox analysis error:', err.message);
      })
      .finally(() => { analyzing = false; });
  
    const scheduleTask = loadAndAnalyzeSchedule(forceRefresh)
      .catch(err => {
        scheduleError = err.message;
        console.error('Schedule analysis error:', err.message);
      })
      .finally(() => { scheduleAnalyzing = false; });
  
    await Promise.allSettled([inboxTask, scheduleTask]);
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