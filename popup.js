document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');
  const toggleAddTaskBtn = document.getElementById('toggle-add-task');
  const addTaskForm = document.getElementById('add-task-form');
  const newTaskInput = document.getElementById('new-task-input');
  const taskTypeSelect = document.getElementById('task-type-select');
  const addTaskBtn = document.getElementById('add-task-btn');

  if (!chrome || !chrome.storage) {
    if (tasksList) {
      tasksList.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const PERMANENT_TASKS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskUrls', 'websiteActivity', 'taskTypes', 'websiteActivityDurations', 'archive']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const websiteActivityDurations = result.websiteActivityDurations || {};
      const taskTypes = result.taskTypes || {};
      const archive = result.archive || {};
      const todayProgress = progress[today] || {};
      const todayActivity = websiteActivity[today] || {};
      const todayDurations = websiteActivityDurations[today] || {};
      const yesterdayProgress = progress[yesterdayStr] || {};
      const yesterdayActivity = websiteActivity[yesterdayStr] || {};
      
      // Active tasks logic:
      // - Show ALL tasks (daily and one-time) - don't remove completed ones, just strike them off
      // - For one-time tasks: remove if completed YESTERDAY (past day), keep if incomplete yesterday
      // - For daily tasks: always show (permanent)
      // - Completed tasks stay in list with strikethrough until day passes
      const activeTasks = allTasks.filter(task => {
        const taskType = taskTypes[task] || 'daily';
        const taskUrl = taskUrls[task] || '';
        
        // Daily tasks: always show (permanent)
        if (taskType === 'daily') {
          return true; // Always show daily tasks
        }
        
        // One-time tasks: 
        // - Remove if completed YESTERDAY (past day - done, don't show)
        // - Keep if incomplete yesterday (carry forward) OR completed today (show with strikethrough)
        if (taskType === 'onetime') {
          const wasCompletedYesterday = taskUrl && taskUrl.trim() !== ''
            ? (yesterdayActivity[task] === true || yesterdayProgress[task] === true)
            : (yesterdayProgress[task] === true);
          
          // Remove only if completed yesterday (past day), keep otherwise
          return !wasCompletedYesterday;
        }
        
        return false;
      });
      
      // Calculate progress percentage (count all active tasks, including completed ones)
      const totalTasks = activeTasks.length; // x = total active tasks
      const completedTasks = activeTasks.filter(task => {
        const taskUrl = taskUrls[task] || '';
        const isManuallyCompleted = todayProgress[task] === true;
        const hasActivity = todayActivity[task] === true;
        
        if (taskUrl && taskUrl.trim() !== '') {
          return hasActivity || isManuallyCompleted;
        } else {
          return isManuallyCompleted;
        }
      });
      
      // Calculate percentage: (completed / total) * 100
      const completedCount = completedTasks.length; // y = completed tasks
      const progressPercentage = totalTasks > 0 
        ? Math.round((completedCount / totalTasks) * 100)
        : 0;
      
      // Ensure percentage is between 0 and 100
      const finalPercentage = Math.min(100, Math.max(0, progressPercentage));
      
      // Update progress indicator
      const progressIndicator = document.getElementById('progress-indicator');
      if (progressIndicator) {
        progressIndicator.innerHTML = `
          <div class="progress-percentage">${finalPercentage}% Complete</div>
          <div class="progress-text">${completedCount} of ${totalTasks} tasks</div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${finalPercentage}%"></div>
          </div>
        `;
      }

      if (tasksList) {
        tasksList.innerHTML = '';
        
        // Show all active tasks (daily tasks always shown, one-time tasks only if incomplete)
        activeTasks.forEach(task => {
          const taskItem = createTaskItem(task, taskTypes, taskUrls, todayProgress, todayActivity, todayDurations);
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
  
  function createTaskItem(task, taskTypes, taskUrls, todayProgress, todayActivity, todayDurations) {
    const taskType = taskTypes[task] || 'daily';
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `task-${task}`;
    
    const taskUrl = taskUrls[task] || '';
    const hasActivity = todayActivity[task] === true;
    const timeSpent = todayDurations[task] || 0;
    const minutesSpent = Math.round(timeSpent / 1000 / 60);
    
    // Determine if task is completed:
    // - Tasks with URLs: completed if hasActivity (10+ min)
    // - Tasks without URLs: completed if todayProgress[task] is true (manual checkbox)
    const isCompleted = taskUrl && taskUrl.trim() !== '' 
      ? hasActivity 
      : (todayProgress[task] === true);
    
    checkbox.checked = isCompleted;
    
    const label = document.createElement('label');
    label.htmlFor = `task-${task}`;
    
    const taskName = document.createElement('span');
    taskName.textContent = task;
    
    // Show task type badge ONLY for one-time tasks (not for daily/permanent)
    if (taskType === 'onetime') {
      const badge = document.createElement('span');
      badge.style.cssText = 'background: #FF9800; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; font-weight: 500;';
      badge.textContent = 'One-Time';
      taskName.appendChild(badge);
    }
    
    label.appendChild(taskName);
    
    // Handle tasks with URLs
    if (taskUrl && taskUrl.trim() !== '') {
      if (!hasActivity) {
        // Task has URL but no activity - disable checkbox and show progress
        checkbox.disabled = true;
        taskItem.classList.add('disabled');
        const status = document.createElement('span');
        status.className = 'activity-status';
        if (minutesSpent > 0) {
          status.textContent = ` (${minutesSpent} min - ${Math.round((timeSpent / (10 * 60 * 1000)) * 100)}%)`;
          status.style.color = '#FF9800';
        } else {
          status.textContent = ' (No activity)';
          status.style.color = '#f44336';
        }
        status.style.fontSize = '9px';
        label.appendChild(status);
      } else {
        // Task has URL and activity - checkbox is enabled and checked
        checkbox.disabled = false;
        const status = document.createElement('span');
        status.className = 'activity-status';
        status.textContent = ` ✓ (${minutesSpent} min)`;
        status.style.color = '#4CAF50';
        status.style.fontSize = '9px';
        label.appendChild(status);
      }
    }

    if (isCompleted) {
      taskItem.classList.add('completed');
    }

    checkbox.addEventListener('change', async () => {
      try {
        // For tasks with URLs, completion is based on activity, not manual checkbox
        // Only allow manual checkbox for tasks without URLs
        if (taskUrl && taskUrl.trim() !== '') {
          // Task has URL - completion is controlled by activity only
          checkbox.checked = hasActivity; // Reset to activity state
          return;
        }
        
        // For tasks without URLs, allow manual checkbox
        const result = await chrome.storage.local.get(['progress', 'archive']);
        const progress = result.progress || {};
        const archive = result.archive || {};
        if (!progress[today]) {
          progress[today] = {};
        }
        progress[today][task] = checkbox.checked;
        
        // If task is completed, add to archive
        if (checkbox.checked) {
          if (!archive[today]) {
            archive[today] = [];
          }
          // Add to archive if not already there
          if (!archive[today].includes(task)) {
            archive[today].push(task);
          }
          taskItem.classList.add('completed');
        } else {
          taskItem.classList.remove('completed');
          // Remove from archive if unchecked
          if (archive[today]) {
            archive[today] = archive[today].filter(t => t !== task);
          }
        }

        await chrome.storage.local.set({ progress, archive });
        loadData(); // Reload to update UI and recalculate percentage
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    });

    taskItem.appendChild(checkbox);
    taskItem.appendChild(label);
    return taskItem;
  }
  
  // Also archive tasks when they're completed via activity
  async function archiveCompletedTask(taskName) {
    try {
      const result = await chrome.storage.local.get(['archive']);
      const archive = result.archive || {};
      if (!archive[today]) {
        archive[today] = [];
      }
      if (!archive[today].includes(taskName)) {
        archive[today].push(taskName);
        await chrome.storage.local.set({ archive });
      }
    } catch (error) {
      console.error('Error archiving task:', error);
    }
  }
  
  // Monitor activity changes and archive when tasks complete
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.websiteActivity) {
      const newActivity = changes.websiteActivity.newValue || {};
      const oldActivity = changes.websiteActivity.oldValue || {};
      const todayActivity = newActivity[today] || {};
      const oldTodayActivity = oldActivity[today] || {};
      
      // Check if any task just got marked as active
      Object.keys(todayActivity).forEach(task => {
        if (todayActivity[task] === true && oldTodayActivity[task] !== true) {
          // Task just completed via activity
          archiveCompletedTask(task);
          // Reload to update UI
          setTimeout(() => loadData(), 500);
        }
      });
    }
  });

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

  // Toggle add task form
  if (toggleAddTaskBtn && addTaskForm) {
    toggleAddTaskBtn.addEventListener('click', () => {
      addTaskForm.classList.toggle('hidden');
      if (!addTaskForm.classList.contains('hidden') && newTaskInput) {
        newTaskInput.focus();
      }
    });
  }

  // Add task functionality
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'daily';
      
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks', 'taskUrls', 'taskTypes', 'permanentTasks']);
          const tasks = result.tasks || [];
          const taskUrls = result.taskUrls || {};
          const taskTypes = result.taskTypes || {};
          const permanentTasks = result.permanentTasks || PERMANENT_TASKS;
          
          // Check if task already exists (in permanent or custom)
          const allTasks = [...permanentTasks, ...tasks];
          if (allTasks.includes(taskName)) {
            alert('Task already exists!');
            return;
          }
          
          // Add new task
          tasks.push(taskName);
          taskUrls[taskName] = ''; // Initialize with empty URL
          taskTypes[taskName] = taskType;
          
          await chrome.storage.local.set({ tasks, taskUrls, taskTypes });
          
          // Clear input and hide form
          if (newTaskInput) {
            newTaskInput.value = '';
          }
          if (addTaskForm) {
            addTaskForm.classList.add('hidden');
          }
          
          // Reload data to show new task
          loadData();
        } catch (error) {
          console.error('Error adding task:', error);
          alert('Error adding task. Please try again.');
        }
      }
    });
  }

  // Allow Enter key to add task
  if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && addTaskBtn) {
        addTaskBtn.click();
      }
    });
  }

  loadData();
  
  // Refresh data every 30 seconds to show updated progress
  setInterval(() => {
    loadData();
  }, 30000);
});

