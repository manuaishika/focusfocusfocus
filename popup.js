document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');

  if (!chrome || !chrome.storage) {
    if (tasksList) {
      tasksList.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskUrls', 'websiteActivity', 'taskTypes']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const taskTypes = result.taskTypes || {};
      const todayProgress = progress[today] || {};
      const todayActivity = websiteActivity[today] || {};

      if (tasksList) {
        tasksList.innerHTML = '';

        allTasks.forEach(task => {
          const taskType = taskTypes[task] || 'daily';
          const taskItem = document.createElement('div');
          taskItem.className = 'task-item';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `task-${task}`;
          checkbox.checked = todayProgress[task] || false;
          
          const label = document.createElement('label');
          label.htmlFor = `task-${task}`;
          
          const taskName = document.createElement('span');
          taskName.textContent = task;
          
          // Show task type badge for custom tasks
          if (taskType === 'onetime') {
            const badge = document.createElement('span');
            badge.style.cssText = 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px; font-weight: 500;';
            badge.textContent = 'One-Time';
            taskName.appendChild(badge);
          }
          
          label.appendChild(taskName);
          
          const taskUrl = taskUrls[task] || '';
          const hasActivity = todayActivity[task] || false;
          
          // If task has a URL but no activity, disable checkbox
          if (taskUrl && taskUrl.trim() !== '' && !hasActivity) {
            checkbox.disabled = true;
            taskItem.classList.add('disabled');
            const status = document.createElement('span');
            status.className = 'activity-status';
            status.textContent = ' (No activity)';
            status.style.color = '#f44336';
            status.style.fontSize = '11px';
            label.appendChild(status);
          } else if (taskUrl && taskUrl.trim() !== '' && hasActivity) {
            const status = document.createElement('span');
            status.className = 'activity-status';
            status.textContent = ' ✓';
            status.style.color = '#4CAF50';
            status.style.fontSize = '11px';
            label.appendChild(status);
          }

          if (checkbox.checked) {
            taskItem.classList.add('completed');
          }

          checkbox.addEventListener('change', async () => {
            try {
              // Check if task has URL but no activity
              if (taskUrl && taskUrl.trim() !== '' && !hasActivity) {
                checkbox.checked = false;
                return;
              }
              
              const result = await chrome.storage.local.get(['progress']);
              const progress = result.progress || {};
              if (!progress[today]) {
                progress[today] = {};
              }
              progress[today][task] = checkbox.checked;
              
              if (checkbox.checked) {
                taskItem.classList.add('completed');
              } else {
                taskItem.classList.remove('completed');
              }

              await chrome.storage.local.set({ progress });
              loadData(); // Reload to update UI
            } catch (error) {
              console.error('Error saving progress:', error);
            }
          });

          taskItem.appendChild(checkbox);
          taskItem.appendChild(label);
          tasksList.appendChild(taskItem);
        });
      }
    } catch (error) {
      if (tasksList) {
        tasksList.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading data:', error);
    }
  }

  if (viewHeatmapBtn) {
    viewHeatmapBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('heatmap.html') });
    });
  }

  const viewArchiveBtn = document.getElementById('view-archive');

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (viewArchiveBtn) {
    viewArchiveBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
    });
  }

  loadData();
});

