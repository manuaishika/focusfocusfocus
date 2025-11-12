chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyReminder", { 
    periodInMinutes: 60 * 24,
    when: Date.now() + 60000
  });

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
    let shouldPersist = false;
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

