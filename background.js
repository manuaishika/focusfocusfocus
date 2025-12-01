async function scheduleAllReminders() {
  const result = await chrome.storage.local.get(['reminderTimes', 'remindersEnabled']);
  const reminderTimes = result.reminderTimes || [];
  const remindersEnabled = result.remindersEnabled !== false;
  
  if (!remindersEnabled || reminderTimes.length === 0) {
    // Clear all reminder alarms
    const alarms = await chrome.alarms.getAll();
    alarms.forEach(alarm => {
      if (alarm.name.startsWith('reminder_')) {
        chrome.alarms.clear(alarm.name);
      }
    });
    return;
  }
  
  // Clear existing reminder alarms
  const alarms = await chrome.alarms.getAll();
  alarms.forEach(alarm => {
    if (alarm.name.startsWith('reminder_')) {
      chrome.alarms.clear(alarm.name);
    }
  });
  
  // Schedule new reminders
  const now = new Date();
  reminderTimes.forEach((time, index) => {
    const [hours, minutes] = time.split(':').map(Number);
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    chrome.alarms.create(`reminder_${index}`, {
      when: reminderTime.getTime(),
      periodInMinutes: 60 * 24 // Repeat daily
    });
  });
}

// Daily reset function to run at midnight
async function performDailyReset() {
  try {
    const result = await chrome.storage.local.get([
      'progress', 
      'permanentTasks', 
      'taskTypes', 
      'lastResetDate',
      'tasks',
      'websiteActivity',
      'websiteActivityDurations',
      'archive'
    ]);
    const progress = result.progress || {};
    const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
    const taskTypes = result.taskTypes || {};
    const websiteActivity = result.websiteActivity || {};
    const websiteActivityDurations = result.websiteActivityDurations || {};
    const archive = result.archive || {};
    const customTasks = result.tasks || [];
    const today = new Date().toISOString().split('T')[0];
    const lastResetDate = result.lastResetDate || '';
    
    // Only reset if we haven't already reset today
    if (lastResetDate === today) {
      return;
    }
    
    // Get all tasks
    const allTasks = [...permanentTasks, ...customTasks];
    
    // Initialize today's data structures if needed
    if (!progress[today]) {
      progress[today] = {};
    }
    if (!websiteActivity[today]) {
      websiteActivity[today] = {};
    }
    if (!websiteActivityDurations[today]) {
      websiteActivityDurations[today] = {};
    }
    if (!archive[today]) {
      archive[today] = [];
    }
    
    // Reset daily/permanent tasks: clear today's progress, activity, and archive for them
    // One-time tasks that were completed will be filtered out by popup.js logic
    allTasks.forEach(task => {
      const taskType = taskTypes[task] || 'daily';
      const isPermanentTask = permanentTasks.includes(task);
      
      // Reset daily and permanent tasks - they start fresh each day
      if (taskType === 'daily' || isPermanentTask) {
        // Clear progress
        if (progress[today] && progress[today][task] !== undefined) {
          delete progress[today][task];
        }
        // Clear activity
        if (websiteActivity[today] && websiteActivity[today][task] !== undefined) {
          delete websiteActivity[today][task];
        }
        // Clear activity durations
        if (websiteActivityDurations[today] && websiteActivityDurations[today][task] !== undefined) {
          delete websiteActivityDurations[today][task];
        }
        // Remove from archive if present
        if (archive[today] && archive[today].includes(task)) {
          archive[today] = archive[today].filter(t => t !== task);
        }
      }
    });
    
    // Save updated data and mark reset date
    await chrome.storage.local.set({
      progress,
      websiteActivity,
      websiteActivityDurations,
      archive,
      lastResetDate: today
    });
    
    console.log('Daily reset completed for', today);
  } catch (error) {
    console.error('Error during daily reset:', error);
  }
}

// Schedule daily reset alarm at midnight
function scheduleDailyReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0); // Next midnight
  
  // Calculate milliseconds until midnight
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  // Create alarm for midnight, repeating daily
  chrome.alarms.create("dailyReset", {
    when: midnight.getTime(),
    periodInMinutes: 60 * 24 // Repeat every 24 hours
  });
  
  console.log('Daily reset scheduled for', midnight.toISOString());
}

chrome.runtime.onInstalled.addListener(async () => {
  // Create frequent heartbeat for better tracking (every 30 seconds)
  chrome.alarms.create("trackingHeartbeat", { periodInMinutes: 0.5 });
  
  // Schedule daily reset
  scheduleDailyReset();
  
  // Perform reset immediately if needed (in case extension was off at midnight)
  await performDailyReset();
  
  // Start tracking immediately on install
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await handleTrackingForTab(tab);
    }
  } catch (e) {
    // Ignore initialization errors
  }
  
  // Initialize default reminder if none exist
  const result = await chrome.storage.local.get(['reminderTimes']);
  if (!result.reminderTimes || result.reminderTimes.length === 0) {
    // Set default reminder at 9:00 AM
    await chrome.storage.local.set({ 
      reminderTimes: ['09:00'],
      remindersEnabled: true
    });
  }
  
  // Schedule reminders
  await scheduleAllReminders();

  // Initialize permanent tasks and their URLs
  chrome.storage.local.get(['permanentTasks', 'taskUrls', 'taskTypes'], (result) => {
    const defaultPermanentTasks = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
    const defaultPermanentUrls = {
      'LeetCode': 'https://leetcode.com',
      'GRE Practice': 'https://www.gregmat.com/',
      'ML Practice': '',
      'Maths': ''
    };

    let storedPermanentTasks = Array.isArray(result.permanentTasks) ? [...result.permanentTasks] : [];
    const taskTypes = result.taskTypes || {};
    const taskUrls = result.taskUrls || {};
    let shouldPersist = false;

    // If no stored permanent tasks, start with defaults
    if (storedPermanentTasks.length === 0) {
      storedPermanentTasks = [...defaultPermanentTasks];
      shouldPersist = true;
    }

    // Ensure defaults are present at least once
    defaultPermanentTasks.forEach(task => {
      if (!storedPermanentTasks.includes(task)) {
        storedPermanentTasks.push(task);
        shouldPersist = true;
      }
    });

    // Ensure permanent tasks have daily type and default URLs if missing
    storedPermanentTasks.forEach(task => {
      if (taskTypes[task] !== 'daily') {
        taskTypes[task] = 'daily';
        shouldPersist = true;
      }
      // Set default URL if missing, or update GRE Practice from old ETS URL to GregMat
      if (taskUrls[task] === undefined && defaultPermanentUrls[task] !== undefined) {
        taskUrls[task] = defaultPermanentUrls[task];
        shouldPersist = true;
      } else if (task === 'GRE Practice' && taskUrls[task] === 'https://www.ets.org/gre') {
        // Migrate old ETS URL to GregMat
        taskUrls[task] = 'https://www.gregmat.com/';
        shouldPersist = true;
      }
    });

    if (shouldPersist || result.permanentTasks === undefined) {
      chrome.storage.local.set({ 
        permanentTasks: storedPermanentTasks,
        taskUrls,
        taskTypes
      });
    }
  });
});

// Reschedule reminders on startup and initialize tracking
chrome.runtime.onStartup.addListener(async () => {
  scheduleAllReminders();
  scheduleDailyReset();
  await performDailyReset();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await handleTrackingForTab(tab);
    }
  } catch (e) {
    console.error("Error initializing tracking on startup:", e);
  }
});

// Also initialize tracking when service worker wakes up
async function initializeTracking() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await handleTrackingForTab(tab);
    }
  } catch (e) {
    // Ignore
  }
}

// Initialize on load
initializeTracking();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyReset") {
    // Perform daily reset at midnight
    await performDailyReset();
    // Reschedule for next midnight
    scheduleDailyReset();
  } else if (alarm.name === "dailyReminder" || alarm.name.startsWith("reminder_")) {
    chrome.storage.local.get(['permanentTasks', 'tasks', 'taskTypes', 'progress', 'remindersEnabled'], (result) => {
      // Check if reminders are enabled
      if (result.remindersEnabled === false) {
        return;
      }
      
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const taskTypes = result.taskTypes || {};
      const progress = result.progress || {};
      const today = new Date().toISOString().split('T')[0];
      const todayProgress = progress[today] || {};
      
      // Only remind about incomplete daily tasks
      const allTasks = [...permanentTasks, ...customTasks];
      const dailyTasks = allTasks.filter(task => (taskTypes[task] || 'daily') === 'daily');
      const incompleteTasks = dailyTasks.filter(task => !todayProgress[task]);
      
      if (incompleteTasks.length > 0) {
        const taskList = incompleteTasks.length <= 3 
          ? incompleteTasks.join(', ')
          : `${incompleteTasks.slice(0, 2).join(', ')} and ${incompleteTasks.length - 2} more`;
        
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Task Reminder",
          message: `Don't forget: ${taskList}`,
          priority: 2
        });
      }
    });
  } else if (alarm.name === "trackingHeartbeat") {
    // Record progress every heartbeat
    await recordTrackingProgress(true);
    
    // Also reinitialize tracking if we lost it
    if (!activeTracking.task || !activeTracking.tabId) {
      await initializeTracking();
    } else {
      // Verify the tracked tab is still active
      try {
        const tab = await chrome.tabs.get(activeTracking.tabId);
        if (!tab || !tab.active) {
          // Tab is no longer active, reinitialize
          await initializeTracking();
        }
      } catch (e) {
        // Tab might be closed, reinitialize
        await initializeTracking();
      }
    }
  }
});

const MIN_ACTIVE_MS = 10 * 60 * 1000;
let activeWindowFocused = true;
let activeTracking = {
  tabId: null,
  task: null,
  startTime: 0,
  lastUpdate: 0
};

async function findMatchingTask(url) {
  try {
    if (!url || url.trim() === '') return null;
    
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const { taskUrls = {} } = await chrome.storage.local.get(['taskUrls']);
    
    for (const [task, taskUrl] of Object.entries(taskUrls)) {
      if (!taskUrl || taskUrl.trim() === '') continue;
      try {
        const taskUrlObj = new URL(taskUrl);
        let taskDomain = taskUrlObj.hostname.replace(/^www\./, '').toLowerCase();
        
        // Exact domain match
        if (domain === taskDomain) {
          return task;
        }
        
        // Subdomain match (e.g., vocab.gregmat.com or problems.gregmat.com matches gregmat.com)
        if (domain.endsWith('.' + taskDomain)) {
          return task;
        }
      } catch (error) {
        // Skip malformed URLs
      }
    }
  } catch (error) {
    console.error('Error in findMatchingTask:', error, url);
  }
  return null;
}

async function recordTrackingProgress(isHeartbeat = false) {
  if (!activeTracking.task || !activeTracking.tabId) {
    // Try to re-initialize tracking if we lost it
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await handleTrackingForTab(tab);
      }
    } catch (e) {
      // Ignore
    }
    return;
  }
  
  // Verify tab is still active
  try {
    const tab = await chrome.tabs.get(activeTracking.tabId);
    if (!tab || !tab.active) {
      return;
    }
  } catch (e) {
    // Tab might be closed
    activeTracking = { tabId: null, task: null, startTime: 0, lastUpdate: 0 };
    return;
  }
  
  const now = Date.now();
  let elapsed = now - (activeTracking.lastUpdate || activeTracking.startTime);
  
  if (elapsed <= 0) return;
  // Allow up to 5 minutes of elapsed time (in case of brief pauses)
  if (elapsed > 5 * 60 * 1000) {
    // Too long elapsed, probably the tab was inactive - don't count this interval
    elapsed = 0;
  }

  if (elapsed > 0) {
    activeTracking.lastUpdate = now;
    const today = new Date().toISOString().split('T')[0];
    const { websiteActivity = {}, websiteActivityDurations = {} } = await chrome.storage.local.get([
      'websiteActivity',
      'websiteActivityDurations'
    ]);

    if (!websiteActivityDurations[today]) websiteActivityDurations[today] = {};
    const currentDuration = websiteActivityDurations[today][activeTracking.task] || 0;
    const newDuration = currentDuration + elapsed;
    websiteActivityDurations[today][activeTracking.task] = newDuration;

    if (!websiteActivity[today]) websiteActivity[today] = {};
    
    const minutesSpent = Math.round(newDuration / 1000 / 60);
    const percentComplete = Math.min(100, Math.round((newDuration / MIN_ACTIVE_MS) * 100));
    
    if (newDuration >= MIN_ACTIVE_MS) {
      if (!websiteActivity[today][activeTracking.task]) {
        websiteActivity[today][activeTracking.task] = true;
        console.log(`✓ Activity confirmed for ${activeTracking.task} after ${minutesSpent} minutes`);
      }
    }

    await chrome.storage.local.set({
      websiteActivity,
      websiteActivityDurations
    });
  }
}

async function stopTracking(tabId) {
  if (!activeTracking.task || activeTracking.tabId === null) return;
  if (tabId !== undefined && tabId !== activeTracking.tabId) return;
  await recordTrackingProgress();
  activeTracking = {
    tabId: null,
    task: null,
    startTime: 0,
    lastUpdate: 0
  };
}

async function handleTrackingForTab(tab) {
  if (!tab || !tab.id) {
    await stopTracking();
    return;
  }

  // Skip chrome:// and extension:// URLs
  try {
    const url = new URL(tab.url || '');
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      await stopTracking(tab.id);
      return;
    }
  } catch (e) {
    // Invalid URL, skip
    await stopTracking(tab.id);
    return;
  }

  if (!activeWindowFocused) {
    await stopTracking(tab.id);
    return;
  }

  const task = await findMatchingTask(tab.url || '');
  if (!task) {
    // Only stop if we were tracking something, otherwise just ignore
    if (activeTracking.tabId === tab.id) {
      await stopTracking(tab.id);
    }
    return;
  }

  if (activeTracking.tabId === tab.id && activeTracking.task === task) {
    // Already tracking this, just ensure lastUpdate is set
    if (!activeTracking.lastUpdate) {
      activeTracking.lastUpdate = Date.now();
    }
    return;
  }

  // Switch tracking
  if (activeTracking.tabId && activeTracking.tabId !== tab.id) {
    await stopTracking(activeTracking.tabId);
  } else if (activeTracking.tabId === tab.id && activeTracking.task !== task) {
    await stopTracking(tab.id);
  }

  activeTracking = {
    tabId: tab.id,
    task,
    startTime: Date.now(),
    lastUpdate: Date.now()
  };
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Record progress for previously active tab
  await stopTracking(activeTracking.tabId);
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab) {
      await handleTrackingForTab(tab);
      // Start recording immediately if it's a matching task
      if (activeTracking.tabId === tab.id && activeTracking.task) {
        await recordTrackingProgress();
      }
    }
  } catch (error) {
    // Ignore errors
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stopTracking(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Handle URL changes and page loads - record progress before switching
  if (changeInfo.url) {
    // URL changed - record progress for old URL, then start tracking new URL
    if (tabId === activeTracking.tabId) {
      await recordTrackingProgress();
    }
  }
  
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (tab && tab.active) {
      await handleTrackingForTab(tab);
      // Also record immediately when tab becomes active with matching URL
      if (activeTracking.tabId === tab.id) {
        await recordTrackingProgress();
      }
    } else if (tabId === activeTracking.tabId && tab && !tab.active) {
      await stopTracking(tabId);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  activeWindowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (!activeWindowFocused) {
    await stopTracking(activeTracking.tabId);
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) {
        await handleTrackingForTab(tab);
      }
    } catch (error) {
      console.error('Error handling window focus:', error);
    }
  }
});

// Handle messages from popup/other scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'performDailyReset') {
    performDailyReset().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Error performing daily reset:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates we will send a response asynchronously
  }
});
