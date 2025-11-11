chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyReminder", { 
    periodInMinutes: 60 * 24,
    when: Date.now() + 60000
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReminder") {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
      const taskList = tasks.join(' and ');
      
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

