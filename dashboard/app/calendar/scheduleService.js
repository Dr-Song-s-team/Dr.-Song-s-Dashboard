const { loadSchedulingEmails } = require('./csvParser');
const { analyzeSchedulingEmails } = require('./geminiService');

let scheduleCache = [];
let isScheduleReady = false;

function getScheduleCache() {
  return scheduleCache;
}

function isScheduleAnalysisReady() {
  return isScheduleReady;
}

function ruleBasedSchedule(emails) {
  const MONTH_MAP = {
    twentieth: '20', 'twenty-first': '21', twentyfirst: '21',
    'twenty-second': '22', twentysecond: '22',
    'twenty-third': '23', twentythird: '23',
    'twenty-fourth': '24', twentyfourth: '24',
    'twenty-fifth': '25', twentyfifth: '25',
    'twenty-sixth': '26', twentysixth: '26',
    'twenty-seventh': '27', twentyseventh: '27',
    'twenty-eighth': '28', twentyeighth: '28',
    'twenty-ninth': '29', twentyninth: '29',
    thirtieth: '30',
    'thirty-first': '31', thirtyfirst: '31',
    twenty: '20', twenty1: '21', twenty2: '22',
  };

  return emails.map(email => {
    const text = (email.subject + ' ' + email.body).toLowerCase();
    const sender = email.sender.toLowerCase();

    const category = sender.includes('insurance') || sender.includes('claims')
      ? 'insurance' : 'client';

    let date = null;
    const julyMatch = text.match(/july\s+(\w+(?:-\w+)?)/i);
    if (julyMatch) {
      const word = julyMatch[1].toLowerCase().replace(/\s+/g, '-');
      const day = MONTH_MAP[word];
      if (day) date = `2026-07-${day}`;
    }

    const urgencyWords = ['urgent', 'immediately', 'deadline', 'expires', 'denial', 'failure', 'final'];
    const urgency = urgencyWords.some(w => text.includes(w)) ? 'high' : 'medium';

    const typeWords = {
      reschedule: 'reschedule', cancel: 'cancellation',
      deadline: 'deadline', book: 'appointment',
      schedule: 'appointment', intake: 'appointment',
    };
    let type = 'inquiry';
    for (const [word, t] of Object.entries(typeWords)) {
      if (text.includes(word)) { type = t; break; }
    }

    return {
      emailId: email.id,
      type,
      patientName: email.senderName,
      date,
      time: null,
      title: email.subject.slice(0, 50),
      urgency,
      category,
    };
  });
}

async function loadAndAnalyzeSchedule(forceRefresh = false) {
  if (isScheduleReady && !forceRefresh) return;
  isScheduleReady = false;

  const emails = loadSchedulingEmails();

  let events;
  try {
    events = await analyzeSchedulingEmails(emails);
  } catch (err) {
    console.warn('Schedule analysis failed, using fallback:', err.message);
    events = ruleBasedSchedule(emails);
  }

  // Merge email metadata (subject, sender, body) into each event
  const emailMap = new Map(emails.map(e => [e.id, e]));
  scheduleCache = events.map(ev => ({
    ...ev,
    subject: emailMap.get(ev.emailId)?.subject || '',
    sender:  emailMap.get(ev.emailId)?.sender  || '',
    body:    emailMap.get(ev.emailId)?.body    || '',
  }));

  isScheduleReady = true;
  console.log(`Schedule analysis complete — ${scheduleCache.length} events.`);
}

module.exports = { loadAndAnalyzeSchedule, getScheduleCache, isScheduleAnalysisReady };
