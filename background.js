chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyReminder", { 
    periodInMinutes: 60 * 24,
    when: Date.now() + 60000
  });
  chrome.alarms.create("trackingHeartbeat", { periodInMinutes: 1 });

  // Initialize permanent tasks and their URLs
  chrome.storage.local.get(['permanentTasks', 'taskUrls', 'taskTypes'], (result) => {
    const defaultPermanentTasks = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
    const defaultPermanentUrls = {
      'LeetCode': 'https://leetcode.com',
      'GRE Practice': 'https://www.ets.org/gre',
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
      if (taskUrls[task] === undefined && defaultPermanentUrls[task] !== undefined) {
        taskUrls[task] = defaultPermanentUrls[task];
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReminder") {
    chrome.storage.local.get(['permanentTasks', 'tasks', 'taskTypes'], (result) => {
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const taskTypes = result.taskTypes || {};
      
      // Only remind about daily tasks
      const allTasks = [...permanentTasks, ...customTasks];
      const dailyTasks = allTasks.filter(task => (taskTypes[task] || 'daily') === 'daily');
      const taskList = dailyTasks.join(' and ');
      
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Daily Reminder",
        message: `Don't forget your ${taskList} today!`,
        priority: 2
      });
    });
  } else if (alarm.name === "trackingHeartbeat") {
    recordTrackingProgress(true);
  }
});

// Track website activity
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Only track main frame
  
  try {
    const url = new URL(details.url);
    // Skip chrome:// and extension:// URLs
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      return;
    }
    
    const domain = url.hostname.replace(/^www\./, ''); // Remove www. prefix
    
    chrome.storage.local.get(['taskUrls', 'websiteActivity'], (result) => {
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const today = new Date().toISOString().split('T')[0];
      
      if (!websiteActivity[today]) {
        websiteActivity[today] = {};
      }
      
      let activityUpdated = false;
      
      // Check if this URL matches any task's website
      Object.keys(taskUrls).forEach(task => {
        const taskUrl = taskUrls[task];
        if (taskUrl && taskUrl.trim() !== '') {
          try {
            const taskUrlObj = new URL(taskUrl);
            let taskDomain = taskUrlObj.hostname.replace(/^www\./, ''); // Remove www. prefix
            
            // Check if domain matches (exact match or subdomain)
            if (domain === taskDomain || domain.endsWith('.' + taskDomain)) {
              if (!websiteActivity[today][task]) {
                websiteActivity[today][task] = true;
                activityUpdated = true;
              }
            }
          } catch (e) {
            // Invalid URL, skip
            console.error('Invalid task URL:', taskUrl, e);
          }
        }
      });
      
      if (activityUpdated) {
        chrome.storage.local.set({ websiteActivity });
      }
    });
  } catch (e) {
    // Invalid URL, skip
    console.error('Error processing URL:', details.url, e);
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
