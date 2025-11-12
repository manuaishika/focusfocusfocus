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

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create("trackingHeartbeat", { periodInMinutes: 1 });
  
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

// Reschedule reminders on startup
chrome.runtime.onStartup.addListener(() => {
  scheduleAllReminders();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReminder" || alarm.name.startsWith("reminder_")) {
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
    recordTrackingProgress(true);
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
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const { taskUrls = {} } = await chrome.storage.local.get(['taskUrls']);
    for (const [task, taskUrl] of Object.entries(taskUrls)) {
      if (!taskUrl || taskUrl.trim() === '') continue;
      try {
        const taskDomain = new URL(taskUrl).hostname.replace(/^www\./, '');
        if (domain === taskDomain || domain.endsWith(`.${taskDomain}`)) {
          return task;
        }
      } catch (error) {
        // skip malformed task URL
      }
    }
  } catch (error) {
    // ignore invalid URL
  }
  return null;
}

async function recordTrackingProgress(isHeartbeat = false) {
  if (!activeTracking.task || !activeTracking.tabId) return;
  const now = Date.now();
  const elapsed = now - activeTracking.lastUpdate;
  if (elapsed <= 0) return;

  activeTracking.lastUpdate = now;
  const today = new Date().toISOString().split('T')[0];
  const { websiteActivity = {}, websiteActivityDurations = {} } = await chrome.storage.local.get([
    'websiteActivity',
    'websiteActivityDurations'
  ]);

  if (!websiteActivityDurations[today]) websiteActivityDurations[today] = {};
  websiteActivityDurations[today][activeTracking.task] =
    (websiteActivityDurations[today][activeTracking.task] || 0) + elapsed;

  if (!websiteActivity[today]) websiteActivity[today] = {};
  if (websiteActivityDurations[today][activeTracking.task] >= MIN_ACTIVE_MS) {
    if (!websiteActivity[today][activeTracking.task]) {
      websiteActivity[today][activeTracking.task] = true;
    }
  }

  await chrome.storage.local.set({
    websiteActivity,
    websiteActivityDurations
  });
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

  if (!activeWindowFocused) {
    await stopTracking(tab.id);
    return;
  }

  const task = await findMatchingTask(tab.url || '');
  if (!task) {
    await stopTracking(tab.id);
    return;
  }

  if (activeTracking.tabId === tab.id && activeTracking.task === task) {
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
  await stopTracking(activeTracking.tabId);
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await handleTrackingForTab(tab);
  } catch (error) {
    console.error('Error handling tab activation', error);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stopTracking(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.active) {
      await handleTrackingForTab(tab);
    } else if (tabId === activeTracking.tabId && !tab.active) {
      await stopTracking(tabId);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  activeWindowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (!activeWindowFocused) {
    await stopTracking(activeTracking.tabId);
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    await handleTrackingForTab(tab);
  }
});
